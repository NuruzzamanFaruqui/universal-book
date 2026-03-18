import { Controller, Get, Post, Delete, Body, Param, Query, Request, UseGuards } from '@nestjs/common';
import { SocialService } from './social.service';
import { FirebaseGuard } from '../auth/firebase.guard';

@Controller('social')
export class SocialController {
  constructor(private readonly socialService: SocialService) {}

  @Get('explore')
  async explore(@Query('page') page?: string) {
    return this.socialService.getExploreFeed(Number(page) || 1);
  }

  @Get('feed')
  @UseGuards(FirebaseGuard)
  async getFeed(@Request() req: any, @Query('page') page?: string) {
    return this.socialService.getFeed(req.user.id, Number(page) || 1);
  }

  @Get('users/:userId/posts')
  async getUserPosts(@Param('userId') userId: string, @Query('page') page?: string) {
    return this.socialService.getUserPosts(userId, Number(page) || 1);
  }

  @Get('notifications')
  @UseGuards(FirebaseGuard)
  async getNotifications(@Request() req: any) {
    return this.socialService.getNotifications(req.user.id);
  }

  @Get('notifications/unread-count')
  @UseGuards(FirebaseGuard)
  async getUnreadCount(@Request() req: any) {
    return this.socialService.getUnreadNotificationCount(req.user.id);
  }

  @Post('notifications/read')
  @UseGuards(FirebaseGuard)
  async markRead(@Request() req: any) {
    return this.socialService.markNotificationsRead(req.user.id);
  }

  @Get('connections')
  @UseGuards(FirebaseGuard)
  async getConnections(@Request() req: any) {
    return this.socialService.getUserConnections(req.user.id);
  }

  @Get('connections/pending')
  @UseGuards(FirebaseGuard)
  async getPendingRequests(@Request() req: any) {
    return this.socialService.getPendingRequests(req.user.id);
  }

  @Get('connections/status/:targetId')
  @UseGuards(FirebaseGuard)
  async getConnectionStatus(@Param('targetId') targetId: string, @Request() req: any) {
    return this.socialService.getConnectionStatus(req.user.id, targetId);
  }

  @Post('connections/:userId')
  @UseGuards(FirebaseGuard)
  async sendConnectionRequest(@Param('userId') userId: string, @Request() req: any) {
    return this.socialService.sendConnectionRequest(req.user.id, userId);
  }

  @Post('connections/:id/respond')
  @UseGuards(FirebaseGuard)
  async respondToConnection(@Param('id') id: string, @Body() body: { status: 'ACCEPTED' | 'DECLINED' }, @Request() req: any) {
    return this.socialService.respondToConnection(req.user.id, id, body.status);
  }

  @Delete('connections/:id')
  @UseGuards(FirebaseGuard)
  async removeConnection(@Param('id') id: string, @Request() req: any) {
    return this.socialService.removeConnection(req.user.id, id);
  }

  @Get('conversations')
  @UseGuards(FirebaseGuard)
  async getConversations(@Request() req: any) {
    return this.socialService.getUserConversations(req.user.id);
  }

  @Get('conversations/:id/messages')
  @UseGuards(FirebaseGuard)
  async getMessages(@Param('id') id: string) {
    return this.socialService.getConversationMessages(id);
  }

  @Get('suggested-users')
  @UseGuards(FirebaseGuard)
  async getSuggestedUsers(@Request() req: any) {
    return this.socialService.getSuggestedUsers(req.user.id);
  }

  @Get('trending')
  async getTrending() {
    return this.socialService.getTrendingHashtags();
  }

  @Post('posts')
  @UseGuards(FirebaseGuard)
  async createPost(@Request() req: any, @Body() body: { content: string; bookId?: string; hashtags?: string[] }) {
    return this.socialService.createPost(req.user.id, body.content, body.bookId, body.hashtags);
  }

  @Post('posts/:id/like')
  @UseGuards(FirebaseGuard)
  async likePost(@Param('id') id: string, @Request() req: any) {
    return this.socialService.likePost(req.user.id, id);
  }

  @Post('posts/:id/comment')
  @UseGuards(FirebaseGuard)
  async commentPost(@Param('id') id: string, @Body() body: { content: string }, @Request() req: any) {
    return this.socialService.commentOnPost(req.user.id, id, body.content);
  }

  @Post('posts/:id/repost')
  @UseGuards(FirebaseGuard)
  async repostPost(@Param('id') id: string, @Request() req: any) {
    return this.socialService.repostPost(req.user.id, id);
  }

  @Delete('posts/:id')
  @UseGuards(FirebaseGuard)
  async deletePost(@Param('id') id: string, @Request() req: any) {
    return this.socialService.deletePost(req.user.id, id);
  }

  @Post('conversations')
  @UseGuards(FirebaseGuard)
  async getOrCreateConversation(@Request() req: any, @Body() body: { userId: string }) {
    return this.socialService.getOrCreateConversation(req.user.id, body.userId);
  }

  @Post('conversations/:id/messages')
  @UseGuards(FirebaseGuard)
  async sendMessage(@Param('id') id: string, @Body() body: { content: string }, @Request() req: any) {
    return this.socialService.sendDirectMessage(id, req.user.id, body.content);
  }
}
