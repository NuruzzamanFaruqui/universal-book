'use client';
export const dynamic = 'force-dynamic';

import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <MarketingNav />
      <div className="flex-1 max-w-3xl mx-auto px-8 py-16">
        <h1 className="text-4xl font-extrabold mb-2">Terms of Service</h1>
        <p className="text-slate-400 mb-12">Last updated: January 1, 2026</p>
        <div className="space-y-10 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing and using Universal Book, you accept and agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our service.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. Use of Service</h2>
            <p>You may use Universal Book only for lawful purposes and in accordance with these Terms. You agree not to use the service to create content that is illegal, harmful, threatening, abusive, or defamatory.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Your Content & Ownership</h2>
            <p>You retain full ownership of all content you create using Universal Book. By using our service, you grant us a limited license to process your content solely for the purpose of providing the service to you.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Subscription & Billing</h2>
            <p>Paid subscriptions are billed in advance on a monthly basis. You may cancel your subscription at any time. Cancellations take effect at the end of the current billing period. We do not offer refunds for partial months.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Intellectual Property</h2>
            <p>The Universal Book platform, including its design, features, and underlying technology, is owned by Universal Book and protected by intellectual property laws. You may not copy, modify, or distribute our platform without permission.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Limitation of Liability</h2>
            <p>Universal Book shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use of the service. Our total liability shall not exceed the amount paid by you in the past 12 months.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Termination</h2>
            <p>We reserve the right to terminate or suspend your account at any time for violation of these terms. You may terminate your account at any time by contacting support.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Contact</h2>
            <p>For questions about these Terms, contact us at legal@universalbook.ai</p>
          </section>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
