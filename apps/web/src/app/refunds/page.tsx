'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';

export default function RefundsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <MarketingNav />
      <div className="flex-1 max-w-3xl mx-auto px-8 py-16">
        <h1 className="text-4xl font-extrabold mb-2">Refund Policy</h1>
        <p className="text-slate-400 mb-12">Last updated: January 1, 2026</p>
        <div className="space-y-10 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">7-Day Money Back Guarantee</h2>
            <p>We offer a full refund within 7 days of your first paid subscription. If you are not satisfied with Universal Book for any reason, contact us within 7 days of your purchase and we will issue a full refund — no questions asked.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">Eligibility</h2>
            <p>Refunds are available for first-time subscribers only. Subsequent renewals are not eligible for refunds. The 7-day period begins from the date of your first successful payment.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">How to Request a Refund</h2>
            <p>To request a refund, email us at billing@universalbook.ai with your account email and reason for the refund. We will process your refund within 5-10 business days.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">Cancellations</h2>
            <p>You may cancel your subscription at any time from your account settings. Cancellations take effect at the end of the current billing period. You will retain access to all features until the end of the period.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">Free Plan</h2>
            <p>The Scribe free plan requires no payment and is not subject to this refund policy.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">Contact Us</h2>
            <p>For refund requests or billing questions, contact us at <Link href="/contact" className="text-blue-400 hover:text-blue-300">billing@universalbook.ai</Link></p>
          </section>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
