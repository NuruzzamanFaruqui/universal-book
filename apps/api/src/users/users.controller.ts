import { Controller, Get, Put, Body, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { FirebaseGuard } from '../auth/firebase.guard';

@Controller('users')
@UseGuards(FirebaseGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@Request() req) {
    return this.usersService.getUserWithBooks(req.user.id);
  }

  @Put('me')
  async updateMe(@Request() req, @Body() body: { name?: string; avatarUrl?: string }) {
    return this.usersService.updateUser(req.user.id, body);
  }
}
