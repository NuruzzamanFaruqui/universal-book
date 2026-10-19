import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import { promises as fs } from 'fs';
import { join } from 'path';
import { RuntimeConfigService } from '../config/runtime-config.service';

/** Where local-dev uploads live on disk, and the URL prefix they're served under. */
export const LOCAL_UPLOAD_DIR = join(process.cwd(), 'uploads');
export const LOCAL_UPLOAD_PREFIX = '/uploads';

const GCS_HOST = 'https://storage.googleapis.com';

/**
 * Stores public media (book covers for now) in Google Cloud Storage.
 *
 * The bucket comes from GCS_BUCKET in Admin → API Management (or the env), so
 * it can change without a deploy. On Cloud Run the client authenticates as the
 * service's own account — no key file. The bucket must be publicly readable
 * (allUsers → Storage Object Viewer); see DEPLOYMENT.md.
 *
 * Locally, with no bucket configured, files go to apps/api/uploads and main.ts
 * serves them — so the feature works end to end without GCP credentials. That
 * fallback is refused in production, where Cloud Run's disk is wiped on every
 * cold start and the file would vanish.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private client: Storage | null = null;

  constructor(private readonly config: RuntimeConfigService) {}

  private gcs() {
    if (!this.client) this.client = new Storage();
    return this.client;
  }

  /**
   * Saves a PNG and returns its public URL.
   * @param path object path inside the bucket, e.g. covers/<bookId>/<ts>.png
   * @param localOrigin origin of this API, used only for the local-disk fallback
   */
  async uploadPng(path: string, data: Buffer, localOrigin: string): Promise<string> {
    const bucket = await this.config.get('GCS_BUCKET');

    if (bucket) {
      await this.gcs().bucket(bucket).file(path).save(data, {
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
        await this.gcs().bucket(bucket!).file(url.slice(gcsPrefix.length)).delete({ ignoreNotFound: true });
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
