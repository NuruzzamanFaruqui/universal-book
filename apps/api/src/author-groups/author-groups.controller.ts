import { Controller, Get, Post, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { AuthorGroupsService } from './author-groups.service';
import { FirebaseGuard } from '../auth/firebase.guard';

@Controller('author-groups')
@UseGuards(FirebaseGuard)
export class AuthorGroupsController {
  constructor(private readonly authorGroupsService: AuthorGroupsService) {}

  @Get('my')
  async getMyGroups(@Request() req: any) {
    return this.authorGroupsService.getUserAuthorGroups(req.user.id);
  }

  @Get(':id')
  async getGroup(@Param('id') id: string) {
    return this.authorGroupsService.getAuthorGroupById(id);
  }

  @Post()
  async createGroup(@Request() req: any, @Body() body: { name: string; description?: string; bookId?: string }) {
    return this.authorGroupsService.createAuthorGroup(req.user.id, body);
  }

  @Post(':id/invite')
  async inviteMember(@Param('id') id: string, @Body() body: { inviteeId: string; role?: string }, @Request() req: any) {
    return this.authorGroupsService.inviteMember(id, req.user.id, body.inviteeId, body.role);
  }

  @Post(':id/link-book')
  async linkBook(@Param('id') id: string, @Body() body: { bookId: string }, @Request() req: any) {
    return this.authorGroupsService.linkBook(id, req.user.id, body.bookId);
  }

  @Delete(':id/members/:memberId')
  async removeMember(@Param('id') id: string, @Param('memberId') memberId: string, @Request() req: any) {
    return this.authorGroupsService.removeMember(id, req.user.id, memberId);
  }

  @Delete(':id')
  async deleteGroup(@Param('id') id: string, @Request() req: any) {
    return this.authorGroupsService.deleteAuthorGroup(id, req.user.id);
  }
}
