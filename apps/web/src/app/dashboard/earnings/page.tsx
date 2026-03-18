'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { DollarSign, BookOpen, TrendingUp, Users } from 'lucide-react';
import DashboardNav from '@/components/DashboardNav';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function EarningsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalEarnings: 0, pendingEarnings: 0, totalSales: 0, totalBooks: 0 });
  const [books, setBooks] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('ub_token');
    if (!token) { router.push('/auth/login'); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/books`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const booksData = await res.json();
        setBooks(booksData);
        const publishedBooks = booksData.filter((b: any) => b.published);
        const totalSales = publishedBooks.reduce((acc: number, b: any) => acc + (b.published?.totalSales || 0), 0);
        const totalEarnings = publishedBooks.reduce((acc: number, b: any) => acc + (b.published?.totalEarnings || 0), 0);
        setStats({ totalEarnings, pendingEarnings: totalEarnings * 0.7, totalSales, totalBooks: publishedBooks.length });
      }
    } catch (e) {}
    finally { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading earnings...</div>
    </div>
  );

  const publishedBooks = books.filter((b: any) => b.published);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <DashboardNav />
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Writer Earnings</h1>
          <p className="text-slate-400">Track your book sales and revenue</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Total Earnings', value: `$${stats.totalEarnings.toFixed(2)}`, icon: <DollarSign className="text-green-400" size={20} /> },
            { label: 'Your Share (70%)', value: `$${stats.pendingEarnings.toFixed(2)}`, icon: <TrendingUp className="text-blue-400" size={20} /> },
            { label: 'Total Sales', value: stats.totalSales, icon: <Users className="text-purple-400" size={20} /> },
            { label: 'Published Books', value: stats.totalBooks, icon: <BookOpen className="text-yellow-400" size={20} /> },
          ].map((stat, i) => (
            <div key={i} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center mb-3">{stat.icon}</div>
              <div className="text-2xl font-bold mb-1">{stat.value}</div>
              <div className="text-slate-400 text-xs">{stat.label}</div>
            </div>
          ))}
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
          <h2 className="font-bold text-lg mb-4">Revenue Model</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-blue-400">100%</div>
              <div className="text-slate-400 text-sm">Book Sale Price</div>
            </div>
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-red-400">30%</div>
              <div className="text-slate-400 text-sm">Platform Fee</div>
            </div>
            <div className="bg-slate-700 rounded-lg p-4">
              <div className="text-2xl font-bold text-green-400">70%</div>
              <div className="text-slate-400 text-sm">Your Earnings</div>
            </div>
          </div>
        </div>

        <h2 className="text-xl font-bold mb-4">Book Performance</h2>
        {publishedBooks.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-700 rounded-2xl">
            <DollarSign className="mx-auto text-slate-600 mb-4" size={40} />
            <h3 className="text-slate-400 font-semibold mb-2">No published books yet</h3>
            <p className="text-slate-500 text-sm mb-4">Publish a book to start earning</p>
            <Link href="/dashboard" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold">Go to Dashboard</Link>
          </div>
        ) : (
          <div className="bg-slate-800 border border-slate-700 rounded-xl overflow-hidden">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-700">
                  <th className="text-left px-6 py-3 text-xs text-slate-400 uppercase">Book</th>
                  <th className="text-left px-6 py-3 text-xs text-slate-400 uppercase">Price</th>
                  <th className="text-left px-6 py-3 text-xs text-slate-400 uppercase">Sales</th>
                  <th className="text-left px-6 py-3 text-xs text-slate-400 uppercase">Revenue</th>
                  <th className="text-left px-6 py-3 text-xs text-slate-400 uppercase">Your Share</th>
                  <th className="text-left px-6 py-3 text-xs text-slate-400 uppercase">Status</th>
                </tr>
              </thead>
              <tbody>
                {publishedBooks.map((book: any) => (
                  <tr key={book.id} className="border-b border-slate-700 hover:bg-slate-700/30 transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-900/50 rounded-lg flex items-center justify-center">
                          <BookOpen size={14} className="text-blue-400" />
                        </div>
                        <div>
                          <div className="text-sm font-medium line-clamp-1">{book.title}</div>
                          <div className="text-xs text-slate-400">{book.genre}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm">{book.published?.price === 0 ? <span className="text-green-400">Free</span> : `$${book.published?.price}`}</td>
                    <td className="px-6 py-4 text-sm">{book.published?.totalSales || 0}</td>
                    <td className="px-6 py-4 text-sm">${(book.published?.totalEarnings || 0).toFixed(2)}</td>
                    <td className="px-6 py-4 text-sm text-green-400">${((book.published?.totalEarnings || 0) * 0.7).toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${book.published?.isPublic ? 'bg-green-900 text-green-300' : 'bg-slate-700 text-slate-400'}`}>
                        {book.published?.isPublic ? 'Published' : 'Draft'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-8 bg-blue-900/20 border border-blue-800 rounded-xl p-6">
          <h3 className="font-bold mb-2">💰 Payout Information</h3>
          <p className="text-slate-400 text-sm">Stripe Connect integration coming soon. Once enabled, earnings will be automatically transferred to your bank account monthly.</p>
        </div>
      </div>
    </div>
  );
}
