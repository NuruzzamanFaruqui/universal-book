import { Controller, Get, Post, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { SocialService } from './social.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('explore')
  async explore(@Query('page') page?: string) {
    return this.socialService.getExploreFeed(Number(page) || 1);
  }

  @Get('feed')
  @UseGuards(JwtAuthGuard)
  async getFeed(@Request() req: any, @Query('page') page?: string) {
    return this.socialService.getFeed(req.user.id, Number(page) || 1);
  }

  @Get('users/:userId/posts')
  async getUserPosts(@Param('userId') userId: string, @Query('page') page?: string) {
    return this.socialService.getUserPosts(userId, Number(page) || 1);
  }

  @Get('notifications')
  @UseGuards(JwtAuthGuard)
  async getNotifications(@Request() req: any) {
    return this.socialService.getNotifications(req.user.id);
  }

  @Get('notifications/unread-count')
  @UseGuards(JwtAuthGuard)
  async getUnreadCount(@Request() req: any) {
    return this.socialService.getUnreadNotificationCount(req.user.id);
  }

  @Post('notifications/read')
  @UseGuards(JwtAuthGuard)
  async markRead(@Request() req: any) {
    return this.socialService.markNotificationsRead(req.user.id);
  }

  @Get('connections')
  @UseGuards(JwtAuthGuard)
  async getConnections(@Request() req: any) {
    return this.socialService.getUserConnections(req.user.id);
  }

  @Get('connections/pending')
  @UseGuards(JwtAuthGuard)
  async getPendingRequests(@Request() req: any) {
    return this.socialService.getPendingRequests(req.user.id);
  }

  @Get('connections/status/:targetId')
  @UseGuards(JwtAuthGuard)
  async getConnectionStatus(@Param('targetId') targetId: string, @Request() req: any) {
    return this.socialService.getConnectionStatus(req.user.id, targetId);
  }

  @Post('connections/:userId')
  @UseGuards(JwtAuthGuard)
  async sendConnectionRequest(@Param('userId') userId: string, @Request() req: any) {
    return this.socialService.sendConnectionRequest(req.user.id, userId);
  }

  @Post('connections/:id/respond')
  @UseGuards(JwtAuthGuard)
  async respondToConnection(@Param('id') id: string, @Body() body: { status: 'ACCEPTED' | 'DECLINED' }, @Request() req: any) {
    return this.socialService.respondToConnection(req.user.id, id, body.status);
  }

  @Delete('connections/:id')
  @UseGuards(JwtAuthGuard)
  async removeConnection(@Param('id') id: string, @Request() req: any) {
    return this.socialService.removeConnection(req.user.id, id);
  }

  @Get('conversations')
  @UseGuards(JwtAuthGuard)
  async getConversations(@Request() req: any) {
    return this.socialService.getUserConversations(req.user.id);
  }

  @Get('conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  async getMessages(
    @Param('id') id: string,
    @Request() req: any,
    @Query('since') since?: string,
  ) {
    return this.socialService.getConversationMessages(id, req.user.id, since);
  }

  @Get('suggested-users')
  @UseGuards(JwtAuthGuard)
  async getSuggestedUsers(@Request() req: any) {
    return this.socialService.getSuggestedUsers(req.user.id);
  }

  @Get('trending')
  async getTrending() {
    return this.socialService.getTrendingHashtags();
  }

  @Post('posts')
  @UseGuards(JwtAuthGuard)
  async createPost(@Request() req: any, @Body() body: { content: string; bookId?: string; hashtags?: string[] }) {
    return this.socialService.createPost(req.user.id, body.content, body.bookId, body.hashtags);
  }

  @Post('posts/:id/like')
  @UseGuards(JwtAuthGuard)
  async likePost(@Param('id') id: string, @Request() req: any) {
    return this.socialService.likePost(req.user.id, id);
  }

  @Post('posts/:id/comment')
  @UseGuards(JwtAuthGuard)
  async commentPost(@Param('id') id: string, @Body() body: { content: string }, @Request() req: any) {
    return this.socialService.commentOnPost(req.user.id, id, body.content);
  }

  @Post('posts/:id/repost')
  @UseGuards(JwtAuthGuard)
  async repostPost(@Param('id') id: string, @Request() req: any) {
    return this.socialService.repostPost(req.user.id, id);
  }

  @Delete('posts/:id')
  @UseGuards(JwtAuthGuard)
  async deletePost(@Param('id') id: string, @Request() req: any) {
    return this.socialService.deletePost(req.user.id, id);
  }

  @Post('conversations')
  @UseGuards(JwtAuthGuard)
  async getOrCreateConversation(@Request() req: any, @Body() body: { userId: string }) {
    return this.socialService.getOrCreateConversation(req.user.id, body.userId);
  }

  @Post('conversations/:id/messages')
  @UseGuards(JwtAuthGuard)
  async sendMessage(@Param('id') id: string, @Body() body: { content: string }, @Request() req: any) {
    return this.socialService.sendDirectMessage(id, req.user.id, body.content);
  }
}
