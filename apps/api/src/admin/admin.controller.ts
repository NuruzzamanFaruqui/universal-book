import { Controller, Get, Put, Post, Delete, Param, Body, UseGuards, UnauthorizedException, Request } from '@nestjs/common';
import { AdminService } from './admin.service';
import { FirebaseGuard } from '../auth/firebase.guard';

const ADMIN_EMAILS = ['faruqui.swe@diu.edu.bd', 'levin.kuhlmann@monash.edu'];

@Controller('admin')
@UseGuards(FirebaseGuard)
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  private checkAdmin(req: any) {
    const email = req.user?.email?.toLowerCase().trim();
    const isAdmin = ADMIN_EMAILS.some(a => a.toLowerCase() === email);
    if (!isAdmin) throw new UnauthorizedException('Admin access required');
  }

  @Get('stats')
  async getStats(@Request() req) {
    this.checkAdmin(req);
    return this.adminService.getStats();
  }

  @Get('users')
  async getAllUsers(@Request() req) {
    this.checkAdmin(req);
    return this.adminService.getAllUsers();
  }

  @Get('users/:id')
  async getUserById(@Param('id') id: string, @Request() req) {
    this.checkAdmin(req);
    return this.adminService.getUserById(id);
  }

  @Put('users/:id/plan')
  async updateUserPlan(@Param('id') id: string, @Body() body: { plan: string }, @Request() req) {
    this.checkAdmin(req);
    return this.adminService.updateUserPlan(id, body.plan);
  }

  @Delete('users/:id')
  async deleteUser(@Param('id') id: string, @Request() req) {
    this.checkAdmin(req);
    return this.adminService.deleteUser(id);
  }

  @Get('books')
  async getAllBooks(@Request() req) {
    this.checkAdmin(req);
    return this.adminService.getAllBooks();
  }

  @Get('settings')
  async getSettings(@Request() req) {
    this.checkAdmin(req);
    return this.adminService.getAllSettings();
  }

  @Post('settings/stripe')
  async saveStripeSettings(@Body() body: any, @Request() req) {
    this.checkAdmin(req);
    return this.adminService.saveStripeSettings(body);
  }

@Post('settings/ai')
  async saveAiSettings(@Body() body: any, @Request() req) {
    this.checkAdmin(req);
    return this.adminService.saveAiSettings(body);
  }

  @Get('settings/genres')
  async getGenres() {
    return this.adminService.getGenres();
  }

  @Post('settings/genres')
  async saveGenres(@Body() body: { genres: string[] }, @Request() req) {
    this.checkAdmin(req);
    return this.adminService.saveGenres(body.genres);
  }
}
