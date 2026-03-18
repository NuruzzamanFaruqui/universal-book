'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Users, BookOpen, TrendingUp, Zap, RefreshCw } from 'lucide-react';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function AdminDashboard() {
  const [stats, setStats] = useState({ totalUsers: 0, totalBooks: 0, totalChapters: 0 });
  const [recentUsers, setRecentUsers] = useState<any[]>([]);
  const [recentBooks, setRecentBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchStats(); }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      const token = await getFreshToken();
      const [usersRes, booksRes] = await Promise.all([
        fetch(`${API_URL}/api/admin/users`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/admin/books`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (usersRes.ok) {
        const users = await usersRes.json();
        setRecentUsers(users.slice(0, 5));
        setStats(prev => ({ ...prev, totalUsers: users.length }));
      }
      if (booksRes.ok) {
        const books = await booksRes.json();
        setRecentBooks(books.slice(0, 5));
        const chapters = books.reduce((acc: number, b: any) => acc + (b.chapters?.length || 0), 0);
        setStats(prev => ({ ...prev, totalBooks: books.length, totalChapters: chapters }));
      }
    } catch (e) {}
    finally { setLoading(false); }
  };

  const statCards = [
    { label: 'Total Users', value: stats.totalUsers, icon: <Users className="text-blue-400" size={24} /> },
    { label: 'Total Books', value: stats.totalBooks, icon: <BookOpen className="text-green-400" size={24} /> },
    { label: 'Chapters Written', value: stats.totalChapters, icon: <TrendingUp className="text-purple-400" size={24} /> },
    { label: 'AI Generations', value: stats.totalChapters, icon: <Zap className="text-yellow-400" size={24} /> },
  ];

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-gray-400 text-sm mt-1">Universal Book platform overview</p>
        </div>
        <button onClick={fetchStats} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {statCards.map((card, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-6">
            <div className="w-10 h-10 bg-gray-800 rounded-lg flex items-center justify-center mb-4">
              {card.icon}
            </div>
            <div className="text-3xl font-bold mb-1">{loading ? '...' : card.value}</div>
            <div className="text-gray-400 text-sm">{card.label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-bold mb-4">Recent Users</h2>
          {loading ? <div className="text-gray-400 text-sm">Loading...</div> :
          recentUsers.length === 0 ? <div className="text-gray-400 text-sm">No users yet</div> : (
            <div className="space-y-3">
              {recentUsers.map((user, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                    {user.name?.[0] || user.email?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{user.name || 'No name'}</div>
                    <div className="text-xs text-gray-400 truncate">{user.email}</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    user.plan === 'AUTHOR' ? 'bg-blue-900 text-blue-300' :
                    user.plan === 'PUBLISHER' ? 'bg-purple-900 text-purple-300' :
                    'bg-gray-800 text-gray-400'
                  }`}>{user.plan || 'FREE'}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
          <h2 className="font-bold mb-4">Recent Books</h2>
          {loading ? <div className="text-gray-400 text-sm">Loading...</div> :
          recentBooks.length === 0 ? <div className="text-gray-400 text-sm">No books yet</div> : (
            <div className="space-y-3">
              {recentBooks.map((book, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-green-900/50 flex items-center justify-center">
                    <BookOpen size={14} className="text-green-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{book.title}</div>
                    <div className="text-xs text-gray-400">{book.genre} · {book.chapters?.length || 0} chapters</div>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    book.status === 'COMPLETE' ? 'bg-green-900 text-green-300' :
                    book.status === 'GENERATING' ? 'bg-yellow-900 text-yellow-300' :
                    'bg-gray-800 text-gray-400'
                  }`}>{book.status}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
