import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { PrismaService } from '../prisma.service';
import { StorageService } from '../storage/storage.service';

/**
 * How recently a heartbeat must have landed for a user to count as online.
 * Clients beat every 30s (see lib/presence.ts), so 75s tolerates one dropped
 * beat without flickering the indicator.
 */
export const PRESENCE_WINDOW_MS = 75_000;

/** Largest accepted profile photo. Mirrored in the account page. */
export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const PROFILE_PHOTO_PREFIX = 'profile-photos/';

/**
 * Identifies an image from its leading bytes. The client-sent MIME type and
 * filename are not trusted: whatever is stored is served publicly from our
 * bucket, so only formats a browser renders as an inert image are allowed
 * (no SVG, which can carry script).
 */
function sniffImage(buf: Buffer): { ext: string; contentType: string } | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return { ext: 'jpg', contentType: 'image/jpeg' };
  }
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', contentType: 'image/png' };
  }
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  if (buf.length >= 6 && /^GIF8[79]a$/.test(buf.toString('ascii', 0, 6))) {
    return { ext: 'gif', contentType: 'image/gif' };
  }
  return null;
}

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private storage: StorageService,
  ) {}

  async findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
    });
  }

  async updateUser(id: string, data: {
    name?: string;
    avatarUrl?: string;
    bio?: string;
    website?: string;
    location?: string;
  }) {
    return this.prisma.user.update({
      where: { id },
      data,
    });
  }

  async getUserWithBooks(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: {
        books: {
          orderBy: { createdAt: 'desc' },
        },
        followers: { select: { followerId: true } },
      },
    });
  }

  // ─── Profile photo ────────────────────────────────────────────────────────

  /**
   * Stores `image` in Cloud Storage under a fresh object name, points the
   * user's `profilePhoto` at it, then removes the photo it replaced. Returns
   * the new public URL.
   */
  async setProfilePhoto(userId: string, image: Buffer): Promise<string> {
    const type = sniffImage(image);
    if (!type) {
      throw new BadRequestException('Unsupported image. Use a JPEG, PNG, WebP or GIF file.');
    }

    // A new name per upload, so the immutable cache header never serves a
    // stale photo and the old URL keeps working until the swap below.
    const objectPath = `${PROFILE_PHOTO_PREFIX}${userId}/${randomUUID()}.${type.ext}`;
    const url = await this.storage.uploadPublic(objectPath, image, type.contentType);

    const previous = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { profilePhoto: true },
    });

    await this.prisma.user.update({
      where: { id: userId },
      data: { profilePhoto: url },
    });

    // Only ever deletes from this user's own folder in our bucket.
    await this.storage.deleteByUrl(previous?.profilePhoto, `${PROFILE_PHOTO_PREFIX}${userId}/`);

    return url;
  }

  // ─── Presence ─────────────────────────────────────────────────────────────
  // Clients beat while their tab is visible; anyone whose last beat falls
  // inside PRESENCE_WINDOW_MS counts as online. A time window degrades more
  // gracefully than an explicit disconnect signal, which is never sent when a
  // client simply drops off the network.

  async heartbeat(userId: string) {
    await this.prisma.user.update({
      where: { id: userId },
      data: { lastSeenAt: new Date() },
    });
    return { ok: true };
  }

  /**
   * Online status for a specific set of users. Returns a plain id → boolean map
   * so the client can look up without scanning.
   */
  async getPresence(userIds: string[]): Promise<Record<string, boolean>> {
    const ids = [...new Set(userIds)].filter(Boolean).slice(0, 200);
    if (!ids.length) return {};

    const cutoff = new Date(Date.now() - PRESENCE_WINDOW_MS);
    const online = await this.prisma.user.findMany({
      where: { id: { in: ids }, lastSeenAt: { gte: cutoff } },
      select: { id: true },
    });

    const onlineSet = new Set(online.map((u) => u.id));
    return Object.fromEntries(ids.map((id) => [id, onlineSet.has(id)]));
  }
}
