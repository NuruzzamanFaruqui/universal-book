import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * How recently a heartbeat must have landed for a user to count as online.
 * Clients beat every 30s (see lib/presence.ts), so 75s tolerates one dropped
 * beat without flickering the indicator.
 */
export const PRESENCE_WINDOW_MS = 75_000;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

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
      },
    });
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
