'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { BookOpen, Wallet } from 'lucide-react';

const API_URL = 'https://api.universal-book.com';

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return null;
}

export default function DashboardNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  useEffect(() => {
    fetchBalance();
  }, []);

  const fetchBalance = async () => {
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/payments/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCreditBalance(data.balance);
      }
    } catch (e) {}
  };

  const handleLogout = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      if (auth) await auth.signOut();
    } catch (e) {}
    router.push('/auth/login');
  };

  const navLinks = [
    { href: '/feed', label: '🏠 Feed' },
    { href: '/dashboard', label: '📚 My Books' },
    { href: '/dashboard/templates', label: '📋 Templates' },
    { href: '/dashboard/earnings', label: '💰 Earnings' },
    { href: '/library', label: '🗂 My Library' },
    { href: '/groups', label: '👥 Groups' },
    { href: '/dashboard/author-groups', label: '✍️ Co-Write' },
  ];

  return (
    <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
        {/* Logo */}
        <Link href="/feed" className="flex items-center gap-2 text-xl font-bold text-white">
          <BookOpen className="text-blue-400" size={26} />
          <span>Universal Book</span>
        </Link>

        {/* Nav Links */}
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-3 py-2 rounded-lg text-sm transition-colors ${
                pathname === link.href
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right side: Credits + Account + Logout */}
        <div className="flex items-center gap-3">
          {/* Credit Balance */}
          <Link
            href="/account/topup"
            className="flex items-center gap-2 bg-emerald-900/40 border border-emerald-700 hover:bg-emerald-900/70 text-emerald-400 px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            <Wallet size={15} />
            <span>
              {creditBalance === null ? '...' : `$${creditBalance.toFixed(2)}`}
            </span>
            <span className="text-emerald-600 text-xs">+ Add</span>
          </Link>

          <Link
            href="/account"
            className="px-3 py-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            ⚡ Account
          </Link>

          <button
            onClick={handleLogout}
            className="px-3 py-2 text-slate-400 hover:text-red-400 text-sm transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </nav>
  );
}