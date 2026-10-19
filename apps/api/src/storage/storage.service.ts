import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { File, Storage } from '@google-cloud/storage';
import { RuntimeConfigService } from '../config/runtime-config.service';

/**
 * Bucket used when Admin → API Management → "Media bucket" (GCS_BUCKET) is
 * blank. This is the project's default appspot bucket.
 */
export const DEFAULT_MEDIA_BUCKET = 'universal-book-365.appspot.com';

const PUBLIC_HOST = 'https://storage.googleapis.com';

/**
 * Thin wrapper over Google Cloud Storage for publicly served media.
 *
 * Credentials come from Application Default Credentials: on Cloud Run that is
 * the service's runtime service account, which needs Storage Object Admin on
 * the bucket. Locally, run `gcloud auth application-default login` or set
 * GOOGLE_APPLICATION_CREDENTIALS.
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

  async bucketName(): Promise<string> {
    return (await this.config.get('GCS_BUCKET')) || DEFAULT_MEDIA_BUCKET;
  }

  publicUrl(bucket: string, objectPath: string): string {
    const encoded = objectPath.split('/').map(encodeURIComponent).join('/');
    return `${PUBLIC_HOST}/${bucket}/${encoded}`;
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
    const base = `${PUBLIC_HOST}/${bucket}/`;
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
}
