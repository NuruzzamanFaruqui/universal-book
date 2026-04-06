'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Check, ArrowLeft, Zap } from 'lucide-react';
import AppNav from '@/components/AppNav';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

const plans = [
  {
    name: 'Scribe', price: '0', tagline: 'Free forever', planKey: 'FREE',
    features: ['1 book per month', 'Up to 5 chapters', 'TXT & HTML export', '10 genre modes'],
  },
  {
    name: 'Author', price: '29', tagline: 'Most popular', planKey: 'AUTHOR', featured: true,
    features: ['Unlimited books', 'Up to 30 chapters', 'All export formats', 'All 127 genres', 'Unlimited regeneration', '42 languages'],
  },
  {
    name: 'Publisher', price: '99', tagline: 'For teams', planKey: 'PUBLISHER',
    features: ['Everything in Author', '5 team seats', 'API access', 'Custom AI fine-tuning', 'White-label export', 'Dedicated support'],
  },
];

export default function SubscriptionPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [upgrading, setUpgrading] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('ub_token');
    if (!token) { router.push('/auth/login'); return; }
    fetchUser();
  }, []);

  const fetchUser = async () => {
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load profile');
      setUser(await res.json());
    } catch (err) {}
    finally { setLoading(false); }
  };

  const handleUpgrade = async (planKey: string) => {
    setUpgrading(planKey);
    setError('');
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/payments/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ plan: planKey }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create checkout session');
      }
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpgrading('');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading...</div>
    </div>
  );

  const currentPlan = user?.plan || 'FREE';

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <AppNav />
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/account" className="flex items-center gap-2 text-slate-400 hover:text-white transition">
            <ArrowLeft size={18} /> Back to Account
          </Link>
        </div>

        <div className="mb-10">
          <h1 className="text-3xl font-bold mb-2">Subscription & Billing</h1>
          <p className="text-slate-400">You are currently on the <span className="text-blue-400 font-semibold">{currentPlan}</span> plan.</p>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-6 text-sm">{error}</div>}

        {/* Current Plan Banner */}
        <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-6 mb-10 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-900/50 rounded-full flex items-center justify-center">
              <Zap className="text-blue-400" size={24} />
            </div>
            <div>
              <div className="font-bold text-lg">{currentPlan} Plan</div>
              <div className="text-slate-400 text-sm">
                {currentPlan === 'FREE' ? 'Free forever — upgrade anytime for more features' : 'Active subscription'}
              </div>
            </div>
          </div>
          <div className="text-2xl font-extrabold text-blue-400">
            {currentPlan === 'AUTHOR' ? '$29/mo' : currentPlan === 'PUBLISHER' ? '$99/mo' : '$0/mo'}
          </div>
        </div>

        {/* Plans */}
        <h2 className="text-xl font-bold mb-6">Available Plans</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div key={plan.name} className={`rounded-xl p-6 border ${plan.featured ? 'bg-blue-900/20 border-blue-500' : 'bg-slate-800 border-slate-700'}`}>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="font-bold text-lg">{plan.name}</h3>
                  {plan.featured && <span className="text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Popular</span>}
                </div>
                <div className="text-slate-400 text-sm mb-3">{plan.tagline}</div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-extrabold text-blue-400">${plan.price}</span>
                  <span className="text-slate-400 text-sm">/month</span>
                </div>
              </div>
              <div className="space-y-2 mb-6">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Check size={14} className="text-green-400 flex-shrink-0" />
                    <span className="text-slate-300">{f}</span>
                  </div>
                ))}
              </div>
              {currentPlan === plan.planKey ? (
                <div className="w-full text-center py-2 bg-slate-700 rounded-lg text-slate-400 text-sm font-semibold">
                  Current Plan
                </div>
              ) : plan.planKey === 'FREE' ? (
                <div className="w-full text-center py-2 bg-slate-700 rounded-lg text-slate-400 text-sm font-semibold">
                  Free Plan
                </div>
              ) : (
                <button
                  onClick={() => handleUpgrade(plan.planKey)}
                  disabled={upgrading === plan.planKey}
                  className={`w-full py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50 ${
                    plan.featured
                      ? 'bg-blue-600 hover:bg-blue-500 text-white'
                      : 'border border-slate-600 hover:border-blue-500 text-white'
                  }`}>
                  {upgrading === plan.planKey ? 'Redirecting to checkout...' : `Upgrade to ${plan.name}`}
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-slate-500 text-sm text-center mt-8">
          Secure payments powered by Stripe. Cancel anytime from your account.
        </p>
      </div>
    </div>
  );
}
