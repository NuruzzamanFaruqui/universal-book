'use client';
export const dynamic = 'force-dynamic';

import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <MarketingNav />
      <div className="flex-1 max-w-3xl mx-auto px-8 py-16">
        <h1 className="text-4xl font-extrabold mb-2">Privacy Policy</h1>
        <p className="text-slate-400 mb-12">Last updated: January 1, 2026</p>
        <div className="space-y-10 text-slate-300 leading-relaxed">
          <section>
            <h2 className="text-xl font-bold text-white mb-3">1. Information We Collect</h2>
            <p>We collect information you provide directly to us, such as your name, email address, and payment information when you create an account or subscribe to a plan.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">2. How We Use Your Information</h2>
            <p>We use the information we collect to provide, maintain, and improve our services, process transactions, and respond to your comments and questions.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">3. Your Content</h2>
            <p>All content you create using Universal Book belongs to you. We will never use your content to train AI models or share it with third parties without your explicit consent.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">4. Data Security</h2>
            <p>We take reasonable measures to help protect information about you from loss, theft, misuse, and unauthorized access. All data is encrypted in transit and at rest.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">5. Cookies</h2>
            <p>We use cookies and similar tracking technologies to track activity on our service. You can instruct your browser to refuse all cookies.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">6. Third-Party Services</h2>
            <p>We use Firebase (authentication), Stripe (payments), and Anthropic (AI generation). Each has their own privacy policy.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">7. Data Retention</h2>
            <p>We retain your account information for as long as your account is active. You may delete your account at any time.</p>
          </section>
          <section>
            <h2 className="text-xl font-bold text-white mb-3">8. Contact Us</h2>
            <p>If you have any questions about this Privacy Policy, please contact us at privacy@universalbook.ai</p>
          </section>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
