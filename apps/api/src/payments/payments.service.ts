import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { CreditTransactionType, Prisma } from '@prisma/client';
import Stripe from 'stripe';
import { PrismaService } from '../prisma.service';
import { randomBytes } from 'crypto';

/** Money is stored as Float; round every derived figure to cents. */
const round2 = (n: number) => Math.round(n * 100) / 100;

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
  private readonly logger = new Logger(PaymentsService.name);

  constructor(private prisma: PrismaService) {}

  // ─── Stripe Instance ──────────────────────────────────────────────────────

  private getStripe(): Stripe {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new BadRequestException('Stripe not configured.');
    return new Stripe(secretKey, { apiVersion: '2026-02-25.clover' });
  }

  // ─── Atomic credit movement ───────────────────────────────────────────────

  /**
   * Debits a user inside a transaction, refusing to go negative.
   *
   * The conditional `updateMany` is what makes this safe: Postgres evaluates
   * `creditBalance >= amount` while holding the row lock, so two concurrent
   * requests cannot both pass. The previous read-then-write version let them,
   * which meant a $5 balance could buy two AI books.
   */
  private async debit(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    type: CreditTransactionType,
    description: string,
    stripeSessionId?: string,
  ): Promise<number> {
    const { count } = await tx.user.updateMany({
      where: { id: userId, creditBalance: { gte: amount } },
      data: { creditBalance: { decrement: amount } },
    });
    if (count === 0) {
      throw new BadRequestException('Insufficient credits. Please top up your account.');
    }

    const user = await tx.user.findUniqueOrThrow({
      where: { id: userId },
      select: { creditBalance: true },
    });
    await tx.creditTransaction.create({
      data: {
        userId,
        type,
        amount: -amount,
        balanceAfter: round2(user.creditBalance),
        description,
        stripeSessionId: stripeSessionId || null,
      },
    });
    return user.creditBalance;
  }

  /** Credits a user atomically and records the movement. */
  private async credit(
    tx: Prisma.TransactionClient,
    userId: string,
    amount: number,
    type: CreditTransactionType,
    description: string,
    stripeSessionId?: string,
  ): Promise<number> {
    const user = await tx.user.update({
      where: { id: userId },
      data: { creditBalance: { increment: amount } },
      select: { creditBalance: true },
    });
    await tx.creditTransaction.create({
      data: {
        userId,
        type,
        amount,
        balanceAfter: round2(user.creditBalance),
        description,
        stripeSessionId: stripeSessionId || null,
      },
    });
    return user.creditBalance;
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

    // Affordability is enforced atomically inside _completePurchase; checking
    // it here as well would only add a race.
    const price = published.price;

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

  /**
   * Records a purchase and moves every resulting payment, as one transaction.
   *
   * Previously this was ten sequential writes with no transaction, so a failure
   * anywhere in the middle left the books permanently inconsistent — a buyer
   * charged with no purchase row, or a purchase with no author payout.
   */
  async _completePurchase(params: {
    buyerId: string;
    bookId: string;
    price: number;
    paymentMethod: 'card' | 'credits';
    affiliateCode?: string;
    stripeSessionId?: string;
  }) {
    const { buyerId, bookId, price, paymentMethod, affiliateCode, stripeSessionId } = params;

    if (!(price >= 0)) throw new BadRequestException('Invalid price.');

    return this.prisma.$transaction(async (tx) => {
      const published = await tx.publishedBook.findUnique({
        where: { bookId },
        include: { book: { select: { userId: true, title: true } } },
      });
      if (!published) throw new BadRequestException('Book not available for purchase.');

      // Re-checked inside the transaction: two simultaneous buys would both
      // pass a check made outside it.
      const already = await tx.bookPurchase.findFirst({
        where: { bookId, buyerId },
        select: { id: true },
      });
      if (already) throw new BadRequestException('You already own this book.');

      const authorId = published.book.userId;
      const platformFee = round2(price * PLATFORM_FEE_PERCENT);
      let writerEarning = round2(price - platformFee);
      let affiliateFee = 0;

      let affiliateLink: { id: string; userId: string } | null = null;
      if (affiliateCode) {
        const link = await tx.affiliateLink.findUnique({
          where: { code: affiliateCode },
          select: { id: true, userId: true },
        });
        // An affiliate cannot be the buyer or the author.
        if (link && link.userId !== buyerId && link.userId !== authorId) {
          affiliateLink = link;
          affiliateFee = round2(writerEarning * AFFILIATE_PERCENT);
          writerEarning = round2(writerEarning - affiliateFee);
        }
      }

      if (paymentMethod === 'credits' && price > 0) {
        await this.debit(
          tx, buyerId, price, 'BOOK_PURCHASE',
          `Purchased "${published.book.title}"`, stripeSessionId,
        );
      }

      const purchase = await tx.bookPurchase.create({
        data: {
          bookId, buyerId, amount: price, platformFee, writerEarning, affiliateFee,
          paymentMethod, stripeSessionId: stripeSessionId || null,
        },
      });

      await tx.publishedBook.update({
        where: { bookId },
        data: { totalSales: { increment: 1 }, totalEarnings: { increment: writerEarning } },
      });

      if (writerEarning > 0) {
        await this.credit(
          tx, authorId, writerEarning, 'BOOK_SALE_EARNING',
          `Book sale: "${published.book.title}"`,
        );
        await tx.writerEarning.create({
          data: { writerId: authorId, amount: writerEarning, bookId, status: 'paid' },
        });
      }

      if (affiliateLink && affiliateFee > 0) {
        await this.credit(
          tx, affiliateLink.userId, affiliateFee, 'AFFILIATE_EARNING',
          `Affiliate commission: "${published.book.title}"`,
        );
        await tx.affiliateEarning.create({
          data: {
            affiliateId: affiliateLink.userId,
            affiliateLinkId: affiliateLink.id,
            bookPurchaseId: purchase.id,
            amount: affiliateFee,
          },
        });
      }

      return purchase;
    });
  }

  // ─── Deduct Credits for AI Book Generation ────────────────────────────────

  async chargeForAiGeneration(userId: string) {
    const balance = await this.prisma.$transaction((tx) =>
      this.debit(tx, userId, AI_BOOK_COST, 'AI_BOOK_GENERATION', 'AI book generation'),
    );
    return { charged: AI_BOOK_COST, balance: round2(balance) };
  }

  /** Returns a charge taken for a generation that then failed. */
  async refundAiGeneration(userId: string, reason: string) {
    const balance = await this.prisma.$transaction((tx) =>
      this.credit(tx, userId, AI_BOOK_COST, 'REFUND', `Refund: ${reason}`),
    );
    this.logger.log(`Refunded $${AI_BOOK_COST} to ${userId} — ${reason}`);
    return { refunded: AI_BOOK_COST, balance: round2(balance) };
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

    // Idempotency. Stripe retries on any non-2xx or timeout, and without this
    // a retried top-up credits twice and a retried purchase pays out twice.
    // The unique constraint on eventId decides the race, not a prior read.
    try {
      await this.prisma.processedWebhookEvent.create({
        data: { eventId: event.id, type: event.type },
      });
    } catch (err: any) {
      if (err?.code === 'P2002') {
        this.logger.log(`Ignoring duplicate Stripe event ${event.id}`);
        return { received: true, duplicate: true };
      }
      throw err;
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      const meta = session.metadata || {};

      // Never act on an unpaid session.
      if (session.payment_status !== 'paid') {
        this.logger.warn(`Session ${session.id} completed but not paid; skipping.`);
        return { received: true };
      }

      if (meta.type === 'TOPUP') {
        const amount = parseFloat(meta.amount);
        if (meta.userId && amount > 0) {
          await this.prisma.$transaction((tx) =>
            this.credit(
              tx, meta.userId, amount, 'TOPUP',
              `Credit top-up $${amount}`, session.id,
            ),
          );
        }
      }

      if (meta.type === 'BOOK_PURCHASE') {
        await this._completePurchase({
          buyerId: meta.userId,
          bookId: meta.bookId,
          price: round2((session.amount_total ?? 0) / 100),
          paymentMethod: 'card',
          affiliateCode: meta.affiliateCode || undefined,
          stripeSessionId: session.id,
        });
      }
    }

    return { received: true };
  }
}