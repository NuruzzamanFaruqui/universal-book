import { Controller, Post, Get, Body, Param, Request, UseGuards, Headers, Req } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { FirebaseGuard } from '../auth/firebase.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ─── Credit Balance ───────────────────────────────────────────────────────

  @Get('balance')
  @UseGuards(FirebaseGuard)
  async getBalance(@Request() req: any) {
    const balance = await this.paymentsService.getCreditBalance(req.user.id);
    return { balance };
  }

  @Get('transactions')
  @UseGuards(FirebaseGuard)
  async getTransactions(@Request() req: any) {
    return this.paymentsService.getCreditTransactions(req.user.id);
  }

  // ─── Top-up Packages ─────────────────────────────────────────────────────

  @Get('topup-packages')
  getTopupPackages() {
    return this.paymentsService.getTopupPackages();
  }

  // ─── Top-up with Stripe ───────────────────────────────────────────────────

  @Post('topup')
  @UseGuards(FirebaseGuard)
  async createTopup(@Request() req: any, @Body() body: { amount: number }) {
    return this.paymentsService.createTopupSession(
      req.user.id,
      req.user.email,
      body.amount,
    );
  }

  // ─── Buy Book with Card (Stripe) ──────────────────────────────────────────

  @Post('buy-book/card')
  @UseGuards(FirebaseGuard)
  async buyBookWithCard(
    @Request() req: any,
    @Body() body: { bookId: string; affiliateCode?: string },
  ) {
    return this.paymentsService.createBookPurchaseSession(
      req.user.id,
      req.user.email,
      body.bookId,
      body.affiliateCode,
    );
  }

  // ─── Buy Book with Credits ────────────────────────────────────────────────

  @Post('buy-book/credits')
  @UseGuards(FirebaseGuard)
  async buyBookWithCredits(
    @Request() req: any,
    @Body() body: { bookId: string; affiliateCode?: string },
  ) {
    return this.paymentsService.purchaseBookWithCredits(
      req.user.id,
      body.bookId,
      body.affiliateCode,
    );
  }

  // ─── Affiliate Links ──────────────────────────────────────────────────────

  @Post('affiliate/link')
  @UseGuards(FirebaseGuard)
  async getAffiliateLink(
    @Request() req: any,
    @Body() body: { bookId: string },
  ) {
    return this.paymentsService.getOrCreateAffiliateLink(req.user.id, body.bookId);
  }

  @Post('affiliate/click/:code')
  async trackClick(@Param('code') code: string) {
    await this.paymentsService.trackAffiliateLinkClick(code);
    return { tracked: true };
  }

  @Get('affiliate/stats')
  @UseGuards(FirebaseGuard)
  async getAffiliateStats(@Request() req: any) {
    return this.paymentsService.getAffiliateStats(req.user.id);
  }

  // ─── Stripe Webhook ───────────────────────────────────────────────────────

  @Post('webhook')
  async handleWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    const payload = req.rawBody || Buffer.from(JSON.stringify(req.body));
    return this.paymentsService.handleWebhook(payload, signature);
  }
}