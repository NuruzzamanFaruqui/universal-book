import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';

/** Seconds. Short by design — the refresh token is what carries the session. */
const ACCESS_TTL_SEC = Number(process.env.JWT_ACCESS_TTL_SEC || 900);
const REFRESH_TTL_DAYS = Number(process.env.JWT_REFRESH_TTL_DAYS || 30);
const RESET_TTL_MINUTES = 60;
const BCRYPT_ROUNDS = 12;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access-token lifetime in seconds, so the client can refresh pre-emptively. */
  expiresIn: number;
}

/** Fields safe to return to the client. Never include passwordHash. */
const PUBLIC_USER = {
  id: true,
  email: true,
  name: true,
  avatarUrl: true,
  profilePhoto: true,
  plan: true,
  creditBalance: true,
  isVerified: true,
  emailVerified: true,
  bio: true,
  createdAt: true,
} as const;

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private email: EmailService,
  ) {}

  // ─── Token helpers ────────────────────────────────────────────────────────

  private hashToken(raw: string): string {
    return createHash('sha256').update(raw).digest('hex');
  }

  private async issueTokens(userId: string, email: string, userAgent?: string): Promise<AuthTokens> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, email },
      { expiresIn: ACCESS_TTL_SEC },
    );

    const refreshToken = randomBytes(48).toString('hex');
    const expiresAt = new Date(Date.now() + REFRESH_TTL_DAYS * 86_400_000);

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(refreshToken),
        expiresAt,
        userAgent: userAgent?.slice(0, 250) ?? null,
      },
    });

    return { accessToken, refreshToken, expiresIn: ACCESS_TTL_SEC };
  }

  // ─── Register ─────────────────────────────────────────────────────────────

  async register(email: string, password: string, name: string | undefined, userAgent?: string) {
    const normalized = email.toLowerCase().trim();

    const existing = await this.prisma.user.findUnique({ where: { email: normalized } });
    if (existing) throw new ConflictException('An account with this email already exists.');

    const user = await this.prisma.user.create({
      data: {
        email: normalized,
        name: name?.trim() || null,
        passwordHash: await bcrypt.hash(password, BCRYPT_ROUNDS),
      },
      select: PUBLIC_USER,
    });

    const tokens = await this.issueTokens(user.id, user.email, userAgent);
    return { user, ...tokens };
  }

  // ─── Login ────────────────────────────────────────────────────────────────

  async login(email: string, password: string, userAgent?: string) {
    const normalized = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });

    // Same error for "no such user" and "wrong password" so the endpoint can't
    // be used to discover which addresses are registered.
    const invalid = new UnauthorizedException('Incorrect email or password.');
    if (!user) {
      // Equalise timing against the bcrypt.compare below.
      await bcrypt.hash(password, BCRYPT_ROUNDS);
      throw invalid;
    }

    if (!(await bcrypt.compare(password, user.passwordHash))) throw invalid;

    const tokens = await this.issueTokens(user.id, user.email, userAgent);
    const publicUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: PUBLIC_USER,
    });
    return { user: publicUser, ...tokens };
  }

  // ─── Refresh (with rotation and reuse detection) ──────────────────────────

  async refresh(rawToken: string, userAgent?: string): Promise<AuthTokens> {
    const tokenHash = this.hashToken(rawToken);
    const stored = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { select: { id: true, email: true } } },
    });

    if (!stored) throw new UnauthorizedException('Session expired. Please sign in again.');

    if (stored.revokedAt) {
      // A revoked token being presented again means it was captured and replayed
      // (or a stale tab raced a rotation). Drop every session for this user.
      this.logger.warn(`Refresh token reuse detected for user ${stored.userId}`);
      await this.revokeAllForUser(stored.userId);
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    if (stored.expiresAt < new Date()) {
      throw new UnauthorizedException('Session expired. Please sign in again.');
    }

    await this.prisma.refreshToken.update({
      where: { tokenHash },
      data: { revokedAt: new Date() },
    });

    return this.issueTokens(stored.user.id, stored.user.email, userAgent);
  }

  // ─── Logout ───────────────────────────────────────────────────────────────

  async logout(rawToken: string) {
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash: this.hashToken(rawToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async revokeAllForUser(userId: string) {
    await this.prisma.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  // ─── Password reset ───────────────────────────────────────────────────────

  /**
   * Always resolves the same way whether or not the address exists — the
   * response must not reveal whether an account is registered.
   */
  async forgotPassword(email: string) {
    const normalized = email.toLowerCase().trim();
    const user = await this.prisma.user.findUnique({ where: { email: normalized } });

    if (user) {
      const raw = await this.createResetToken(user.id, RESET_TTL_MINUTES * 60_000);
      await this.email.sendPasswordReset(user.email, user.name, raw);
    }

    return {
      message: 'If an account exists for that address, we have sent a password reset link.',
    };
  }

  private async createResetToken(userId: string, ttlMs: number): Promise<string> {
    // Invalidate any outstanding links so only the newest one works.
    await this.prisma.passwordResetToken.updateMany({
      where: { userId, usedAt: null },
      data: { usedAt: new Date() },
    });

    const raw = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: {
        userId,
        tokenHash: this.hashToken(raw),
        expiresAt: new Date(Date.now() + ttlMs),
      },
    });
    return raw;
  }

  async resetPassword(rawToken: string, newPassword: string) {
    const record = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: this.hashToken(rawToken) },
    });

    if (!record || record.usedAt || record.expiresAt < new Date()) {
      throw new BadRequestException('This reset link is invalid or has expired. Request a new one.');
    }

    await this.prisma.$transaction([
      this.prisma.passwordResetToken.update({
        where: { id: record.id },
        data: { usedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: {
          passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS),
          // Following the emailed link proves control of the address.
          emailVerified: true,
        },
      }),
      this.prisma.refreshToken.updateMany({
        where: { userId: record.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    return { message: 'Password updated. You can now sign in.' };
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Account not found.');

    if (!(await bcrypt.compare(currentPassword, user.passwordHash))) {
      throw new BadRequestException('Your current password is incorrect.');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await bcrypt.hash(newPassword, BCRYPT_ROUNDS) },
    });
    await this.revokeAllForUser(userId);

    return { message: 'Password changed. Other devices have been signed out.' };
  }

  // ─── Used by the guard ────────────────────────────────────────────────────

  async verifyAccessToken(token: string): Promise<{ sub: string; email: string }> {
    try {
      return await this.jwt.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Invalid or expired token.');
    }
  }

}
