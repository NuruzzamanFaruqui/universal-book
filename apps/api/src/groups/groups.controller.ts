import { Controller, Get, Post, Delete, Body, Param, Request, UseGuards } from '@nestjs/common';
import { GroupsService } from './groups.service';
import { FirebaseGuard } from '../auth/firebase.guard';

@Controller('groups')
export class GroupsController {
  constructor(private readonly groupsService: GroupsService) {}

  @Get()
  async getAllGroups() {
    return this.groupsService.getAllGroups();
  }

  @Get('my')
  @UseGuards(FirebaseGuard)
  async getMyGroups(@Request() req: any) {
    return this.groupsService.getUserGroups(req.user.id);
  }

  @Get(':id')
  async getGroup(@Param('id') id: string) {
    return this.groupsService.getGroupById(id);
  }

  @Get(':id/messages')
  async getMessages(@Param('id') id: string) {
    return this.groupsService.getMessages(id);
  }

  @Post()
  @UseGuards(FirebaseGuard)
  async createGroup(@Request() req: any, @Body() body: { name: string; description?: string; isPublic?: boolean }) {
    return this.groupsService.createGroup(req.user.id, body);
  }

  @Post(':id/join')
  @UseGuards(FirebaseGuard)
  async joinGroup(@Param('id') id: string, @Request() req: any) {
    return this.groupsService.joinGroup(req.user.id, id);
  }

  @Post(':id/messages')
  @UseGuards(FirebaseGuard)
  async sendMessage(@Param('id') id: string, @Body() body: { message: string }, @Request() req: any) {
    return this.groupsService.sendMessage(req.user.id, id, body.message);
  }

  @Delete(':id')
  @UseGuards(FirebaseGuard)
  async deleteGroup(@Param('id') id: string, @Request() req: any) {
    return this.groupsService.deleteGroup(req.user.id, id);
  }
}
