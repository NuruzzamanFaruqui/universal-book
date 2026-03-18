'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { CheckCircle, BookOpen, ArrowRight } from 'lucide-react';

export default function SubscribeSuccessPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-8">
      <div className="text-center max-w-lg">
        <div className="flex items-center justify-center gap-2 text-2xl font-bold mb-12">
          <BookOpen className="text-blue-400" size={32} />
          <span>Universal Book</span>
        </div>

        <div className="w-24 h-24 bg-green-900/30 border border-green-700 rounded-full flex items-center justify-center mx-auto mb-8">
          <CheckCircle className="text-green-400" size={48} />
        </div>

        <h1 className="text-4xl font-extrabold mb-4">You're all set! 🎉</h1>
        <p className="text-slate-400 text-lg mb-4">
          Your subscription is now active. Welcome to the family!
        </p>
        <p className="text-slate-500 text-sm mb-10">
          A confirmation email has been sent to your inbox. Your new plan features are now available.
        </p>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8 text-left">
          <h2 className="font-bold mb-4 text-center">What's unlocked for you</h2>
          <div className="space-y-3">
            {[
              'Unlimited book creation',
              'All 127 genre modes',
              'Chapter regeneration',
              'All export formats (PDF, EPUB, DOCX)',
              'Priority AI generation speed',
              '42 language support',
            ].map((feature, i) => (
              <div key={i} className="flex items-center gap-3 text-sm">
                <CheckCircle size={16} className="text-green-400 flex-shrink-0" />
                <span className="text-slate-300">{feature}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-4 justify-center">
          <Link href="/dashboard/new-book"
            className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition">
            Start Writing <ArrowRight size={16} />
          </Link>
          <Link href="/dashboard"
            className="px-6 py-3 border border-slate-600 hover:border-blue-500 rounded-lg font-semibold transition">
            My Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
