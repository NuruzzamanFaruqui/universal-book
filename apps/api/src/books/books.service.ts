import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AiService } from '../ai/ai.service';
import { PaymentsService } from '../payments/payments.service';
import { PRESENCE_WINDOW_MS } from '../users/users.service';

const strip = (html: string | null | undefined) =>
  (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
const countWords = (text: string) => (text.match(/\S+/g) || []).length;
const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/**
 * The scaffolding every book gets on creation.
 *
 * A first-time author does not know a book needs a copyright page, so these are
 * present from the start rather than waiting to be asked for. Each carries one
 * line saying what belongs there, and every one can be deleted — not every book
 * wants a foreword.
 */
const FRONT_MATTER: { slug: string; title: string; hint: string }[] = [
  { slug: 'half-title', title: 'Half Title',
    hint: 'Just the title, alone on a page. Traditional, and safe to delete.' },
  { slug: 'title-page', title: 'Title Page',
    hint: 'Title, subtitle and your name. Filled in from the book details.' },
  { slug: 'copyright', title: 'Copyright',
    hint: 'The legal page. Year, your name, rights reserved.' },
  { slug: 'dedication', title: 'Dedication',
    hint: 'One sentence, to someone who matters. Most authors write it last.' },
  { slug: 'epigraph', title: 'Epigraph',
    hint: 'A quotation that sets the tone. Optional.' },
  { slug: 'contents', title: 'Contents',
    hint: 'Built from your chapters and sections. Always current.' },
  { slug: 'foreword', title: 'Foreword',
    hint: 'Written by someone else, usually to lend credibility.' },
  { slug: 'preface', title: 'Preface',
    hint: 'Your own words on why you wrote this and who it is for.' },
  { slug: 'introduction', title: 'Introduction',
    hint: 'What the reader is about to get, and why it is worth their time.' },
];

const BACK_MATTER: { slug: string; title: string; hint: string }[] = [
  { slug: 'conclusion', title: 'Conclusion',
    hint: 'What you want the reader to leave with.' },
  { slug: 'appendix', title: 'Appendix',
    hint: 'Material that supports the book but would interrupt it.' },
  { slug: 'glossary', title: 'Glossary',
    hint: 'Terms your reader may not know.' },
  { slug: 'bibliography', title: 'Bibliography',
    hint: 'Sources and further reading.' },
  { slug: 'about-the-author', title: 'About the Author',
    hint: 'A short biography. Readers look for this before they buy.' },
  { slug: 'acknowledgements', title: 'Acknowledgements',
    hint: 'Thank the people who helped.' },
];

/** Fiction should never carry 1.1.1 headings; technical writing should. */
const UNNUMBERED_GENRES = [
  'fantasy', 'sci-fi', 'romance', 'thriller', 'mystery', 'horror',
  'literary fiction', 'poetry',
];
export const numberingForGenre = (genre: string) =>
  UNNUMBERED_GENRES.includes((genre || '').toLowerCase())
    ? { numbering: 'NONE' as const, sectionDepth: 0 }
    : { numbering: 'DECIMAL' as const, sectionDepth: 3 };

@Injectable()
export class BooksService {
  private readonly logger = new Logger(BooksService.name);

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

  /**
   * An empty book with one empty chapter, created without asking anything.
   *
   * Title, genre and tone stay blank on purpose — they are inferred from what
   * gets written and confirmed at publish. Nothing should stand between
   * "write a book" and a cursor.
   */
  async createBlankBook(userId: string) {
    return this.prisma.book.create({
      data: {
        title: '',
        genre: '',
        tone: '',
        language: 'English',
        status: 'DRAFT',
        userId,
        chapters: {
          create: [
            ...FRONT_MATTER.map((m, i) => ({
              number: i + 1,
              kind: 'FRONT_MATTER' as const,
              slug: m.slug,
              title: m.title,
              summary: m.hint,
              content: '',
            })),
            { number: 1, kind: 'CHAPTER' as const, title: '', content: '' },
            ...BACK_MATTER.map((m, i) => ({
              number: i + 1,
              kind: 'BACK_MATTER' as const,
              slug: m.slug,
              title: m.title,
              summary: m.hint,
              content: '',
            })),
          ],
        },
      },
      include: { chapters: { orderBy: { number: 'asc' } } },
    });
  }

  /**
   * The Contents, derived rather than stored.
   *
   * Previously this was written once as an HTML snapshot and never updated, so
   * it was wrong the moment a chapter was renamed. Now it is computed on read
   * from the chapters and the headings inside them.
   */
  async buildContents(bookId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { numbering: true, sectionDepth: true },
    });
    const chapters = await this.prisma.chapter.findMany({
      where: { bookId, kind: 'CHAPTER' },
      orderBy: { number: 'asc' },
      select: { id: true, number: true, title: true, subtitle: true, content: true },
    });

    const numbered = book?.numbering === 'DECIMAL';
    const depth = book?.sectionDepth ?? 3;

    return chapters.map((c) => ({
      id: c.id,
      number: c.number,
      title: c.title || 'Untitled chapter',
      subtitle: c.subtitle || null,
      sections: depth > 0 ? headingsOf(c.content, c.number, depth, numbered) : [],
    }));
  }

  /**
   * Turns an existing book into an AI-drafted one: charges, builds an outline
   * from a topic, and replaces any empty chapters with the outline's.
   *
   * Chapter bodies are written afterwards one at a time through the existing
   * per-chapter endpoint, so the author watches progress instead of staring at
   * a spinner for two minutes.
   */
  async draftIntoBook(bookId: string, userId: string, data: {
    topic: string; genre?: string; tone?: string; audience?: string; chaptersCount?: number;
  }) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      include: { chapters: true },
    });
    if (!book) throw new NotFoundException('Book not found');

    const written = book.chapters.filter(
      (c) => c.kind === 'CHAPTER' && (c.content || '').trim().length > 0,
    );
    if (written.length) {
      throw new BadRequestException(
        'This book already has writing in it. Start a new book to have AI draft one from scratch.',
      );
    }

    await this.paymentsService.chargeForAiGeneration(userId);
    let charged = true;

    try {
      const outline = await this.aiService.generateOutline(
        data.topic,
        data.genre || 'General',
        data.tone || 'Engaging & Accessible',
        data.audience || 'General readers',
        Math.min(Math.max(data.chaptersCount || 8, 1), 30),
      );

      const updated = await this.prisma.$transaction(async (tx) => {
        // Only the chapters — front and back matter the author already has stay.
        await tx.chapter.deleteMany({ where: { bookId, kind: 'CHAPTER' } });
        return tx.book.update({
          where: { id: bookId },
          data: {
            title: outline.title || data.topic,
            subtitle: outline.subtitle || null,
            synopsis: outline.synopsis || null,
            genre: data.genre || book.genre || '',
            tone: data.tone || book.tone || 'Engaging & Accessible',
            audience: data.audience || book.audience || 'General readers',
            status: 'GENERATING',
            chapters: {
              create: (outline.chapters || []).map((ch: any, i: number) => ({
                number: i + 1,
                kind: 'CHAPTER' as const,
                title: ch.title,
                summary: ch.summary || ch.description || '',
              })),
            },
          },
          include: { chapters: { orderBy: { number: 'asc' } } },
        });
      });

      charged = false;
      return updated;
    } finally {
      if (charged) {
        await this.paymentsService
          .refundAiGeneration(userId, 'outline generation failed')
          .catch((e) => this.logger.error(`Refund failed for ${userId}: ${e.message}`));
      }
    }
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
    // Charged up front so a user cannot start work they cannot pay for; the
    // whole generation is wrapped below so a failure refunds it rather than
    // silently keeping the money.
    await this.paymentsService.chargeForAiGeneration(userId);
    let charged = true;

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

    try {
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

    charged = false;
    return book;
    } finally {
      if (charged) {
        await this.paymentsService
          .refundAiGeneration(userId, 'book generation failed')
          .catch((e) => this.logger.error(`Refund failed for ${userId}: ${e.message}`));
      }
    }
  }

  // ─── Chapters ─────────────────────────────────────────────────────────────

  /** Ownership or author-group membership, for operations on the book itself. */
  private async assertCanEditBook(bookId: string, userId: string) {
    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { id: true, userId: true },
    });
    if (!book) throw new NotFoundException('Book not found');
    if (book.userId === userId) return;

    const collaborator = await this.prisma.authorGroup.findFirst({
      where: { bookId, members: { some: { userId } } },
      select: { id: true },
    });
    if (!collaborator) throw new ForbiddenException('You do not have edit access to this book');
  }

  async addChapter(bookId: string, userId: string, data: { title?: string; afterId?: string }) {
    await this.assertCanEditBook(bookId, userId);

    return this.prisma.$transaction(async (tx) => {
      const chapters = await tx.chapter.findMany({
        where: { bookId, kind: 'CHAPTER' },
        orderBy: { number: 'asc' },
        select: { id: true, number: true },
      });

      // Insert after a given chapter, or append.
      const at = data.afterId
        ? (chapters.findIndex((c) => c.id === data.afterId) + 1) || chapters.length
        : chapters.length;

      // Shift everything below down one, highest first so the unique ordering
      // never collides mid-update.
      for (const c of chapters.slice(at).reverse()) {
        await tx.chapter.update({ where: { id: c.id }, data: { number: c.number + 1 } });
      }

      return tx.chapter.create({
        data: {
          bookId,
          kind: 'CHAPTER',
          number: at + 1,
          title: data.title?.trim() || '',
          content: '',
        },
      });
    });
  }

  async renameChapter(
    bookId: string, chapterId: string, userId: string,
    data: { title?: string; subtitle?: string },
  ) {
    await this.assertCanEditBook(bookId, userId);
    const chapter = await this.prisma.chapter.findFirst({ where: { id: chapterId, bookId } });
    if (!chapter) throw new NotFoundException('Chapter not found');

    return this.prisma.chapter.update({
      where: { id: chapterId },
      data: {
        ...(data.title !== undefined && { title: data.title.trim().slice(0, 300) }),
        ...(data.subtitle !== undefined && { subtitle: data.subtitle.trim().slice(0, 300) || null }),
      },
    });
  }

  async deleteChapter(bookId: string, chapterId: string, userId: string) {
    await this.assertCanEditBook(bookId, userId);

    return this.prisma.$transaction(async (tx) => {
      const chapter = await tx.chapter.findFirst({ where: { id: chapterId, bookId } });
      if (!chapter) throw new NotFoundException('Chapter not found');

      const siblings = await tx.chapter.count({ where: { bookId, kind: chapter.kind } });
      if (chapter.kind === 'CHAPTER' && siblings <= 1) {
        throw new BadRequestException('A book needs at least one chapter.');
      }

      await tx.chapter.delete({ where: { id: chapterId } });

      // Close the gap so numbering stays 1..n.
      const rest = await tx.chapter.findMany({
        where: { bookId, kind: chapter.kind, number: { gt: chapter.number } },
        orderBy: { number: 'asc' },
        select: { id: true, number: true },
      });
      for (const c of rest) {
        await tx.chapter.update({ where: { id: c.id }, data: { number: c.number - 1 } });
      }
      return { deleted: chapterId };
    });
  }

  /** Whole-list reorder — the client sends the ids in their new order. */
  async reorderChapters(bookId: string, userId: string, orderedIds: string[]) {
    await this.assertCanEditBook(bookId, userId);

    return this.prisma.$transaction(async (tx) => {
      const chapters = await tx.chapter.findMany({
        where: { bookId, kind: 'CHAPTER' },
        select: { id: true },
      });
      const known = new Set(chapters.map((c) => c.id));
      const ids = orderedIds.filter((id) => known.has(id));
      if (ids.length !== chapters.length) {
        throw new BadRequestException('The chapter list does not match this book.');
      }

      // Park everything above the range first: `number` collides otherwise.
      for (const [i, id] of ids.entries()) {
        await tx.chapter.update({ where: { id }, data: { number: 10_000 + i } });
      }
      for (const [i, id] of ids.entries()) {
        await tx.chapter.update({ where: { id }, data: { number: i + 1 } });
      }

      return tx.chapter.findMany({
        where: { bookId, kind: 'CHAPTER' },
        orderBy: { number: 'asc' },
      });
    });
  }

  /**
   * Drafts a chapter from material the author already has — notes, a transcript,
   * a rough outline. The point is that the substance is theirs; Claude only
   * gives it shape, so the result is not the generic prose a topic string
   * produces.
   */
  async draftFromNotes(bookId: string, chapterId: string, userId: string, notes: string) {
    await this.assertCanEditChapter(bookId, chapterId, userId);
    if (notes.trim().length < 40) {
      throw new BadRequestException('Give me a little more to work with — a few lines at least.');
    }

    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { title: true, tone: true, audience: true },
    });
    const chapter = await this.prisma.chapter.findUnique({
      where: { id: chapterId },
      select: { title: true },
    });

    const html = await this.aiService.draftFromNotes({
      notes: notes.slice(0, 20000),
      bookTitle: book?.title || 'Untitled',
      chapterTitle: chapter?.title || '',
      tone: book?.tone || '',
      audience: book?.audience || '',
    });

    return this.prisma.chapter.update({
      where: { id: chapterId },
      data: { content: html, updatedById: userId },
    });
  }

  // ─── Conversation ─────────────────────────────────────────────────────────

  async getChat(bookId: string, userId: string) {
    await this.assertCanEditBook(bookId, userId);
    return this.prisma.bookChatMessage.findMany({
      where: { bookId },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: { id: true, role: true, content: true, contextKind: true, createdAt: true },
    });
  }

  async clearChat(bookId: string, userId: string) {
    await this.assertCanEditBook(bookId, userId);
    await this.prisma.bookChatMessage.deleteMany({ where: { bookId } });
    return { cleared: true };
  }

  /**
   * One turn of conversation about the book.
   *
   * The context the model sees is chosen by the author — the selected passage,
   * the open chapter, or the whole manuscript — so a question about one
   * paragraph is not answered from 40,000 words of unrelated text.
   */
  async chat(bookId: string, userId: string, input: {
    message: string;
    contextKind?: 'book' | 'chapter' | 'selection';
    chapterId?: string;
    selection?: string;
  }) {
    await this.assertCanEditBook(bookId, userId);

    const question = (input.message || '').trim();
    if (!question) throw new BadRequestException('Ask me something first.');

    const book = await this.prisma.book.findUnique({
      where: { id: bookId },
      select: { title: true, subtitle: true, genre: true, tone: true, audience: true },
    });

    const kind = input.contextKind || 'book';
    let context = '';
    let contextLabel = 'this book';

    if (kind === 'selection' && input.selection?.trim()) {
      context = input.selection.slice(0, 6000);
      contextLabel = 'the passage the author has selected';
    } else if (kind === 'chapter' && input.chapterId) {
      const chapter = await this.prisma.chapter.findFirst({
        where: { id: input.chapterId, bookId },
        select: { number: true, title: true, content: true },
      });
      if (chapter) {
        context = `Chapter ${chapter.number}: ${chapter.title}\n${strip(chapter.content)}`.slice(0, 12000);
        contextLabel = `chapter ${chapter.number} of this book`;
      }
    } else {
      const chapters = await this.prisma.chapter.findMany({
        where: { bookId, kind: 'CHAPTER' },
        orderBy: { number: 'asc' },
        select: { number: true, title: true, content: true },
      });
      // Enough of each chapter to reason across the book without sending all of it.
      context = chapters
        .map((c) => `Chapter ${c.number}: ${c.title}\n${strip(c.content).slice(0, 1500)}`)
        .join('\n\n')
        .slice(0, 20000);
      contextLabel = 'the whole manuscript so far';
    }

    const history = await this.prisma.bookChatMessage.findMany({
      where: { bookId },
      orderBy: { createdAt: 'asc' },
      take: 40,
      select: { role: true, content: true },
    });

    const reply = await this.aiService.chatAboutBook({
      question,
      history,
      bookTitle: book?.title || 'Untitled',
      context,
      contextLabel,
    });

    // Only recorded once the model has answered — a failed turn should not
    // leave a dangling question in the thread.
    const [, assistant] = await this.prisma.$transaction([
      this.prisma.bookChatMessage.create({
        data: { bookId, userId, role: 'USER', content: question, contextKind: kind, chapterId: input.chapterId ?? null },
      }),
      this.prisma.bookChatMessage.create({
        data: { bookId, userId, role: 'ASSISTANT', content: reply, contextKind: kind, chapterId: input.chapterId ?? null },
      }),
    ]);

    return assistant;
  }

  // ─── Book metadata ────────────────────────────────────────────────────────

  async updateBook(bookId: string, userId: string, data: {
    title?: string; subtitle?: string; genre?: string; tone?: string;
    audience?: string; synopsis?: string;
    numbering?: 'NONE' | 'DECIMAL'; sectionDepth?: number;
  }) {
    const book = await this.prisma.book.findFirst({ where: { id: bookId, userId } });
    if (!book) throw new NotFoundException('Book not found');

    return this.prisma.book.update({
      where: { id: bookId },
      data: {
        ...(data.title !== undefined && { title: data.title.slice(0, 300) }),
        ...(data.subtitle !== undefined && { subtitle: data.subtitle || null }),
        ...(data.genre !== undefined && { genre: data.genre }),
        ...(data.tone !== undefined && { tone: data.tone }),
        ...(data.audience !== undefined && { audience: data.audience || null }),
        ...(data.synopsis !== undefined && { synopsis: data.synopsis || null }),
        ...(data.numbering !== undefined && { numbering: data.numbering }),
        ...(data.sectionDepth !== undefined && {
          sectionDepth: Math.min(3, Math.max(0, data.sectionDepth)),
        }),
      },
    });
  }

  /** Everything the author never had to fill in, read back out of the writing. */
  async inferMetadata(bookId: string, userId: string) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      include: { chapters: { where: { kind: 'CHAPTER' }, orderBy: { number: 'asc' } } },
    });
    if (!book) throw new NotFoundException('Book not found');

    const sample = book.chapters
      .map((c) => `${c.title}\n${strip(c.content)}`)
      .join('\n\n')
      .slice(0, 12000);

    if (sample.replace(/\s/g, '').length < 200) {
      throw new BadRequestException('Write a little more first — there is not enough here to read yet.');
    }

    const inferred = await this.aiService.inferMetadata(sample);

    // Only fill blanks; never overwrite something the author chose. Learning
    // the genre also settles whether this book numbers its sections — 1.1.1 in
    // a novel would be absurd.
    const style = book.genre ? null : numberingForGenre(inferred.genre || '');
    await this.prisma.book.update({
      where: { id: bookId },
      data: {
        ...(book.genre ? {} : { genre: inferred.genre || '' }),
        ...(book.audience ? {} : { audience: inferred.audience || null }),
        ...(book.tone ? {} : { tone: inferred.tone || '' }),
        ...(style ?? {}),
      },
    });

    return inferred;
  }

  /** Continuity, pacing and voice across the whole manuscript. */
  async reviewBook(bookId: string, userId: string) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      include: { chapters: { where: { kind: 'CHAPTER' }, orderBy: { number: 'asc' } } },
    });
    if (!book) throw new NotFoundException('Book not found');

    const chapters = book.chapters.map((c) => {
      const plain = strip(c.content);
      return { number: c.number, title: c.title, words: countWords(plain), text: plain };
    });

    if (chapters.every((c) => c.words === 0)) {
      throw new BadRequestException('Nothing to review yet — write a chapter first.');
    }

    const review = await this.aiService.reviewManuscript(book.title || 'Untitled', chapters);

    // Pacing is arithmetic, not judgement — compute it rather than ask.
    const written = chapters.filter((c) => c.words > 0);
    const avg = written.reduce((a, c) => a + c.words, 0) / (written.length || 1);
    const outliers = written
      .filter((c) => c.words < avg * 0.4 || c.words > avg * 2)
      .map((c) => ({ number: c.number, title: c.title, words: c.words }));

    return {
      ...review,
      pacing: { averageWords: Math.round(avg), chapters: written.length, outliers },
    };
  }

  // ─── Front and back matter ────────────────────────────────────────────────

  /**
   * The parts of a book a first-time author does not know exist. Generated as
   * editable templates rather than AI prose — they are structural, and the
   * author's own details are already on file.
   */
  async generateMatter(bookId: string, userId: string) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      include: { chapters: true, user: { select: { name: true, bio: true } } },
    });
    if (!book) throw new NotFoundException('Book not found');

    const existing = new Set(
      book.chapters.filter((c) => c.kind !== 'CHAPTER').map((c) => c.title),
    );
    const author = book.user.name || 'the author';
    const year = new Date().getFullYear();
    const chapters = book.chapters
      .filter((c) => c.kind === 'CHAPTER')
      .sort((a, b) => a.number - b.number);

    const front = [
      {
        title: 'Title Page',
        content: `<h1>${escapeHtml(book.title || 'Untitled')}</h1>` +
          (book.subtitle ? `<p><em>${escapeHtml(book.subtitle)}</em></p>` : '') +
          `<p>${escapeHtml(author)}</p>`,
      },
      {
        title: 'Copyright',
        content:
          `<p>Copyright © ${year} ${escapeHtml(author)}. All rights reserved.</p>` +
          '<p>No part of this book may be reproduced in any form without written permission ' +
          'from the author, except brief quotations in a review.</p>' +
          '<p>Published on Universal Book.</p>',
      },
    ];

    const back = [
      {
        title: 'About the Author',
        content: book.user.bio
          ? `<p>${escapeHtml(book.user.bio)}</p>`
          : `<p>${escapeHtml(author)} wrote this book. Add a few lines here about who you are ` +
            'and why you wrote it — readers look for this.</p>',
      },
      {
        title: 'Acknowledgements',
        content: '<p>Thank the people who helped you write this.</p>',
      },
    ];

    const created = await this.prisma.$transaction(async (tx) => {
      const rows: any[] = [];
      for (const [i, m] of front.entries()) {
        if (existing.has(m.title)) continue;
        rows.push(await tx.chapter.create({
          data: { bookId, kind: 'FRONT_MATTER', number: i + 1, title: m.title, content: m.content },
        }));
      }
      for (const [i, m] of back.entries()) {
        if (existing.has(m.title)) continue;
        rows.push(await tx.chapter.create({
          data: { bookId, kind: 'BACK_MATTER', number: i + 1, title: m.title, content: m.content },
        }));
      }
      return rows;
    });

    return { created: created.length, sections: created };
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
      where: { bookId, kind: 'CHAPTER' },
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

  /**
   * Who may write to a chapter: the book's owner, or a member of an author
   * group linked to that book.
   */
  private async assertCanEditChapter(bookId: string, chapterId: string, userId: string) {
    const chapter = await this.prisma.chapter.findFirst({
      where: { id: chapterId, bookId },
      select: { id: true, book: { select: { userId: true } } },
    });
    if (!chapter) throw new NotFoundException('Chapter not found');
    if (chapter.book.userId === userId) return;

    const collaborator = await this.prisma.authorGroup.findFirst({
      where: { bookId, members: { some: { userId } } },
      select: { id: true },
    });
    if (!collaborator) throw new ForbiddenException('You do not have edit access to this book');
  }

  async updateChapterContent(bookId: string, chapterId: string, userId: string, content: string) {
    await this.assertCanEditChapter(bookId, chapterId, userId);
    return this.prisma.chapter.update({
      where: { id: chapterId },
      data: { content, updatedById: userId },
    });
  }

  // ─── Collaborative editing ────────────────────────────────────────────────
  // Last-writer-wins on the whole chapter body. Clients debounce their writes
  // and poll for changes from others.

  /**
   * Poll target for the editor. Records the caller's presence, then returns the
   * chapter body only when someone *else* has changed it since `since`, so a
   * client never has its own in-flight edit echoed back over the cursor.
   */
  async syncChapter(bookId: string, chapterId: string, userId: string, since?: string) {
    await this.assertCanEditChapter(bookId, chapterId, userId);

    // Refresh presence only once it is halfway to expiring. Writing on every
    // poll meant one database write per editor every few seconds, purely to
    // restate something already true.
    const now = new Date();
    const staleBefore = new Date(now.getTime() - PRESENCE_WINDOW_MS / 2);
    const refreshed = await this.prisma.editorPresence.updateMany({
      where: { userId, chapterId, lastSeenAt: { lt: staleBefore } },
      data: { lastSeenAt: now },
    });
    if (refreshed.count === 0) {
      await this.prisma.editorPresence.upsert({
        where: { userId_chapterId: { userId, chapterId } },
        create: { userId, chapterId, lastSeenAt: now },
        update: {},
      });
    }

    const cutoff = new Date(Date.now() - PRESENCE_WINDOW_MS);
    const [chapter, present] = await Promise.all([
      this.prisma.chapter.findUnique({
        where: { id: chapterId },
        select: { content: true, updatedAt: true, updatedById: true },
      }),
      this.prisma.editorPresence.findMany({
        where: { chapterId, lastSeenAt: { gte: cutoff } },
        select: {
          userId: true,
          user: { select: { name: true, avatarUrl: true, profilePhoto: true } },
        },
      }),
    ]);

    const activeUsers = present.map((p) => ({
      userId: p.userId,
      name: p.user.name || 'Anonymous',
      avatarUrl: p.user.profilePhoto || p.user.avatarUrl || null,
    }));

    const sinceDate = since ? new Date(since) : null;
    const isStale =
      sinceDate && !isNaN(sinceDate.getTime())
        ? chapter!.updatedAt > sinceDate
        : true;
    const isOwnEdit = chapter!.updatedById === userId;

    return {
      activeUsers,
      updatedAt: chapter!.updatedAt,
      updatedById: chapter!.updatedById,
      // Null means "you're already current" — the client leaves the DOM alone.
      content: isStale && !isOwnEdit ? chapter!.content : null,
    };
  }

  async leaveChapter(chapterId: string, userId: string) {
    await this.prisma.editorPresence.deleteMany({ where: { userId, chapterId } });
    return { ok: true };
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

  /** Feeds the manuscript to the AI and returns its read of the structure. */
  async describeShape(bookId: string, userId: string) {
    const book = await this.prisma.book.findFirst({
      where: { id: bookId, userId },
      include: { chapters: { orderBy: { number: 'asc' } } },
    });
    if (!book) throw new NotFoundException('Book not found');

    const chapters = book.chapters.map((c) => {
      const plain = (c.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      return {
        number: c.number,
        title: c.title,
        words: plain ? plain.split(' ').length : 0,
        excerpt: plain,
      };
    });

    return this.aiService.describeShape(book.title, chapters);
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
/**
 * Pulls the headings out of a chapter body and numbers them by position.
 *
 * Numbers are derived, never stored — move a chapter and everything below
 * renumbers itself with no migration and nothing to keep in sync.
 */
function headingsOf(html: string | null | undefined, chapterNumber: number, depth: number, numbered: boolean) {
  const out: { level: number; label: string; title: string; id: string }[] = [];
  if (!html) return out;

  const counters = [0, 0, 0];
  const re = /<h([234])(?:\s[^>]*?id="([^"]*)")?[^>]*>([\s\S]*?)<\/h\1>/gi;

  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const level = Number(m[1]) - 1;          // h2 → 1, h3 → 2, h4 → 3
    if (level > depth) continue;

    counters[level - 1] += 1;
    for (let i = level; i < counters.length; i++) counters[i] = 0;

    const title = m[3].replace(/<[^>]+>/g, '').trim();
    if (!title) continue;

    const label = numbered
      ? [chapterNumber, ...counters.slice(0, level)].join('.')
      : '';

    out.push({ level, label, title, id: m[2] || '' });
  }
  return out;
}
