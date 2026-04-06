import {
  Controller, Get, Post, Put, Delete,
  Body, Param, Request, UseGuards,
} from '@nestjs/common';
import { BooksService } from './books.service';
import { FirebaseGuard } from '../auth/firebase.guard';
import { AiService } from '../ai/ai.service';

@Controller('books')
@UseGuards(FirebaseGuard)
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

  @Post()
  async createBook(@Request() req: any, @Body() body: any) {
    return this.booksService.createBook(req.user.id, body);
  }

  @Post('generate-titles')
  async generateTitles(@Body() body: { topic: string; description: string; genre: string; tone: string }) {
    return this.aiService.generateTitles(body.topic, body.description, body.genre, body.tone);
  }

  @Post('generate-outlines')
  async generateOutlines(@Body() body: { topic: string; description: string; genre: string; tone: string; audience: string; title: string; chaptersCount: number }) {
    return this.aiService.generateOutlines(body.topic, body.description, body.genre, body.tone, body.audience, body.title, body.chaptersCount);
  }

  @Post('generate-synopsis')
  async generateSynopsis(@Body() body: { topic: string; title: string; genre: string; tone: string; audience: string; outline: any }) {
    return this.aiService.generateSynopses(body.topic, body.title, body.genre, body.tone, body.audience, body.outline);
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

  @Put(':bookId/chapters/:chapterId')
  async updateChapter(
    @Param('bookId') bookId: string,
    @Param('chapterId') chapterId: string,
    @Body() body: { content: string },
    @Request() req: any,
  ) {
    return this.booksService.updateChapterContent(bookId, chapterId, req.user.id, body.content);
  }

  @Delete(':id')
  async deleteBook(@Param('id') id: string, @Request() req: any) {
    return this.booksService.deleteBook(id, req.user.id);
  }
}