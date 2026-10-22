import { promises as fs } from 'fs';
import { join } from 'path';
import { ServiceUnavailableException } from '@nestjs/common';
import { DEFAULT_MEDIA_BUCKET, LOCAL_UPLOAD_DIR, StorageService } from './storage.service';

const config = (bucket?: string) => ({ get: jest.fn().mockResolvedValue(bucket) }) as any;

describe('StorageService', () => {
  const env = process.env.NODE_ENV;
  afterEach(() => { process.env.NODE_ENV = env; });

  it('writes to local disk when no bucket is configured (development)', async () => {
    process.env.NODE_ENV = 'development';
    const service = new StorageService(config());
    const path = `covers/test-spec/${Date.now()}.png`;
    const url = await service.uploadPng(path, Buffer.from('png'), 'http://localhost:8080');
    expect(url).toBe(`http://localhost:8080/uploads/${path}`);
    expect(await fs.readFile(join(LOCAL_UPLOAD_DIR, path), 'utf8')).toBe('png');
    expect(await service.isOwnUrl(url, 'covers/test-spec/')).toBe(true);
    await service.remove(url);
    await expect(fs.access(join(LOCAL_UPLOAD_DIR, path))).rejects.toBeTruthy();
    await fs.rm(join(LOCAL_UPLOAD_DIR, 'covers/test-spec'), { recursive: true, force: true });
  });

  it('refuses the disk fallback in production', async () => {
    process.env.NODE_ENV = 'production';
    const service = new StorageService(config());
    await expect(service.uploadPng('covers/b1/1.png', Buffer.from('x'), 'http://x'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('only recognises URLs in the configured bucket and prefix', async () => {
    process.env.NODE_ENV = 'production';
    const service = new StorageService(config('ub-media'));
    expect(await service.isOwnUrl('https://storage.googleapis.com/ub-media/covers/b1/1.png', 'covers/b1/')).toBe(true);
    expect(await service.isOwnUrl('https://storage.googleapis.com/other/covers/b1/1.png', 'covers/b1/')).toBe(false);
    expect(await service.isOwnUrl('http://localhost:8080/uploads/covers/b1/1.png', 'covers/b1/')).toBe(false);
  });

  describe('profile photos', () => {
    /** Stands in for the GCS client so tests can see which bucket was used. */
    const fakeGcs = () => {
      const file = { save: jest.fn().mockResolvedValue(undefined), makePublic: jest.fn().mockResolvedValue(undefined), delete: jest.fn().mockResolvedValue(undefined), name: '' };
      const bucket = jest.fn().mockReturnValue({ file: jest.fn().mockReturnValue(file) });
      return { client: { bucket } as any, bucket, file };
    };

    it('writes to local disk and deletes the old one when no bucket is configured (development)', async () => {
      process.env.NODE_ENV = 'development';
      const service = new StorageService(config());
      const path = `profile-photos/test-spec/${Date.now()}.png`;
      const url = await service.uploadPublic(path, Buffer.from('img'), 'image/png', 'http://localhost:8080');
      expect(url).toBe(`http://localhost:8080/uploads/${path}`);
      expect(await fs.readFile(join(LOCAL_UPLOAD_DIR, path), 'utf8')).toBe('img');

      await service.deleteByUrl(url, 'profile-photos/test-spec/');
      await expect(fs.access(join(LOCAL_UPLOAD_DIR, path))).rejects.toBeTruthy();
      expect((service as any).client).toBeNull(); // never created a GCS client
      await fs.rm(join(LOCAL_UPLOAD_DIR, 'profile-photos/test-spec'), { recursive: true, force: true });
    });

    it("leaves another user's local photo alone", async () => {
      process.env.NODE_ENV = 'development';
      const service = new StorageService(config());
      const path = `profile-photos/test-spec-other/${Date.now()}.png`;
      const url = await service.uploadPublic(path, Buffer.from('img'), 'image/png', 'http://localhost:8080');
      await service.deleteByUrl(url, 'profile-photos/test-spec/');
      expect(await fs.readFile(join(LOCAL_UPLOAD_DIR, path), 'utf8')).toBe('img');
      await fs.rm(join(LOCAL_UPLOAD_DIR, 'profile-photos/test-spec-other'), { recursive: true, force: true });
    });

    it('never touches a real bucket from local disk mode, even for a bucket URL', async () => {
      process.env.NODE_ENV = 'development';
      const service = new StorageService(config());
      const gcs = fakeGcs();
      (service as any).client = gcs.client;
      await service.deleteByUrl(`https://storage.googleapis.com/${DEFAULT_MEDIA_BUCKET}/profile-photos/u1/a.png`, 'profile-photos/u1/');
      expect(gcs.bucket).not.toHaveBeenCalled();
    });

    it('uses the default bucket in production when none is configured', async () => {
      process.env.NODE_ENV = 'production';
      const service = new StorageService(config());
      const gcs = fakeGcs();
      (service as any).client = gcs.client;
      const url = await service.uploadPublic('profile-photos/u1/a.png', Buffer.from('img'), 'image/png', 'http://x');
      expect(gcs.bucket).toHaveBeenCalledWith(DEFAULT_MEDIA_BUCKET);
      expect(url).toBe(`https://storage.googleapis.com/${DEFAULT_MEDIA_BUCKET}/profile-photos/u1/a.png`);
    });

    it('uses the configured bucket in development when one is set', async () => {
      process.env.NODE_ENV = 'development';
      const service = new StorageService(config('my-test-bucket'));
      const gcs = fakeGcs();
      (service as any).client = gcs.client;
      const url = await service.uploadPublic('profile-photos/u1/a.png', Buffer.from('img'), 'image/png', 'http://x');
      expect(gcs.bucket).toHaveBeenCalledWith('my-test-bucket');
      expect(url).toBe('https://storage.googleapis.com/my-test-bucket/profile-photos/u1/a.png');
    });
  });
});
