import { Controller, Post, Body, Request, UseGuards, Headers, Req } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { FirebaseGuard } from '../auth/firebase.guard';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('checkout')
  @UseGuards(FirebaseGuard)
  async createCheckout(
    @Request() req: any,
    @Body() body: { plan: string },
  ) {
    return this.paymentsService.createCheckoutSession(
      req.user.id,
      req.user.email,
      body.plan,
      'https://universal-book.com/subscribe/success',
      'https://universal-book.com/account/subscription',
    );
  }

  @Post('webhook')
  async handleWebhook(
    @Req() req: any,
    @Headers('stripe-signature') signature: string,
  ) {
    const payload = req.rawBody || Buffer.from(JSON.stringify(req.body));
    return this.paymentsService.handleWebhook(payload, signature);
  }
}
