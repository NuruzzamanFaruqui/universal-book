'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, ShoppingBag, Clock } from 'lucide-react';
import DashboardNav from '@/components/DashboardNav';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function LibraryPage() {
  const router = useRouter();
  const [purchases, setPurchases] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ub_token');
    if (!token) { router.push('/auth/login'); return; }
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/marketplace/library`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setPurchases(await res.json());
    } catch (e) {}
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading library...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <DashboardNav />
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <ShoppingBag className="text-blue-400" size={32} /> My Library
          </h1>
          <p className="text-slate-400">Books you have purchased</p>
        </div>

        {purchases.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-slate-700 rounded-2xl">
            <BookOpen className="mx-auto text-slate-600 mb-4" size={48} />
            <h2 className="text-xl font-semibold text-slate-400 mb-2">No books yet</h2>
            <p className="text-slate-500 mb-6">Browse the marketplace and purchase books to read them here</p>
            <Link href="/books" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold">
              Browse Books
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {purchases.map((purchase: any) => (
              <Link key={purchase.id} href={`/books/${purchase.bookId}`}
                className="bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl p-6 transition block">
                <div className="w-12 h-12 bg-blue-900/50 rounded-xl flex items-center justify-center mb-4">
                  <BookOpen className="text-blue-400" size={22} />
                </div>
                <h3 className="font-bold text-lg mb-1 line-clamp-2">{purchase.publishedBook?.book?.title}</h3>
                <p className="text-slate-400 text-sm mb-3">by {purchase.publishedBook?.book?.user?.name || 'Anonymous'}</p>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Clock size={12} /> {new Date(purchase.createdAt).toLocaleDateString()}
                  </span>
                  <span className="text-green-400 font-semibold">Purchased — ${purchase.amount}</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
