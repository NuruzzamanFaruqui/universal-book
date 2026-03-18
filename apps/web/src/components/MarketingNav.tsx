'use client';
import Link from 'next/link';
import { BookOpen } from 'lucide-react';

export default function MarketingNav() {
  return (
    <nav className="w-full border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="flex items-center justify-between px-8 py-5 max-w-7xl mx-auto">
        <Link href="/" className="flex items-center gap-2 text-2xl font-bold text-white">
          <BookOpen className="text-blue-400" size={32} />
          <span>Universal Book</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-slate-400">
          <Link href="/features" className="hover:text-white transition">Features</Link>
          <Link href="/pricing" className="hover:text-white transition">Pricing</Link>
          <Link href="/about" className="hover:text-white transition">About</Link>
          <Link href="/contact" className="hover:text-white transition">Contact</Link>
        </div>
        <div className="flex gap-3">
          <Link href="/auth/login" className="px-4 py-2 text-blue-300 hover:text-white transition text-sm">Login</Link>
          <Link href="/auth/register" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition text-sm">Get Started Free</Link>
        </div>
      </div>
    </nav>
  );
}
