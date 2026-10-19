import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Put,
  Query,
  Request,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { UsersService, PROFILE_PHOTO_MAX_BYTES } from './users.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/** Shape of a multer file held in memory (avoids a dependency on @types/multer). */
interface UploadedImage {
  buffer: Buffer;
  size: number;
  mimetype: string;
  originalname: string;
}

/** Uploads write to Cloud Storage; ten a minute is plenty for a person. */
const PHOTO_LIMIT = { default: { ttl: 60_000, limit: 10 } };

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

  // ─── Profile photo ────────────────────────────────────────────────────────

  /**
   * `multipart/form-data` with the image in a field named `file`.
   * JPEG, PNG, WebP or GIF, up to 5 MB. Responds `{ profilePhoto: <public URL> }`.
   */
  @Post('me/photo')
  @HttpCode(200)
  @Throttle(PHOTO_LIMIT)
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: PROFILE_PHOTO_MAX_BYTES, files: 1 },
    }),
  )
  async uploadPhoto(@Request() req: any, @UploadedFile() file?: UploadedImage) {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Attach an image in the "file" field.');
    }
    const profilePhoto = await this.usersService.setProfilePhoto(req.user.id, file.buffer);
    return { profilePhoto };
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
