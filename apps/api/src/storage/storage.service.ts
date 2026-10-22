import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { File, Storage } from '@google-cloud/storage';
import { promises as fs } from 'fs';
import { join } from 'path';
import { RuntimeConfigService } from '../config/runtime-config.service';

/**
 * Bucket used for profile photos in production when Admin → API Management →
 * "Media bucket" (GCS_BUCKET) is blank. This is the project's default appspot
 * bucket.
 */
export const DEFAULT_MEDIA_BUCKET = 'universal-book-365.appspot.com';

/** Where local-dev uploads live on disk, and the URL prefix they're served under. */
export const LOCAL_UPLOAD_DIR = join(process.cwd(), 'uploads');
export const LOCAL_UPLOAD_PREFIX = '/uploads';

const GCS_HOST = 'https://storage.googleapis.com';

const isProduction = () => process.env.NODE_ENV === 'production';

/**
 * Stores publicly served media (profile photos and book covers) in Google
 * Cloud Storage.
 *
 * The bucket comes from GCS_BUCKET in Admin → API Management (or the env), so
 * it can change without a deploy. Credentials come from Application Default
 * Credentials: on Cloud Run that is the service's runtime service account,
 * which needs Storage Object Admin on the bucket. Locally, run
 * `gcloud auth application-default login` or set GOOGLE_APPLICATION_CREDENTIALS.
 * The bucket must be publicly readable (allUsers → Storage Object Viewer); see
 * DEPLOYMENT.md.
 *
 * Local development with no bucket configured: everything goes to
 * apps/api/uploads and main.ts serves it at /uploads, so both features work end
 * to end without GCP credentials and never touch a real bucket.
 *
 * Production with no bucket configured: profile photos use
 * DEFAULT_MEDIA_BUCKET; book covers are refused (503). The disk fallback is
 * never used in production, where Cloud Run's disk is wiped on every cold start
 * and the file would vanish.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: Storage | null = null;
  private warnedUniformAccess = false;

  constructor(private readonly config: RuntimeConfigService) {}

  /** Created lazily so the API still boots on machines without GCP credentials. */
  private get storage(): Storage {
    if (!this.client) this.client = new Storage();
    return this.client;
  }

  private async configuredBucket(): Promise<string | undefined> {
    return (await this.config.get('GCS_BUCKET')) || undefined;
  }

  /** True when uploads should go to local disk: development with no bucket set. */
  private async useLocalDisk(): Promise<boolean> {
    return !isProduction() && !(await this.configuredBucket());
  }

  // ─── Local disk (development only) ────────────────────────────────────────

  private async saveLocally(path: string, data: Buffer, localOrigin: string): Promise<string> {
    const target = join(LOCAL_UPLOAD_DIR, path);
    await fs.mkdir(join(target, '..'), { recursive: true });
    await fs.writeFile(target, data);
    return `${localOrigin}${LOCAL_UPLOAD_PREFIX}/${path}`;
  }

  /**
   * The path inside LOCAL_UPLOAD_DIR that `url` points at, if it is a local
   * upload under `prefix` ('' for any). Null in production or for anything else.
   */
  private localPathOf(url: string, prefix = ''): string | null {
    if (isProduction()) return null;
    let pathname: string;
    try {
      pathname = new URL(url).pathname;
    } catch {
      return null;
    }
    if (!pathname.startsWith(`${LOCAL_UPLOAD_PREFIX}/${prefix}`) || pathname.includes('..')) return null;
    return pathname.slice(LOCAL_UPLOAD_PREFIX.length + 1);
  }

  // ─── Profile photos ────────────────────────────────────────────────────────

  async bucketName(): Promise<string> {
    return (await this.configuredBucket()) || DEFAULT_MEDIA_BUCKET;
  }

  publicUrl(bucket: string, objectPath: string): string {
    const encoded = objectPath.split('/').map(encodeURIComponent).join('/');
    return `${GCS_HOST}/${bucket}/${encoded}`;
  }

  /**
   * Uploads `data` to `objectPath`, makes it publicly readable and returns its
   * public URL. Object names should be unique — the long-lived cache header
   * assumes a given URL never changes content.
   * @param localOrigin origin of this API, used only for the local-disk fallback
   */
  async uploadPublic(objectPath: string, data: Buffer, contentType: string, localOrigin: string): Promise<string> {
    if (await this.useLocalDisk()) {
      return this.saveLocally(objectPath, data, localOrigin);
    }

    const bucket = await this.bucketName();
    const file = this.storage.bucket(bucket).file(objectPath);

    try {
      await file.save(data, {
        resumable: false,
        contentType,
        metadata: { cacheControl: 'public, max-age=31536000, immutable' },
      });
    } catch (err: any) {
      this.logger.error(`Upload to gs://${bucket}/${objectPath} failed: ${err?.message ?? err}`);
      throw new ServiceUnavailableException('Photo storage is unavailable right now. Please try again later.');
    }

    await this.makePublic(file, bucket);
    return this.publicUrl(bucket, objectPath);
  }

  /**
   * Buckets with fine-grained ACLs need a per-object public-read grant. Buckets
   * with uniform bucket-level access reject per-object ACLs outright; there,
   * public read has to come from bucket IAM (allUsers → Storage Object Viewer),
   * so that specific rejection is not an error.
   */
  private async makePublic(file: File, bucket: string) {
    try {
      await file.makePublic();
    } catch (err: any) {
      const message: string = err?.message ?? String(err);
      if (/uniform bucket-level access/i.test(message)) {
        if (!this.warnedUniformAccess) {
          this.warnedUniformAccess = true;
          this.logger.warn(
            `gs://${bucket} uses uniform bucket-level access; photos are only visible if ` +
              'allUsers has Storage Object Viewer on the bucket.',
          );
        }
        return;
      }
      this.logger.error(`Could not make gs://${bucket}/${file.name} public: ${message}`);
      await file.delete({ ignoreNotFound: true }).catch(() => undefined);
      throw new ServiceUnavailableException('Photo storage is unavailable right now. Please try again later.');
    }
  }

  /**
   * Deletes the object behind `url`, but only if it is one we stored under
   * `prefix`: in the current media bucket, or (in development) on local disk.
   * Anything else (an external avatar URL, another user's folder) is left
   * alone. Best-effort: failures are logged, not thrown.
   */
  async deleteByUrl(url: string | null | undefined, prefix: string): Promise<void> {
    if (!url) return;

    const localPath = this.localPathOf(url, prefix);
    if (localPath) {
      await fs.rm(join(LOCAL_UPLOAD_DIR, localPath), { force: true }).catch((err: any) => {
        this.logger.warn(`Could not delete old local upload ${localPath}: ${err?.message ?? err}`);
      });
      return;
    }

    // Running on local disk: never reach out to a real bucket.
    if (await this.useLocalDisk()) return;

    const bucket = await this.bucketName();
    const base = `${GCS_HOST}/${bucket}/`;
    if (!url.startsWith(base)) return;

    let objectPath: string;
    try {
      objectPath = url.slice(base.length).split('/').map(decodeURIComponent).join('/');
    } catch {
      return;
    }
    if (!objectPath.startsWith(prefix) || objectPath.includes('..')) return;

    try {
      await this.storage.bucket(bucket).file(objectPath).delete({ ignoreNotFound: true });
    } catch (err: any) {
      this.logger.warn(`Could not delete old object gs://${bucket}/${objectPath}: ${err?.message ?? err}`);
    }
  }

  // ─── Book covers ───────────────────────────────────────────────────────────

  /**
   * Saves a PNG and returns its public URL.
   * @param path object path inside the bucket, e.g. covers/<bookId>/<ts>.png
   * @param localOrigin origin of this API, used only for the local-disk fallback
   */
  async uploadPng(path: string, data: Buffer, localOrigin: string): Promise<string> {
    const bucket = await this.configuredBucket();

    if (bucket) {
      await this.storage.bucket(bucket).file(path).save(data, {
        contentType: 'image/png',
        resumable: false,
        // Every save gets a new timestamped name, so the object never changes
        // and browsers/CDNs can cache it forever.
        metadata: { cacheControl: 'public, max-age=31536000, immutable' },
      });
      return `${GCS_HOST}/${bucket}/${path}`;
    }

    if (isProduction()) {
      throw new ServiceUnavailableException(
        'Cover storage is not configured. Set GCS_BUCKET in Admin → API Management.',
      );
    }

    return this.saveLocally(path, data, localOrigin);
  }

  /**
   * Whether a URL points at an object this service stored under `prefix`.
   * Used so PUT /books/:id can't be used to set coverUrl to an arbitrary
   * third-party image.
   */
  async isOwnUrl(url: string, prefix: string): Promise<boolean> {
    const bucket = await this.configuredBucket();
    if (bucket && url.startsWith(`${GCS_HOST}/${bucket}/${prefix}`)) return true;
    return this.localPathOf(url, prefix) !== null;
  }

  /** Best-effort removal of an object we stored. Never throws. */
  async remove(url: string): Promise<void> {
    try {
      const bucket = await this.configuredBucket();
      const gcsPrefix = bucket ? `${GCS_HOST}/${bucket}/` : null;
      if (gcsPrefix && url.startsWith(gcsPrefix)) {
        await this.storage.bucket(bucket!).file(url.slice(gcsPrefix.length)).delete({ ignoreNotFound: true });
        return;
      }
      const localPath = this.localPathOf(url);
      if (localPath) await fs.rm(join(LOCAL_UPLOAD_DIR, localPath), { force: true });
    } catch (err: any) {
      this.logger.warn(`Could not remove ${url}: ${err.message}`);
    }
  }
}
