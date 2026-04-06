import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AiService } from '../ai/ai.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class BooksService {
  constructor(
    private prisma: PrismaService,
    private aiService: AiService,
    private paymentsService: PaymentsService,
  ) {}

  async getAllBooks(userId: string) {
    return this.prisma.book.findMany({
      where: { userId },
      include: { chapters: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getBookById(id: string, userId: string) {
    return this.prisma.book.findFirst({
      where: { id, userId },
      include: {
        chapters: {
          orderBy: { number: 'asc' },
        },
      },
    });
  }

  async createBook(userId: string, data: {
    topic: string;
    genre: string;
    tone: string;
    audience: string;
    chaptersCount: number;
    language: string;
    title?: string;
    synopsis?: string;
    outline?: any;
  }) {
    // Charge $5 credits before generation
    await this.paymentsService.chargeForAiGeneration(userId);

    // If user selected title/outline/synopsis from wizard, use them
    // Otherwise fall back to AI-generated outline
    let bookTitle: string;
    let bookSubtitle: string | undefined;
    let bookSynopsis: string | undefined;
    let chapters: any[];

    if (data.title && data.outline) {
      // User went through the wizard — use their selections
      bookTitle = data.title;
      bookSynopsis = data.synopsis || undefined;
      chapters = data.outline.chapters.map((ch: any, index: number) => ({
        number: index + 1,
        title: ch.title,
        summary: ch.description || ch.summary || '',
      }));
    } else {
      // Fallback: generate everything from scratch
      const outline = await this.aiService.generateOutline(
        data.topic,
        data.genre,
        data.tone,
        data.audience,
        data.chaptersCount,
      );
      bookTitle = outline.title;
      bookSubtitle = outline.subtitle;
      bookSynopsis = outline.synopsis;
      chapters = outline.chapters;
    }

    const book = await this.prisma.book.create({
      data: {
        title: bookTitle,
        subtitle: bookSubtitle || null,
        synopsis: bookSynopsis || null,
        genre: data.genre,
        tone: data.tone,
        audience: data.audience,
        language: data.language,
        status: 'GENERATING',
        userId,
        chapters: {
          create: chapters.map((ch: any) => ({
            number: ch.number,
            title: ch.title,
            summary: ch.summary || '',
          })),
        },
      },
      include: {
        chapters: {
          orderBy: { number: 'asc' },
        },
      },
    });

    return book;
  }

  async generateChapterContent(bookId: string, chapterId: string, userId: string) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      include: {
        chapters: {
          orderBy: { number: 'asc' },
        },
      },
    });

    if (!book) throw new Error('Book not found');

    const chapter = book.chapters.find(c => c.id === chapterId);
    if (!chapter) throw new Error('Chapter not found');

    const previousChapters = book.chapters
      .filter(c => c.number < chapter.number && c.content)
      .map(c => `Chapter ${c.number} - ${c.title}: ${c.summary}`)
      .join('\n');

    const content = await this.aiService.generateChapterContent(
      book.title,
      chapter.title,
      chapter.number,
      book.chapters.length,
      book.synopsis || '',
      book.genre,
      book.tone,
      book.audience || 'General readers',
      previousChapters,
      chapter.summary ? [chapter.summary] : [],
    );

    const updatedChapter = await this.prisma.chapter.update({
      where: { id: chapterId },
      data: { content },
    });

    const allChapters = await this.prisma.chapter.findMany({
      where: { bookId },
    });

    const allDone = allChapters.every(c => c.content);
    if (allDone) {
      await this.prisma.book.update({
        where: { id: bookId },
        data: { status: 'COMPLETE' },
      });
    }

    return updatedChapter;
  }

  async updateChapterContent(bookId: string, chapterId: string, userId: string, content: string) {
    const book = await this.prisma.book.findFirst({ where: { id: bookId, userId } });
    if (!book) throw new Error('Book not found');
    return this.prisma.chapter.update({
      where: { id: chapterId },
      data: { content },
    });
  }

  async importBook(userId: string, data: {
    title: string;
    genre: string;
    audience: string;
    content: string;
    fileName: string;
  }) {
    const { title, genre, audience, content } = data;
    const chapterRegex = /(?:^|\n)(?:Chapter|CHAPTER|Ch\.?)\s*(\d+)[:\s]+([^\n]+)/gm;
    const matches = [...content.matchAll(chapterRegex)];
    let chapters: any[] = [];

    if (matches.length > 0) {
      for (let i = 0; i < matches.length; i++) {
        const start = matches[i].index! + matches[i][0].length;
        const end = matches[i + 1]?.index ?? content.length;
        chapters.push({
          number: parseInt(matches[i][1]),
          title: matches[i][2].trim(),
          content: `<p>${content.slice(start, end).trim().replace(/\n\n+/g, '</p><p>').replace(/\n/g, ' ')}</p>`,
        });
      }
    } else {
      chapters = [{
        number: 1,
        title: 'Chapter 1',
        content: `<p>${content.replace(/\n\n+/g, '</p><p>').replace(/\n/g, ' ')}</p>`,
      }];
    }

    const book = await this.prisma.book.create({
      data: {
        title,
        genre,
        tone: 'Engaging & Accessible',
        audience,
        language: 'English',
        status: 'COMPLETE',
        userId,
      },
    });

    for (const ch of chapters) {
      await this.prisma.chapter.create({
        data: {
          number: ch.number,
          title: ch.title,
          content: ch.content,
          bookId: book.id,
        },
      });
    }

    return book;
  }

  async deleteBook(id: string, userId: string) {
    return this.prisma.book.delete({
      where: { id, userId },
    });
  }

  async checkCanCreateAiBook(userId: string) {
    const balance = await this.paymentsService.getCreditBalance(userId);
    return {
      canCreate: balance >= 5,
      balance,
      cost: 5,
    };
  }
}