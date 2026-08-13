import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getAllUsers() {
    return this.prisma.user.findMany({
      include: {
        books: {
          select: { id: true, title: true, status: true, createdAt: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllBooks() {
    return this.prisma.book.findMany({
      include: {
        chapters: { select: { id: true } },
        user: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async getUserById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { books: { include: { chapters: true } } },
    });
  }

  async updateUserPlan(id: string, plan: string) {
    return this.prisma.user.update({
      where: { id },
      data: { plan: plan as any },
    });
  }

  async deleteUser(id: string) {
    return this.prisma.user.delete({ where: { id } });
  }

  async getStats() {
    const since30d = new Date(Date.now() - 30 * 86_400_000);

    const [
      totalUsers,
      totalBooks,
      totalChapters,
      publishedBooks,
      allTime,
      last30d,
      aiSpend,
      topups,
      outstandingCredits,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.book.count(),
      this.prisma.chapter.count(),
      this.prisma.publishedBook.count({ where: { isPublic: true } }),
      // Every purchase already stores the split, so revenue is a sum, not a
      // recalculation — the two can never drift apart.
      this.prisma.bookPurchase.aggregate({
        _sum: { amount: true, platformFee: true, writerEarning: true, affiliateFee: true },
        _count: true,
      }),
      this.prisma.bookPurchase.aggregate({
        _sum: { amount: true, platformFee: true },
        _count: true,
        where: { createdAt: { gte: since30d } },
      }),
      this.prisma.creditTransaction.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { type: 'AI_BOOK_GENERATION' },
      }),
      this.prisma.creditTransaction.aggregate({
        _sum: { amount: true },
        _count: true,
        where: { type: 'TOPUP' },
      }),
      // What the platform still owes users, sitting in their balances.
      this.prisma.user.aggregate({ _sum: { creditBalance: true } }),
    ]);

    const round = (n: number | null | undefined) => Math.round((n ?? 0) * 100) / 100;

    return {
      totalUsers,
      totalBooks,
      totalChapters,
      publishedBooks,
      revenue: {
        grossSales: round(allTime._sum.amount),
        platformRevenue: round(allTime._sum.platformFee),
        paidToAuthors: round(allTime._sum.writerEarning),
        paidToAffiliates: round(allTime._sum.affiliateFee),
        salesCount: allTime._count,
        last30dGross: round(last30d._sum.amount),
        last30dPlatform: round(last30d._sum.platformFee),
        last30dSalesCount: last30d._count,
        // AI charges are stored negative; report the magnitude.
        aiGenerationRevenue: round(Math.abs(aiSpend._sum.amount ?? 0)),
        aiGenerationCount: aiSpend._count,
        creditsPurchased: round(topups._sum.amount),
        topupCount: topups._count,
        outstandingCreditLiability: round(outstandingCredits._sum.creditBalance),
      },
    };
  }

  // ─── Featured books ───────────────────────────────────────────────────────
  // `isFeatured` drives the homepage row. Until now nothing could set it, so
  // that row was permanently empty.

  async getPublishedBooks() {
    return this.prisma.publishedBook.findMany({
      include: {
        book: {
          select: {
            id: true,
            title: true,
            genre: true,
            coverUrl: true,
            user: { select: { name: true, email: true } },
          },
        },
      },
      orderBy: [{ isFeatured: 'desc' }, { publishedAt: 'desc' }],
    });
  }

  async setFeatured(bookId: string, isFeatured: boolean) {
    const published = await this.prisma.publishedBook.findUnique({ where: { bookId } });
    if (!published) throw new NotFoundException('That book is not published.');

    return this.prisma.publishedBook.update({
      where: { bookId },
      data: { isFeatured },
      select: { bookId: true, isFeatured: true },
    });
  }

  async getSetting(key: string) {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    return setting?.value || null;
  }

  async setSetting(key: string, value: string) {
    return this.prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
  }

  /** Setting keys whose values must never leave the server. */
  private static readonly SECRET_KEYS = new Set([
    'STRIPE_SECRET_KEY',
    'STRIPE_WEBHOOK_SECRET',
    'ANTHROPIC_API_KEY',
  ]);

  /** `sk_live_abcd…wxyz` — enough to recognise which key is stored, useless if intercepted. */
  private static mask(value: string): string {
    if (!value) return '';
    if (value.length <= 8) return '••••';
    return `${value.slice(0, 6)}••••${value.slice(-4)}`;
  }

  /**
   * Values for secret keys are masked. The admin UI only needs to show which
   * key is configured, never the key itself — returning it put live Stripe and
   * Anthropic credentials into the browser and every log along the way.
   */
  async getAllSettings() {
    const settings = await this.prisma.setting.findMany();
    const result: Record<string, string> = {};
    settings.forEach((s) => {
      result[s.key] = AdminService.SECRET_KEYS.has(s.key)
        ? AdminService.mask(s.value)
        : s.value;
    });
    return result;
  }

  /**
   * The UI is prefilled with masked secrets, so a plain save would write the
   * mask over the real key. Anything that still looks masked, or is blank, is
   * treated as "unchanged" and skipped.
   */
  private async setSecretIfChanged(key: string, value: string | undefined) {
    if (!value || value.includes('••••')) return;
    await this.setSetting(key, value);
  }

  async saveStripeSettings(data: {
    stripePublishableKey: string;
    stripeSecretKey: string;
    stripeWebhookSecret: string;
    authorPriceId: string;
    publisherPriceId: string;
  }) {
    await Promise.all([
      this.setSetting('STRIPE_PUBLISHABLE_KEY', data.stripePublishableKey),
      this.setSecretIfChanged('STRIPE_SECRET_KEY', data.stripeSecretKey),
      this.setSecretIfChanged('STRIPE_WEBHOOK_SECRET', data.stripeWebhookSecret),
      this.setSetting('STRIPE_AUTHOR_PRICE_ID', data.authorPriceId),
      this.setSetting('STRIPE_PUBLISHER_PRICE_ID', data.publisherPriceId),
    ]);
    return { message: 'Stripe settings saved successfully' };
  }

  async saveAiSettings(data: {
    anthropicKey: string;
    model: string;
    maxTokens: string;
  }) {
    await Promise.all([
      this.setSecretIfChanged('ANTHROPIC_API_KEY', data.anthropicKey),
      this.setSetting('AI_MODEL', data.model),
      this.setSetting('AI_MAX_TOKENS', data.maxTokens),
    ]);
    return { message: 'AI settings saved successfully' };
      }

      async getGenres() {
        const setting = await this.prisma.setting.findUnique({ where: { key: 'genres' } });
        if (!setting) return { genres: [] };
        return { genres: JSON.parse(setting.value) };
      }

      async saveGenres(genres: string[]) {
        await this.setSetting('genres', JSON.stringify(genres));
        return { message: 'Genres saved successfully' };
      }
    }
