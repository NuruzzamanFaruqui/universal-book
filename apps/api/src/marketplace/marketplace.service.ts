import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class MarketplaceService {
  constructor(private prisma: PrismaService) {}

  async getPublishedBooks(genre?: string, search?: string, page = 1, limit = 12) {
    const skip = (page - 1) * limit;
    const where: any = { isPublic: true };
    if (genre) {
      where.book = { genre: { contains: genre, mode: 'insensitive' } };
    }
    if (search) {
      where.book = {
        ...where.book,
        OR: [
          { title: { contains: search, mode: 'insensitive' } },
          { synopsis: { contains: search, mode: 'insensitive' } },
        ],
      };
    }
    const [books, total] = await Promise.all([
      this.prisma.publishedBook.findMany({
        where,
        include: {
          book: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
              chapters: { select: { id: true } },
            },
          },
          reviews: { select: { rating: true } },
        },
        orderBy: { publishedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.publishedBook.count({ where }),
    ]);
    return { books, total, page, limit };
  }

  async getFeaturedBooks() {
    return this.prisma.publishedBook.findMany({
      where: { isPublic: true, isFeatured: true },
      include: {
        book: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            chapters: { select: { id: true } },
          },
        },
        reviews: { select: { rating: true } },
      },
      take: 6,
    });
  }

  async getNewReleases() {
    return this.prisma.publishedBook.findMany({
      where: { isPublic: true },
      include: {
        book: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            chapters: { select: { id: true } },
          },
        },
        reviews: { select: { rating: true } },
      },
      orderBy: { publishedAt: 'desc' },
      take: 8,
    });
  }

async getPublishedBookById(bookId: string, userId?: string) {
    const published = await this.prisma.publishedBook.findUnique({
      where: { bookId },
      include: {
        book: {
          include: {
            user: { select: { id: true, name: true, avatarUrl: true, bio: true } },
            chapters: {
              select: { id: true, number: true, title: true, summary: true, content: true },
              orderBy: { number: 'asc' },
            },
            follows: true,
          },
        },
        reviews: {
          include: {
            reviewer: { select: { id: true, name: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });

    if (!published) return null;

    // Check if user has purchased or is the author
    let hasAccess = false;
    if (userId) {
      const isAuthor = published.book.userId === userId;
      const purchase = await this.prisma.bookPurchase.findFirst({
        where: { bookId, buyerId: userId },
      });
      hasAccess = isAuthor || !!purchase;
    }

    // Only return content for chapter 1 (free preview) unless user has access
    const chapters = published.book.chapters.map((ch: any) => ({
      ...ch,
      content: ch.number === 1 || hasAccess ? ch.content : null,
    }));

    return {
      ...published,
      book: { ...published.book, chapters },
      hasAccess,
    };
  }

  async publishBook(bookId: string, userId: string, price: number) {
    const book = await this.prisma.book.findFirst({ where: { id: bookId, userId } });
    if (!book) throw new Error('Book not found');
    const existing = await this.prisma.publishedBook.findUnique({ where: { bookId } });
    if (existing) {
      return this.prisma.publishedBook.update({ where: { bookId }, data: { price, isPublic: true } });
    }
    const published = await this.prisma.publishedBook.create({ data: { bookId, price, isPublic: true } });
    await this.prisma.activityFeed.create({
      data: { userId, type: 'BOOK_PUBLISHED', message: `published "${book.title}"`, bookId },
    });
    return published;
  }

  async unpublishBook(bookId: string, userId: string) {
    const book = await this.prisma.book.findFirst({ where: { id: bookId, userId } });
    if (!book) throw new Error('Book not found');
    return this.prisma.publishedBook.update({ where: { bookId }, data: { isPublic: false } });
  }

  async addReview(bookId: string, reviewerId: string, rating: number, comment: string) {
    const existing = await this.prisma.bookReview.findFirst({ where: { bookId, reviewerId } });
    if (existing) {
      return this.prisma.bookReview.update({ where: { id: existing.id }, data: { rating, comment } });
    }
    return this.prisma.bookReview.create({ data: { bookId, reviewerId, rating, comment } });
  }

  async followBook(userId: string, bookId: string) {
    const existing = await this.prisma.bookFollow.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });
    if (existing) {
      await this.prisma.bookFollow.delete({ where: { userId_bookId: { userId, bookId } } });
      return { following: false };
    }
    await this.prisma.bookFollow.create({ data: { userId, bookId } });
    return { following: true };
  }

  async followWriter(followerId: string, writerId: string) {
    const existing = await this.prisma.writerFollow.findUnique({
      where: { followerId_writerId: { followerId, writerId } },
    });
    if (existing) {
      await this.prisma.writerFollow.delete({ where: { followerId_writerId: { followerId, writerId } } });
      return { following: false };
    }
    await this.prisma.writerFollow.create({ data: { followerId, writerId } });
    return { following: true };
  }

  async getActivityFeed(limit = 20) {
    return this.prisma.activityFeed.findMany({
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async getWriterProfile(writerId: string) {
    return this.prisma.user.findUnique({
      where: { id: writerId },
      select: {
        id: true, name: true, avatarUrl: true, bio: true, createdAt: true,
        books: {
          where: { published: { isPublic: true } },
          include: { published: true, chapters: { select: { id: true } } },
        },
        followers: true,
        following: true,
      },
    });
  }

  async getTopWriters() {
    return this.prisma.user.findMany({
      where: { books: { some: { published: { isPublic: true } } } },
      select: {
        id: true, name: true, avatarUrl: true, bio: true,
        books: { where: { published: { isPublic: true } }, select: { id: true } },
        followers: true,
      },
      take: 6,
    });
  }

  async getUserLibrary(userId: string) {
    return this.prisma.bookPurchase.findMany({
      where: { buyerId: userId },
      include: {
        publishedBook: {
          include: {
            book: {
              include: {
                user: { select: { id: true, name: true } },
                chapters: { select: { id: true, number: true, title: true, content: true } },
              },
            },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
