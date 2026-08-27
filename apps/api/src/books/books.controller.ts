import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Query, Request, UseGuards, NotFoundException,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AiService } from '../ai/ai.service';
import { Throttle } from '@nestjs/throttler';

/**
 * The wizard's three planning steps call Claude without charging credits, so
 * they are the cheapest way to spend someone else's Anthropic budget. Ten per
 * minute is well above real wizard use and far below a loop.
 */
const AI_LIMIT = { default: { ttl: 60_000, limit: 10 } };

@Controller('books')
@UseGuards(JwtAuthGuard)
export class BooksController {
  constructor(
    private readonly booksService: BooksService,
    private readonly aiService: AiService,
  ) {}

  @Get()
  async getAllBooks(@Request() req: any) {
    return this.booksService.getAllBooks(req.user.id);
  }

  @Get('can-create-ai-book')
  async canCreateAiBook(@Request() req: any) {
    return this.booksService.checkCanCreateAiBook(req.user.id);
  }

  @Get(':id')
  async getBook(@Param('id') id: string, @Request() req: any) {
    return this.booksService.getBookById(id, req.user.id);
  }

  /** Straight to a cursor — no wizard, no questions. */
  @Post('blank')
  async createBlank(@Request() req: any) {
    return this.booksService.createBlankBook(req.user.id);
  }

  @Post(':bookId/draft')
  @Throttle(AI_LIMIT)
  async draftIntoBook(
    @Param('bookId') bookId: string,
    @Body() body: { topic: string; genre?: string; tone?: string; audience?: string; chaptersCount?: number },
    @Request() req: any,
  ) {
    return this.booksService.draftIntoBook(bookId, req.user.id, body);
  }

  @Post()
  async createBook(@Request() req: any, @Body() body: any) {
    return this.booksService.createBook(req.user.id, body);
  }

  @Post('generate-titles')
  @Throttle(AI_LIMIT)
  async generateTitles(@Body() body: { topic: string; description: string; genre: string; tone: string }) {
    return this.aiService.generateTitles(body.topic, body.description, body.genre, body.tone);
  }

  @Post('generate-outlines')
  @Throttle(AI_LIMIT)
  async generateOutlines(@Body() body: { topic: string; description: string; genre: string; tone: string; audience: string; title: string; chaptersCount: number }) {
    return this.aiService.generateOutlines(body.topic, body.description, body.genre, body.tone, body.audience, body.title, body.chaptersCount);
  }

  @Post('generate-synopsis')
  @Throttle(AI_LIMIT)
  async generateSynopsis(@Body() body: { topic: string; title: string; genre: string; tone: string; audience: string; outline: any }) {
    return this.aiService.generateSynopses(body.topic, body.title, body.genre, body.tone, body.audience, body.outline);
  }

  /**
   * Selection-level assistance from the editor. Included in the book's cost —
   * it is Claude thinking, not a provider rendering pixels.
   */
  @Post('assist')
  @Throttle({ default: { ttl: 60_000, limit: 40 } })
  async assist(@Body() body: { action: string; text: string; bookTitle?: string; tone?: string; voiceSample?: string }) {
    const result = await this.aiService.assist(body.action, body.text, {
      bookTitle: body.bookTitle,
      tone: body.tone,
      voiceSample: body.voiceSample,
    });
    return { text: result };
  }

  @Post(':bookId/shape')
  @Throttle(AI_LIMIT)
  async shape(@Param('bookId') bookId: string, @Request() req: any) {
    return this.booksService.describeShape(bookId, req.user.id);
  }

  @Post('import')
  async importBook(@Request() req: any, @Body() body: { title: string; genre: string; audience: string; content: string; fileName: string }) {
    return this.booksService.importBook(req.user.id, body);
  }

  @Post(':bookId/chapters/:chapterId/generate')
  async generateChapter(
    @Param('bookId') bookId: string,
    @Param('chapterId') chapterId: string,
    @Request() req: any,
  ) {
    return this.booksService.generateChapterContent(bookId, chapterId, req.user.id);
  }

  @Put(':bookId')
  async updateBook(
    @Param('bookId') bookId: string,
    @Body() body: { title?: string; subtitle?: string; genre?: string; tone?: string; audience?: string; synopsis?: string },
    @Request() req: any,
  ) {
    return this.booksService.updateBook(bookId, req.user.id, body);
  }

  /** The Contents, derived from the manuscript on every read. */
  @Get(':bookId/contents')
  async contents(@Param('bookId') bookId: string, @Request() req: any) {
    const book = await this.booksService.getBookById(bookId, req.user.id);
    if (!book) throw new NotFoundException('Book not found');
    return { chapters: await this.booksService.buildContents(bookId) };
  }

  // ─── Conversation ─────────────────────────────────────────────────────────

  @Get(':bookId/chat')
  async getChat(@Param('bookId') bookId: string, @Request() req: any) {
    return { messages: await this.booksService.getChat(bookId, req.user.id) };
  }

  @Post(':bookId/chat')
  @Throttle({ default: { ttl: 60_000, limit: 30 } })
  async chat(
    @Param('bookId') bookId: string,
    @Body() body: { message: string; contextKind?: 'book' | 'chapter' | 'selection'; chapterId?: string; selection?: string },
    @Request() req: any,
  ) {
    return this.booksService.chat(bookId, req.user.id, body);
  }

  @Delete(':bookId/chat')
  async clearChat(@Param('bookId') bookId: string, @Request() req: any) {
    return this.booksService.clearChat(bookId, req.user.id);
  }

  @Post(':bookId/infer')
  @Throttle(AI_LIMIT)
  async infer(@Param('bookId') bookId: string, @Request() req: any) {
    return this.booksService.inferMetadata(bookId, req.user.id);
  }

  @Post(':bookId/review')
  @Throttle(AI_LIMIT)
  async review(@Param('bookId') bookId: string, @Request() req: any) {
    return this.booksService.reviewBook(bookId, req.user.id);
  }

  @Post(':bookId/matter')
  async matter(@Param('bookId') bookId: string, @Request() req: any) {
    return this.booksService.generateMatter(bookId, req.user.id);
  }

  // ─── Chapters ─────────────────────────────────────────────────────────────

  @Post(':bookId/chapters')
  async addChapter(
    @Param('bookId') bookId: string,
    @Body() body: { title?: string; afterId?: string },
    @Request() req: any,
  ) {
    return this.booksService.addChapter(bookId, req.user.id, body || {});
  }

  @Put(':bookId/chapters/order')
  async reorderChapters(
    @Param('bookId') bookId: string,
    @Body() body: { orderedIds: string[] },
    @Request() req: any,
  ) {
    return this.booksService.reorderChapters(bookId, req.user.id, body.orderedIds || []);
  }

  @Put(':bookId/chapters/:chapterId/title')
  async renameChapter(
    @Param('bookId') bookId: string,
    @Param('chapterId') chapterId: string,
    @Body() body: { title?: string; subtitle?: string },
    @Request() req: any,
  ) {
    return this.booksService.renameChapter(bookId, chapterId, req.user.id, body);
  }

  @Delete(':bookId/chapters/:chapterId')
  async deleteChapter(
    @Param('bookId') bookId: string,
    @Param('chapterId') chapterId: string,
    @Request() req: any,
  ) {
    return this.booksService.deleteChapter(bookId, chapterId, req.user.id);
  }

  /** Shapes the author's own notes into a chapter. Included, not billed. */
  @Post(':bookId/chapters/:chapterId/from-notes')
  @Throttle(AI_LIMIT)
  async draftFromNotes(
    @Param('bookId') bookId: string,
    @Param('chapterId') chapterId: string,
    @Body() body: { notes: string },
    @Request() req: any,
  ) {
    return this.booksService.draftFromNotes(bookId, chapterId, req.user.id, body.notes || '');
  }

  @Put(':bookId/chapters/:chapterId')
  async updateChapter(
    @Param('bookId') bookId: string,
    @Param('chapterId') chapterId: string,
    @Body() body: { content: string },
    @Request() req: any,
  ) {
    return this.booksService.updateChapterContent(bookId, chapterId, req.user.id, body.content);
  }

  // ─── Collaborative editing ────────────────────────────────────────────────

  /** Heartbeat + delta poll for the editor. See BooksService.syncChapter. */
  @Get(':bookId/chapters/:chapterId/sync')
  async syncChapter(
    @Param('bookId') bookId: string,
    @Param('chapterId') chapterId: string,
    @Request() req: any,
    @Query('since') since?: string,
  ) {
    return this.booksService.syncChapter(bookId, chapterId, req.user.id, since);
  }

  @Delete(':bookId/chapters/:chapterId/presence')
  async leaveChapter(@Param('chapterId') chapterId: string, @Request() req: any) {
    return this.booksService.leaveChapter(chapterId, req.user.id);
  }

  @Delete(':id')
  async deleteBook(@Param('id') id: string, @Request() req: any) {
    return this.booksService.deleteBook(id, req.user.id);
  }
}