'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DollarSign, TrendingUp, BookOpen, Link2, Wallet, ArrowUpRight } from 'lucide-react';
import AppNav from '@/components/AppNav';

const API_URL = 'https://api.universal-book.com';

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return null;
}

export default function EarningsPage() {
  const router = useRouter();
  const [balance, setBalance] = useState<number>(0);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [affiliateStats, setAffiliateStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    const token = await getFreshToken();
    if (!token) { router.push('/auth/login'); return; }
    try {
      const [balRes, txRes, affRes] = await Promise.all([
        fetch(`${API_URL}/api/payments/balance`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/payments/transactions`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/payments/affiliate/stats`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (balRes.ok) setBalance((await balRes.json()).balance);
      if (txRes.ok) setTransactions(await txRes.json());
      if (affRes.ok) setAffiliateStats(await affRes.json());
    } catch (e) {}
    setLoading(false);
  };

  const authorEarnings = transactions
    .filter(tx => tx.type === 'BOOK_SALE_EARNING')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const affiliateEarnings = transactions
    .filter(tx => tx.type === 'AFFILIATE_EARNING')
    .reduce((sum, tx) => sum + tx.amount, 0);

  const totalSpent = transactions
    .filter(tx => ['AI_BOOK_GENERATION', 'BOOK_PURCHASE'].includes(tx.type))
    .reduce((sum, tx) => sum + Math.abs(tx.amount), 0);

  const formatType = (type: string) => {
    const map: Record<string, string> = {
      TOPUP: '💳 Credit Top-up',
      AI_BOOK_GENERATION: '🤖 AI Book Generation',
      BOOK_PURCHASE: '📖 Book Purchase',
      BOOK_SALE_EARNING: '💰 Book Sale Earning',
      AFFILIATE_EARNING: '🔗 Affiliate Commission',
      REFUND: '↩️ Refund',
    };
    return map[type] || type;
  };

  const isCredit = (type: string) =>
    ['TOPUP', 'BOOK_SALE_EARNING', 'AFFILIATE_EARNING', 'REFUND'].includes(type);

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <p className="text-white">Loading...</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <AppNav />

      <div className="max-w-5xl mx-auto px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Earnings & Credits</h1>
          <Link
            href="/account/topup"
            className="flex items-center gap-2 bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
          >
            <Wallet size={16} />
            Top Up Credits
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-emerald-900/30 border border-emerald-700/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-emerald-400 mb-2">
              <Wallet size={18} />
              <span className="text-sm">Balance</span>
            </div>
            <p className="text-3xl font-bold text-emerald-400">${balance.toFixed(2)}</p>
          </div>

          <div className="bg-blue-900/30 border border-blue-700/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-blue-400 mb-2">
              <BookOpen size={18} />
              <span className="text-sm">Book Sales</span>
            </div>
            <p className="text-3xl font-bold text-blue-400">${authorEarnings.toFixed(2)}</p>
          </div>

          <div className="bg-purple-900/30 border border-purple-700/50 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-purple-400 mb-2">
              <Link2 size={18} />
              <span className="text-sm">Affiliate</span>
            </div>
            <p className="text-3xl font-bold text-purple-400">${affiliateEarnings.toFixed(2)}</p>
          </div>

          <div className="bg-slate-800/50 border border-slate-700 rounded-2xl p-5">
            <div className="flex items-center gap-2 text-slate-400 mb-2">
              <TrendingUp size={18} />
              <span className="text-sm">Total Spent</span>
            </div>
            <p className="text-3xl font-bold text-slate-300">${totalSpent.toFixed(2)}</p>
          </div>
        </div>

        {/* Affiliate Links */}
        {affiliateStats?.links?.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Link2 size={18} className="text-purple-400" />
              Your Affiliate Links
            </h2>
            <div className="space-y-3">
              {affiliateStats.links.map((link: any) => {
                const linkEarnings = link.earnings.reduce((s: number, e: any) => s + e.amount, 0);
                const shareUrl = `${window.location.origin}/books/${link.bookId}?ref=${link.code}`;
                return (
                  <div key={link.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{link.book?.title}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {link.clicks} clicks • {link.earnings.length} sales
                        </p>
                        <div className="flex gap-2 mt-2">
                          <input
                            readOnly
                            value={shareUrl}
                            className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-1.5 text-xs text-slate-300 truncate"
                          />
                          <button
                            onClick={() => navigator.clipboard.writeText(shareUrl)}
                            className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-1.5 rounded-lg text-xs"
                          >
                            Copy
                          </button>
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-purple-400 font-bold">${linkEarnings.toFixed(2)}</p>
                        <p className="text-xs text-slate-500">earned</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Transaction History */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <DollarSign size={18} className="text-slate-400" />
            Transaction History
          </h2>
          {transactions.length === 0 ? (
            <div className="text-center py-16 text-slate-500">
              <DollarSign size={48} className="mx-auto mb-4 opacity-20" />
              <p className="text-lg">No transactions yet</p>
              <p className="text-sm mt-1">Start by topping up your credits</p>
              <Link
                href="/account/topup"
                className="inline-block mt-4 bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-xl text-sm"
              >
                Add Credits
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx: any) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between bg-slate-800/50 border border-slate-700 rounded-xl px-5 py-4"
                >
                  <div>
                    <p className="font-medium text-sm">{formatType(tx.type)}</p>
                    <p className="text-xs text-slate-500">{tx.description}</p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {new Date(tx.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${isCredit(tx.type) ? 'text-emerald-400' : 'text-red-400'}`}>
                      {isCredit(tx.type) ? '+' : '-'}${Math.abs(tx.amount).toFixed(2)}
                    </p>
                    <p className="text-xs text-slate-500">Balance: ${tx.balanceAfter.toFixed(2)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}