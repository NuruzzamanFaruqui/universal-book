import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

export interface BookProgress {
  bookId: string;
  readCount: number;
  totalChapters: number;
  readChapterIds: string[];
}

@Injectable()
export class ReadingProgressService {
  constructor(private prisma: PrismaService) {}

  /**
   * Same rule as MarketplaceService.getPublishedBookById: the author, or anyone
   * with a BookPurchase. Progress is only tracked for readers who can open
   * every chapter, so a free-preview reader is never shown "1 of 12".
   */
  private async assertAccess(userId: string, bookId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { userId: true },
    });
    if (!book) throw new NotFoundException('Book not found');
    if (book.userId === userId) return;

    const purchase = await this.prisma.bookPurchase.findFirst({
      where: { bookId, buyerId: userId },
      select: { id: true },
    });
    if (!purchase) throw new ForbiddenException('Purchase this book to track your reading progress.');
  }

  async markChapterRead(userId: string, bookId: string, chapterId: string, isRead: boolean): Promise<BookProgress> {
    // Front and back matter (title page, contents…) are not counted, so they
    // cannot be marked either.
    const chapter = await this.prisma.chapter.findFirst({
      where: { id: chapterId, bookId, kind: 'CHAPTER' },
      select: { id: true },
    });
    if (!chapter) throw new NotFoundException('Chapter not found in this book');

    await this.assertAccess(userId, bookId);

    // Upsert on (userId, chapterId): repeated clicks or a second auto-mark
    // cannot create duplicates. Marking unread keeps the last readAt.
    await this.prisma.chapterReadProgress.upsert({
      where: { userId_chapterId: { userId, chapterId } },
      create: { userId, chapterId, bookId, isRead, readAt: isRead ? new Date() : null },
      update: isRead ? { isRead, readAt: new Date() } : { isRead },
    });

    return this.computeProgress(userId, bookId);
  }

  async getBookProgress(userId: string, bookId: string): Promise<BookProgress> {
    await this.assertAccess(userId, bookId);
    return this.computeProgress(userId, bookId);
  }

  /**
   * Progress for every book the user has bought, in one request, for the
   * Library page. Counts only; the Library has no use for chapter ids.
   */
  async getLibraryProgress(userId: string): Promise<Omit<BookProgress, 'readChapterIds'>[]> {
    const purchases = await this.prisma.bookPurchase.findMany({
      where: { buyerId: userId },
      select: { bookId: true },
    });
    const bookIds = [...new Set(purchases.map((p) => p.bookId))];
    if (bookIds.length === 0) return [];

    const [totals, reads] = await Promise.all([
      this.prisma.chapter.groupBy({
        by: ['bookId'],
        where: { bookId: { in: bookIds }, kind: 'CHAPTER' },
        _count: { _all: true },
      }),
      this.prisma.chapterReadProgress.groupBy({
        by: ['bookId'],
        where: { userId, bookId: { in: bookIds }, isRead: true, chapter: { kind: 'CHAPTER' } },
        _count: { _all: true },
      }),
    ]);

    const totalByBook = new Map(totals.map((t) => [t.bookId, t._count._all]));
    const readByBook = new Map(reads.map((r) => [r.bookId, r._count._all]));
    return bookIds.map((bookId) => ({
      bookId,
      readCount: readByBook.get(bookId) ?? 0,
      totalChapters: totalByBook.get(bookId) ?? 0,
    }));
  }

  private async computeProgress(userId: string, bookId: string): Promise<BookProgress> {
    const [totalChapters, rows] = await Promise.all([
      this.prisma.chapter.count({ where: { bookId, kind: 'CHAPTER' } }),
      this.prisma.chapterReadProgress.findMany({
        where: { userId, bookId, isRead: true, chapter: { kind: 'CHAPTER' } },
        select: { chapterId: true },
      }),
    ]);

    return {
      bookId,
      readCount: rows.length,
      totalChapters,
      readChapterIds: rows.map((r) => r.chapterId),
    };
  }
}
