import { Injectable, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma.service';
import { randomBytes } from 'crypto';

const PLATFORM_FEE_PERCENT = 0.30;
const AFFILIATE_PERCENT = 0.10; // 10% of author's earnings
const AI_BOOK_COST = 5.00; // $5 per AI book generation

const TOPUP_PACKAGES = [
  { id: 'topup_5',  amount: 5,  label: '$5' },
  { id: 'topup_10', amount: 10, label: '$10' },
  { id: 'topup_25', amount: 25, label: '$25' },
  { id: 'topup_50', amount: 50, label: '$50' },
];

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  // ─── Stripe Instance ──────────────────────────────────────────────────────

  private getStripe(): Stripe {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new BadRequestException('Stripe not configured.');
    return new Stripe(secretKey, { apiVersion: '2026-02-25.clover' });
  }

  // ─── Credit Balance ───────────────────────────────────────────────────────

  async getCreditBalance(userId: string): Promise<number> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { creditBalance: true },
    });
    return user?.creditBalance ?? 0;
  }

  async getCreditTransactions(userId: string) {
    return this.prisma.creditTransaction.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ─── Top-up Packages ─────────────────────────────────────────────────────

  getTopupPackages() {
    return TOPUP_PACKAGES;
  }

  // ─── Stripe Checkout: Top-up ──────────────────────────────────────────────

  async createTopupSession(userId: string, userEmail: string, amount: number) {
    const validAmounts = TOPUP_PACKAGES.map(p => p.amount);
    if (!validAmounts.includes(amount)) {
      throw new BadRequestException('Invalid top-up amount.');
    }

    const stripe = this.getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: userEmail,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: amount * 100, // cents
          product_data: {
            name: `Universal Book Credits — $${amount}`,
            description: `Add $${amount} credits to your account`,
          },
        },
        quantity: 1,
      }],
      success_url: `https://universal-book.com/account?topup=success`,
      cancel_url: `https://universal-book.com/account`,
      metadata: { type: 'TOPUP', userId, amount: String(amount) },
    });

    return { url: session.url };
  }

  // ─── Stripe Checkout: Book Purchase (card) ────────────────────────────────

  async createBookPurchaseSession(
    userId: string,
    userEmail: string,
    bookId: string,
    affiliateCode?: string,
  ) {
    const published = await this.prisma.publishedBook.findUnique({
      where: { bookId },
      include: { book: true },
    });
    if (!published || !published.isPublic) {
      throw new BadRequestException('Book not available for purchase.');
    }

    // Check not already purchased
    const existing = await this.prisma.bookPurchase.findFirst({
      where: { bookId, buyerId: userId },
    });
    if (existing) throw new BadRequestException('You already own this book.');

    const stripe = this.getStripe();
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: userEmail,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(published.price * 100),
          product_data: {
            name: published.book.title,
            description: published.book.synopsis || 'Book purchase',
          },
        },
        quantity: 1,
      }],
      success_url: `https://universal-book.com/library?purchase=success`,
      cancel_url: `https://universal-book.com/books/${bookId}`,
      metadata: {
        type: 'BOOK_PURCHASE',
        userId,
        bookId,
        affiliateCode: affiliateCode || '',
      },
    });

    return { url: session.url };
  }

  // ─── Buy Book with Credits ─────────────────────────────────────────────────

  async purchaseBookWithCredits(
    userId: string,
    bookId: string,
    affiliateCode?: string,
  ) {
    const published = await this.prisma.publishedBook.findUnique({
      where: { bookId },
      include: { book: true },
    });
    if (!published || !published.isPublic) {
      throw new BadRequestException('Book not available for purchase.');
    }

    // Check not already purchased
    const existing = await this.prisma.bookPurchase.findFirst({
      where: { bookId, buyerId: userId },
    });
    if (existing) throw new BadRequestException('You already own this book.');

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found.');

    const price = published.price;
    if (user.creditBalance < price) {
      throw new BadRequestException('Insufficient credits. Please top up your account.');
    }

    await this._completePurchase({
      buyerId: userId,
      bookId,
      price,
      paymentMethod: 'credits',
      affiliateCode,
    });

    return { success: true };
  }

  // ─── Internal: Complete Purchase ──────────────────────────────────────────

  async _completePurchase(params: {
    buyerId: string;
    bookId: string;
    price: number;
    paymentMethod: 'card' | 'credits';
    affiliateCode?: string;
    stripeSessionId?: string;
  }) {
    const { buyerId, bookId, price, paymentMethod, affiliateCode, stripeSessionId } = params;

    const platformFee = parseFloat((price * PLATFORM_FEE_PERCENT).toFixed(2));
    let writerEarning = parseFloat((price - platformFee).toFixed(2));
    let affiliateFee = 0;

    // Resolve affiliate
    let affiliateLink: any = null;
    if (affiliateCode) {
      affiliateLink = await this.prisma.affiliateLink.findUnique({
        where: { code: affiliateCode },
        include: { user: true },
      });
      // Affiliate can't be the buyer or the book author
      const published = await this.prisma.publishedBook.findUnique({
        where: { bookId },
        include: { book: true },
      });
      if (
        affiliateLink &&
        affiliateLink.userId !== buyerId &&
        affiliateLink.userId !== published?.book?.userId
      ) {
        affiliateFee = parseFloat((writerEarning * AFFILIATE_PERCENT).toFixed(2));
        writerEarning = parseFloat((writerEarning - affiliateFee).toFixed(2));
      } else {
        affiliateLink = null;
      }
    }

    // Deduct credits if paying with credits
    if (paymentMethod === 'credits') {
      const user = await this.prisma.user.findUnique({ where: { id: buyerId } });
      const newBalance = parseFloat((user!.creditBalance - price).toFixed(2));
      await this.prisma.user.update({
        where: { id: buyerId },
        data: { creditBalance: newBalance },
      });
      await this.prisma.creditTransaction.create({
        data: {
          userId: buyerId,
          type: 'BOOK_PURCHASE',
          amount: -price,
          balanceAfter: newBalance,
          description: `Purchased book`,
          stripeSessionId: stripeSessionId || null,
        },
      });
    }

    // Create purchase record
    const purchase = await this.prisma.bookPurchase.create({
      data: {
        bookId,
        buyerId,
        amount: price,
        platformFee,
        writerEarning,
        affiliateFee,
        paymentMethod,
        stripeSessionId: stripeSessionId || null,
      },
    });

    // Update book sales stats
    await this.prisma.publishedBook.update({
      where: { bookId },
      data: {
        totalSales: { increment: 1 },
        totalEarnings: { increment: writerEarning },
      },
    });

    // Pay author (add to credit balance + log transaction)
    const published = await this.prisma.publishedBook.findUnique({
      where: { bookId },
      include: { book: true },
    });
    const authorId = published!.book.userId;
    const author = await this.prisma.user.findUnique({ where: { id: authorId } });
    const authorNewBalance = parseFloat(((author?.creditBalance ?? 0) + writerEarning).toFixed(2));
    await this.prisma.user.update({
      where: { id: authorId },
      data: { creditBalance: authorNewBalance },
    });
    await this.prisma.creditTransaction.create({
      data: {
        userId: authorId,
        type: 'BOOK_SALE_EARNING',
        amount: writerEarning,
        balanceAfter: authorNewBalance,
        description: `Book sale: "${published!.book.title}"`,
      },
    });
    await this.prisma.writerEarning.create({
      data: { writerId: authorId, amount: writerEarning, bookId, status: 'paid' },
    });

    // Pay affiliate
    if (affiliateLink && affiliateFee > 0) {
      const aff = await this.prisma.user.findUnique({ where: { id: affiliateLink.userId } });
      const affNewBalance = parseFloat(((aff?.creditBalance ?? 0) + affiliateFee).toFixed(2));
      await this.prisma.user.update({
        where: { id: affiliateLink.userId },
        data: { creditBalance: affNewBalance },
      });
      await this.prisma.creditTransaction.create({
        data: {
          userId: affiliateLink.userId,
          type: 'AFFILIATE_EARNING',
          amount: affiliateFee,
          balanceAfter: affNewBalance,
          description: `Affiliate commission: "${published!.book.title}"`,
        },
      });
      await this.prisma.affiliateEarning.create({
        data: {
          affiliateId: affiliateLink.userId,
          affiliateLinkId: affiliateLink.id,
          bookPurchaseId: purchase.id,
          amount: affiliateFee,
        },
      });
    }

    return purchase;
  }

  // ─── Deduct Credits for AI Book Generation ────────────────────────────────

  async chargeForAiGeneration(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('User not found.');
    if (user.creditBalance < AI_BOOK_COST) {
      throw new BadRequestException(
        `Insufficient credits. AI book generation costs $${AI_BOOK_COST}. Please top up your account.`
      );
    }
    const newBalance = parseFloat((user.creditBalance - AI_BOOK_COST).toFixed(2));
    await this.prisma.user.update({
      where: { id: userId },
      data: { creditBalance: newBalance },
    });
    await this.prisma.creditTransaction.create({
      data: {
        userId,
        type: 'AI_BOOK_GENERATION',
        amount: -AI_BOOK_COST,
        balanceAfter: newBalance,
        description: 'AI book generation',
      },
    });
    return { charged: AI_BOOK_COST, balance: newBalance };
  }

  // ─── Affiliate Links ──────────────────────────────────────────────────────

  async getOrCreateAffiliateLink(userId: string, bookId: string) {
    const existing = await this.prisma.affiliateLink.findUnique({
      where: { userId_bookId: { userId, bookId } },
    });
    if (existing) return existing;

    const code = randomBytes(6).toString('hex'); // e.g. "a1b2c3d4e5f6"
    return this.prisma.affiliateLink.create({
      data: { userId, bookId, code },
    });
  }

  async trackAffiliateLinkClick(code: string) {
    await this.prisma.affiliateLink.update({
      where: { code },
      data: { clicks: { increment: 1 } },
    });
  }

  async getAffiliateStats(userId: string) {
    const links = await this.prisma.affiliateLink.findMany({
      where: { userId },
      include: {
        book: { select: { id: true, title: true } },
        earnings: true,
      },
    });
    const totalEarnings = links.reduce(
      (sum, l) => sum + l.earnings.reduce((s, e) => s + e.amount, 0), 0
    );
    return { links, totalEarnings };
  }

  // ─── Stripe Webhook ───────────────────────────────────────────────────────

  async handleWebhook(payload: Buffer, signature: string) {
    const stripe = this.getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) throw new BadRequestException('Webhook secret not configured.');

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret);
    } catch (err) {
      throw new BadRequestException('Webhook signature verification failed.');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};

      if (meta.type === 'TOPUP') {
        // Add credits to user account
        const userId = meta.userId;
        const amount = parseFloat(meta.amount);
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (user) {
          const newBalance = parseFloat((user.creditBalance + amount).toFixed(2));
          await this.prisma.user.update({
            where: { id: userId },
            data: { creditBalance: newBalance },
          });
          await this.prisma.creditTransaction.create({
            data: {
              userId,
              type: 'TOPUP',
              amount,
              balanceAfter: newBalance,
              description: `Credit top-up $${amount}`,
              stripeSessionId: session.id,
            },
          });
        }
      }

      if (meta.type === 'BOOK_PURCHASE') {
        await this._completePurchase({
          buyerId: meta.userId,
          bookId: meta.bookId,
          price: parseFloat(session.amount_total ? String(session.amount_total / 100) : '0'),
          paymentMethod: 'card',
          affiliateCode: meta.affiliateCode || undefined,
          stripeSessionId: session.id,
        });
      }
    }

    return { received: true };
  }
}