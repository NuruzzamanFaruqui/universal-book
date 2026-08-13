import { Body, Controller, Get, HttpCode, Post, Put, Query, Request, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('me')
  async getMe(@Request() req: any) {
    return this.usersService.getUserWithBooks(req.user.id);
  }

  @Put('me')
  async updateMe(
    @Request() req: any,
    @Body() body: { name?: string; avatarUrl?: string; bio?: string; website?: string; location?: string },
  ) {
    return this.usersService.updateUser(req.user.id, body);
  }

  // ─── Presence ─────────────────────────────────────────────────────────────

  /** Called by the client every 30s while a tab is visible. */
  @Post('heartbeat')
  @HttpCode(200)
  async heartbeat(@Request() req: any) {
    return this.usersService.heartbeat(req.user.id);
  }

  /** `?ids=a,b,c` → `{ a: true, b: false, c: false }` */
  @Get('presence')
  async presence(@Query('ids') ids?: string) {
    return this.usersService.getPresence((ids || '').split(',').map((s) => s.trim()));
  }
}
