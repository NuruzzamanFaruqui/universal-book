import { Body, Controller, Get, Param, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReadingProgressService } from './reading-progress.service';
import { SetChapterProgressDto } from './dto/reading-progress.dto';

/** Per-reader chapter progress. Every route needs a signed-in user. */
@Controller('reading-progress')
@UseGuards(JwtAuthGuard)
export class ReadingProgressController {
  constructor(private readonly readingProgressService: ReadingProgressService) {}

  /** Marks one chapter read or unread, then returns the whole book's progress. */
  @Put('books/:bookId/chapters/:chapterId')
  async setChapterProgress(
    @Param('bookId') bookId: string,
    @Param('chapterId') chapterId: string,
    @Body() body: SetChapterProgressDto,
    @Request() req: any,
  ) {
    return this.readingProgressService.markChapterRead(req.user.id, bookId, chapterId, body.isRead);
  }

  /** Progress for every purchased book, for the Library page. */
  @Get('library')
  async getLibraryProgress(@Request() req: any) {
    return this.readingProgressService.getLibraryProgress(req.user.id);
  }

  /** How many of the book's chapters this user has read, and which ones. */
  @Get('books/:bookId')
  async getBookProgress(@Param('bookId') bookId: string, @Request() req: any) {
    return this.readingProgressService.getBookProgress(req.user.id, bookId);
  }
}
