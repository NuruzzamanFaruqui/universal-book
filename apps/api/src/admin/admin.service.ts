import { Injectable } from '@nestjs/common';
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
    const [totalUsers, totalBooks, totalChapters] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.book.count(),
      this.prisma.chapter.count(),
    ]);
    return { totalUsers, totalBooks, totalChapters };
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

  async getAllSettings() {
    const settings = await this.prisma.setting.findMany();
    const result: any = {};
    settings.forEach(s => { result[s.key] = s.value; });
    return result;
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
      this.setSetting('STRIPE_SECRET_KEY', data.stripeSecretKey),
      this.setSetting('STRIPE_WEBHOOK_SECRET', data.stripeWebhookSecret),
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
      this.setSetting('ANTHROPIC_API_KEY', data.anthropicKey),
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
