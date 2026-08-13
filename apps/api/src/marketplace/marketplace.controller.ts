import { Controller, Get, Post, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { MarketplaceService } from './marketplace.service';
import { AddReviewDto, PublishBookDto } from './dto/marketplace.dto';
import { JwtAuthGuard, OptionalJwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('marketplace')
export class MarketplaceController {
  constructor(private readonly marketplaceService: MarketplaceService) {}

  @Get('books')
  async getBooks(@Query('genre') genre?: string, @Query('search') search?: string, @Query('page') page?: string) {
    return this.marketplaceService.getPublishedBooks(genre, search, Number(page) || 1);
  }

  @Get('featured')
  async getFeatured() { return this.marketplaceService.getFeaturedBooks(); }

  @Get('new-releases')
  async getNewReleases() { return this.marketplaceService.getNewReleases(); }

  @Get('activity')
  async getActivity() { return this.marketplaceService.getActivityFeed(); }

  @Get('top-writers')
  async getTopWriters() { return this.marketplaceService.getTopWriters(); }

  @Get('library')
  @UseGuards(JwtAuthGuard)
  async getLibrary(@Request() req: any) {
    return this.marketplaceService.getUserLibrary(req.user.id);
  }

  @Get('books/:bookId')
  @UseGuards(OptionalJwtAuthGuard)
  async getBook(@Param('bookId') bookId: string, @Request() req: any) {
    const userId = req.user?.id;
    const book = await this.marketplaceService.getPublishedBookById(bookId, userId);
    if (!book) throw new Error('Book not found or not published');
    return book;
  }

  @Get('writers/:writerId')
  async getWriter(@Param('writerId') writerId: string) {
    return this.marketplaceService.getWriterProfile(writerId);
  }

  @Post('books/:bookId/publish')
  @UseGuards(JwtAuthGuard)
  async publishBook(@Param('bookId') bookId: string, @Body() body: PublishBookDto, @Request() req: any) {
    return this.marketplaceService.publishBook(bookId, req.user.id, body.price);
  }

  @Post('books/:bookId/unpublish')
  @UseGuards(JwtAuthGuard)
  async unpublishBook(@Param('bookId') bookId: string, @Request() req: any) {
    return this.marketplaceService.unpublishBook(bookId, req.user.id);
  }

  @Post('books/:bookId/review')
  @UseGuards(JwtAuthGuard)
  async addReview(@Param('bookId') bookId: string, @Body() body: AddReviewDto, @Request() req: any) {
    return this.marketplaceService.addReview(bookId, req.user.id, body.rating, body.comment ?? '');
  }

  @Post('books/:bookId/follow')
  @UseGuards(JwtAuthGuard)
  async followBook(@Param('bookId') bookId: string, @Request() req: any) {
    return this.marketplaceService.followBook(req.user.id, bookId);
  }

  @Post('writers/:writerId/follow')
  @UseGuards(JwtAuthGuard)
  async followWriter(@Param('writerId') writerId: string, @Request() req: any) {
    return this.marketplaceService.followWriter(req.user.id, writerId);
  }
}