'use client';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

export default function MarketingFooter() {
  return (
    <footer className="px-8 py-12 border-t border-slate-800">
      <div className="max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-10">
          <div>
            <div className="flex items-center gap-2 font-bold text-lg mb-4 text-white">
              <BookOpen className="text-blue-400" size={20} />
              Universal Book
            </div>
            <p className="text-slate-400 text-sm">AI-powered book writing platform for everyone.</p>
          </div>
          <div>
            <div className="font-bold mb-4 text-sm text-slate-300 uppercase tracking-wider">Product</div>
            <div className="space-y-2 text-sm text-slate-400">
              <div><Link href="/features" className="hover:text-white transition">Features</Link></div>
              <div><Link href="/pricing" className="hover:text-white transition">Pricing</Link></div>
              <div><Link href="/auth/register" className="hover:text-white transition">Get Started</Link></div>
            </div>
          </div>
          <div>
            <div className="font-bold mb-4 text-sm text-slate-300 uppercase tracking-wider">Company</div>
            <div className="space-y-2 text-sm text-slate-400">
              <div><Link href="/about" className="hover:text-white transition">About</Link></div>
              <div><Link href="/contact" className="hover:text-white transition">Contact</Link></div>
            </div>
          </div>
          <div>
            <div className="font-bold mb-4 text-sm text-slate-300 uppercase tracking-wider">Legal</div>
            <div className="space-y-2 text-sm text-slate-400">
              <div><Link href="/privacy" className="hover:text-white transition">Privacy Policy</Link></div>
              <div><Link href="/terms" className="hover:text-white transition">Terms of Service</Link></div>
              <div><Link href="/refunds" className="hover:text-white transition">Refund Policy</Link></div>
            </div>
          </div>
        </div>
        <div className="border-t border-slate-800 pt-8 text-center text-slate-500 text-sm">
          © 2026 Universal Book. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
