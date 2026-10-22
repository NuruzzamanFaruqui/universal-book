import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { File, Storage } from '@google-cloud/storage';
import { promises as fs } from 'fs';
import { join } from 'path';
import { RuntimeConfigService } from '../config/runtime-config.service';

/**
 * Bucket used for profile photos when Admin → API Management → "Media bucket"
 * (GCS_BUCKET) is blank. This is the project's default appspot bucket.
 */
export const DEFAULT_MEDIA_BUCKET = 'universal-book-365.appspot.com';

/** Where local-dev uploads live on disk, and the URL prefix they're served under. */
export const LOCAL_UPLOAD_DIR = join(process.cwd(), 'uploads');
export const LOCAL_UPLOAD_PREFIX = '/uploads';

const GCS_HOST = 'https://storage.googleapis.com';

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
 * Profile photos (uploadPublic / deleteByUrl) fall back to DEFAULT_MEDIA_BUCKET
 * when GCS_BUCKET is blank.
 *
 * Book covers (uploadPng / isOwnUrl / remove), with no bucket configured, go to
 * apps/api/uploads and main.ts serves them — so the feature works end to end
 * without GCP credentials. That fallback is refused in production, where Cloud
 * Run's disk is wiped on every cold start and the file would vanish.
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

  // ─── Profile photos ────────────────────────────────────────────────────────

  async bucketName(): Promise<string> {
    return (await this.config.get('GCS_BUCKET')) || DEFAULT_MEDIA_BUCKET;
  }

  publicUrl(bucket: string, objectPath: string): string {
    const encoded = objectPath.split('/').map(encodeURIComponent).join('/');
    return `${GCS_HOST}/${bucket}/${encoded}`;
  }

  /**
   * Uploads `data` to `objectPath`, makes it publicly readable and returns its
   * public URL. Object names should be unique — the long-lived cache header
   * assumes a given URL never changes content.
   */
  async uploadPublic(objectPath: string, data: Buffer, contentType: string): Promise<string> {
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
   * Deletes the object behind `url`, but only if it lives in the current media
   * bucket under `prefix`. Anything else (an external avatar URL, another
   * user's folder) is left alone. Best-effort: failures are logged, not thrown.
   */
  async deleteByUrl(url: string | null | undefined, prefix: string): Promise<void> {
    if (!url) return;
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
    const bucket = await this.config.get('GCS_BUCKET');

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

    if (process.env.NODE_ENV === 'production') {
      throw new ServiceUnavailableException(
        'Cover storage is not configured. Set GCS_BUCKET in Admin → API Management.',
      );
    }

    const target = join(LOCAL_UPLOAD_DIR, path);
    await fs.mkdir(join(target, '..'), { recursive: true });
    await fs.writeFile(target, data);
    return `${localOrigin}${LOCAL_UPLOAD_PREFIX}/${path}`;
  }

  /**
   * Whether a URL points at an object this service stored under `prefix`.
   * Used so PUT /books/:id can't be used to set coverUrl to an arbitrary
   * third-party image.
   */
  async isOwnUrl(url: string, prefix: string): Promise<boolean> {
    const bucket = await this.config.get('GCS_BUCKET');
    if (bucket && url.startsWith(`${GCS_HOST}/${bucket}/${prefix}`)) return true;
    if (process.env.NODE_ENV !== 'production') {
      try {
        return new URL(url).pathname.startsWith(`${LOCAL_UPLOAD_PREFIX}/${prefix}`);
      } catch {
        return false;
      }
    }
    return false;
  }

  /** Best-effort removal of an object we stored. Never throws. */
  async remove(url: string): Promise<void> {
    try {
      const bucket = await this.config.get('GCS_BUCKET');
      const gcsPrefix = bucket ? `${GCS_HOST}/${bucket}/` : null;
      if (gcsPrefix && url.startsWith(gcsPrefix)) {
        await this.storage.bucket(bucket!).file(url.slice(gcsPrefix.length)).delete({ ignoreNotFound: true });
        return;
      }
      if (process.env.NODE_ENV !== 'production') {
        const pathname = new URL(url).pathname;
        if (pathname.startsWith(`${LOCAL_UPLOAD_PREFIX}/`) && !pathname.includes('..')) {
          await fs.rm(join(LOCAL_UPLOAD_DIR, pathname.slice(LOCAL_UPLOAD_PREFIX.length + 1)), { force: true });
        }
      }
    } catch (err: any) {
      this.logger.warn(`Could not remove ${url}: ${err.message}`);
    }
  }
}
