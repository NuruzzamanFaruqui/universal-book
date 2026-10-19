import { BadRequestException, NotFoundException } from '@nestjs/common';
import { BooksService, MAX_COVER_BYTES } from './books.service';

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(64)]);
const OWN = 'https://storage.googleapis.com/bucket/covers/b1/1.png';

function setup(editable = true, existingCover: string | null = null) {
  const prisma = {
    book: {
      findFirst: jest.fn().mockResolvedValue(editable ? { id: 'b1', coverUrl: existingCover } : null),
      update: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: 'b1', ...data })),
    },
  };
  const storage = {
    uploadPng: jest.fn().mockResolvedValue(OWN),
    isOwnUrl: jest.fn().mockImplementation(async (url: string, prefix: string) =>
      url.startsWith(`https://storage.googleapis.com/bucket/${prefix}`)),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const service = new BooksService(prisma as any, {} as any, {} as any, storage as any);
  return { service, prisma, storage };
}

describe('BooksService covers', () => {
  describe('uploadCover', () => {
    it('stores a PNG under the book and returns its URL', async () => {
      const { service, storage } = setup();
      await expect(service.uploadCover('b1', 'u1', { buffer: PNG, size: PNG.length }, 'http://x'))
        .resolves.toEqual({ url: OWN });
      expect(storage.uploadPng).toHaveBeenCalledWith(expect.stringMatching(/^covers\/b1\/\d+\.png$/), PNG, 'http://x');
    });

    it('refuses someone who cannot edit the book', async () => {
      const { service, storage } = setup(false);
      await expect(service.uploadCover('b1', 'u2', { buffer: PNG, size: PNG.length }, 'http://x'))
        .rejects.toBeInstanceOf(NotFoundException);
      expect(storage.uploadPng).not.toHaveBeenCalled();
    });

    it('rejects files that are not PNGs, whatever they claim to be', async () => {
      const { service } = setup();
      const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);
      await expect(service.uploadCover('b1', 'u1', { buffer: jpeg, size: jpeg.length }, 'http://x'))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('rejects a missing or oversized file', async () => {
      const { service } = setup();
      await expect(service.uploadCover('b1', 'u1', undefined, 'http://x')).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.uploadCover('b1', 'u1', { buffer: PNG, size: MAX_COVER_BYTES + 1 }, 'http://x'))
        .rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('updateBook coverUrl', () => {
    it('saves a URL this API stored for the book', async () => {
      const { service, prisma } = setup();
      await service.updateBook('b1', 'u1', { coverUrl: OWN });
      expect(prisma.book.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { coverUrl: OWN } });
    });

    it('rejects an arbitrary external URL', async () => {
      const { service, prisma } = setup();
      await expect(service.updateBook('b1', 'u1', { coverUrl: 'https://evil.example/x.png' }))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.book.update).not.toHaveBeenCalled();
    });

    it("rejects another book's cover", async () => {
      const { service } = setup();
      await expect(service.updateBook('b1', 'u1', { coverUrl: 'https://storage.googleapis.com/bucket/covers/b2/1.png' }))
        .rejects.toBeInstanceOf(BadRequestException);
    });

    it('clears the cover with null and deletes the old image', async () => {
      const { service, prisma, storage } = setup(true, OWN);
      await service.updateBook('b1', 'u1', { coverUrl: null });
      expect(prisma.book.update).toHaveBeenCalledWith({ where: { id: 'b1' }, data: { coverUrl: null } });
      expect(storage.remove).toHaveBeenCalledWith(OWN);
    });

    it('leaves the cover alone when coverUrl is not sent', async () => {
      const { service, prisma, storage } = setup(true, OWN);
      await service.updateBook('b1', 'u1', { title: 'New title' });
      expect(prisma.book.update.mock.calls[0][0].data).not.toHaveProperty('coverUrl');
      expect(storage.remove).not.toHaveBeenCalled();
    });
  });
});
