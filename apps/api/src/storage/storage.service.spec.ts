import { promises as fs } from 'fs';
import { join } from 'path';
import { ServiceUnavailableException } from '@nestjs/common';
import { LOCAL_UPLOAD_DIR, StorageService } from './storage.service';

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
});
