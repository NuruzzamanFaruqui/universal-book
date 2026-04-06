'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Wallet, CreditCard, CheckCircle, ArrowLeft, Clock } from 'lucide-react';

const API_URL = 'https://api.universal-book.com';

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return null;
}

const PACKAGES = [
  { id: 'topup_5',  amount: 5,  label: '$5',  description: 'Try it out', popular: false },
  { id: 'topup_10', amount: 10, label: '$10', description: '2 AI books', popular: true },
  { id: 'topup_25', amount: 25, label: '$25', description: '5 AI books', popular: false },
  { id: 'topup_50', amount: 50, label: '$50', description: '10 AI books', popular: false },
];

export default function TopupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [balance, setBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [selected, setSelected] = useState<number>(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const topupSuccess = searchParams.get('topup') === 'success';

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const token = await getFreshToken();
    if (!token) { router.push('/auth/login'); return; }
    try {
      const [balRes, txRes] = await Promise.all([
        fetch(`${API_URL}/api/payments/balance`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/payments/transactions`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (balRes.ok) setBalance((await balRes.json()).balance);
      if (txRes.ok) setTransactions(await txRes.json());
    } catch (e) {}
  };

  const handleTopup = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getFreshToken();
      if (!token) { router.push('/auth/login'); return; }
      const res = await fetch(`${API_URL}/api/payments/topup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ amount: selected }),
      });
      if (!res.ok) throw new Error('Failed to create checkout session');
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const getTransactionColor = (type: string) => {
    if (['TOPUP', 'BOOK_SALE_EARNING', 'AFFILIATE_EARNING'].includes(type)) return 'text-emerald-400';
    return 'text-red-400';
  };

  const getTransactionSign = (type: string) => {
    if (['TOPUP', 'BOOK_SALE_EARNING', 'AFFILIATE_EARNING'].includes(type)) return '+';
    return '-';
  };

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

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center gap-4">
          <Link href="/account" className="text-slate-400 hover:text-white">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="text-xl font-bold">Credits & Billing</h1>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        {/* Success Banner */}
        {topupSuccess && (
          <div className="flex items-center gap-3 bg-emerald-900/30 border border-emerald-700 rounded-xl p-4">
            <CheckCircle className="text-emerald-400" size={24} />
            <div>
              <p className="font-semibold text-emerald-400">Credits added successfully!</p>
              <p className="text-sm text-slate-400">Your balance has been updated.</p>
            </div>
          </div>
        )}

        {/* Current Balance */}
        <div className="bg-gradient-to-br from-emerald-900/40 to-slate-800/40 border border-emerald-700/50 rounded-2xl p-6">
          <div className="flex items-center gap-3 mb-2">
            <Wallet className="text-emerald-400" size={28} />
            <h2 className="text-lg font-semibold text-slate-300">Current Balance</h2>
          </div>
          <p className="text-5xl font-bold text-emerald-400">
            ${balance === null ? '...' : balance.toFixed(2)}
          </p>
          <p className="text-slate-400 text-sm mt-2">1 credit = $1.00 USD • AI book generation costs $5.00</p>
        </div>

        {/* Top-up Packages */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <CreditCard size={20} className="text-blue-400" />
            Add Credits
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {PACKAGES.map(pkg => (
              <button
                key={pkg.id}
                onClick={() => setSelected(pkg.amount)}
                className={`relative rounded-xl border-2 p-4 text-center transition-all ${
                  selected === pkg.amount
                    ? 'border-blue-500 bg-blue-900/30'
                    : 'border-slate-700 bg-slate-800/50 hover:border-slate-500'
                }`}
              >
                {pkg.popular && (
                  <span className="absolute -top-2 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-xs px-2 py-0.5 rounded-full">
                    Popular
                  </span>
                )}
                <p className="text-2xl font-bold text-white">{pkg.label}</p>
                <p className="text-slate-400 text-xs mt-1">{pkg.description}</p>
              </button>
            ))}
          </div>

          {error && <p className="text-red-400 text-sm mb-4">{error}</p>}

          <button
            onClick={handleTopup}
            disabled={loading}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
          >
            <CreditCard size={18} />
            {loading ? 'Redirecting to Stripe...' : `Add $${selected} Credits via Stripe`}
          </button>
          <p className="text-slate-500 text-xs text-center mt-2">
            Secured by Stripe • Sandbox mode — use card 4242 4242 4242 4242
          </p>
        </div>

        {/* Transaction History */}
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock size={20} className="text-slate-400" />
            Transaction History
          </h2>
          {transactions.length === 0 ? (
            <div className="text-center py-12 text-slate-500">
              <Clock size={40} className="mx-auto mb-3 opacity-30" />
              <p>No transactions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx: any) => (
                <div
                  key={tx.id}
                  className="flex items-center justify-between bg-slate-800/50 border border-slate-700 rounded-xl px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{formatType(tx.type)}</p>
                    <p className="text-xs text-slate-500">{tx.description}</p>
                    <p className="text-xs text-slate-600">
                      {new Date(tx.createdAt).toLocaleDateString('en-US', {
                        month: 'short', day: 'numeric', year: 'numeric',
                        hour: '2-digit', minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={`font-bold ${getTransactionColor(tx.type)}`}>
                      {getTransactionSign(tx.type)}${Math.abs(tx.amount).toFixed(2)}
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