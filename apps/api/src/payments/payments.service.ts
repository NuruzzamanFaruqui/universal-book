import { Injectable } from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma.service';

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService) {}

  private async getStripe(): Promise<Stripe> {
    const secretKey = await this.prisma.setting.findUnique({
      where: { key: 'STRIPE_SECRET_KEY' },
    });
    if (!secretKey?.value) throw new Error('Stripe not configured. Please add Stripe keys in Admin Settings.');
    return new Stripe(secretKey.value, { apiVersion: '2026-02-25.clover' });
  }

  async createCheckoutSession(userId: string, userEmail: string, plan: string, successUrl: string, cancelUrl: string) {
    const stripe = await this.getStripe();
    const priceKey = plan === 'AUTHOR' ? 'STRIPE_AUTHOR_PRICE_ID' : 'STRIPE_PUBLISHER_PRICE_ID';
    const priceSetting = await this.prisma.setting.findUnique({ where: { key: priceKey } });
    if (!priceSetting?.value) throw new Error(`Price ID for ${plan} plan not configured.`);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      customer_email: userEmail,
      line_items: [{ price: priceSetting.value, quantity: 1 }],
      success_url: `${successUrl}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl,
      metadata: { userId, plan },
    });

    return { url: session.url };
  }

  async handleWebhook(payload: Buffer, signature: string) {
    const stripe = await this.getStripe();
    const webhookSecret = await this.prisma.setting.findUnique({
      where: { key: 'STRIPE_WEBHOOK_SECRET' },
    });
    if (!webhookSecret?.value) throw new Error('Webhook secret not configured');

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(payload, signature, webhookSecret.value);
    } catch (err) {
      throw new Error('Webhook signature verification failed');
    }

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as any;
      const userId = session.metadata?.userId;
      const plan = session.metadata?.plan;
      if (userId && plan) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { plan: plan as any },
        });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as any;
      const userId = subscription.metadata?.userId;
      if (userId) {
        await this.prisma.user.update({
          where: { id: userId },
          data: { plan: 'FREE' as any },
        });
      }
    }

    return { received: true };
  }
}
