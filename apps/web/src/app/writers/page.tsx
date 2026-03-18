'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Users, Search } from 'lucide-react';

const API_URL = "https://api.universal-book.com";

export default function WritersPage() {
  const [writers, setWriters] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => { fetchWriters(); }, []);

  const fetchWriters = async () => {
    try {
      const res = await fetch(`${API_URL}/api/marketplace/top-writers`);
      if (res.ok) setWriters(await res.json());
    } catch (e) {}
    finally { setLoading(false); }
  };

  const filtered = writers.filter(w =>
    w.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <BookOpen className="text-blue-400" size={28} />
            <span>Universal Book</span>
          </Link>
          <div className="flex gap-3">
            <Link href="/auth/login" className="px-4 py-2 text-slate-400 hover:text-white text-sm">Login</Link>
            <Link href="/auth/register" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold">Start Writing</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
            <Users className="text-blue-400" size={32} /> Writers
          </h1>
          <p className="text-slate-400">Discover talented writers on Universal Book</p>
        </div>

        {/* Search */}
        <div className="relative max-w-md mb-8">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search writers..."
            className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3,4,5,6].map(i => <div key={i} className="bg-slate-800 rounded-xl h-40 animate-pulse" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-slate-700 rounded-2xl">
            <Users className="mx-auto text-slate-600 mb-4" size={48} />
            <h2 className="text-xl font-semibold text-slate-400 mb-2">No writers found</h2>
            <p className="text-slate-500 mb-6">Be the first writer on Universal Book!</p>
            <Link href="/auth/register" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold">
              Start Writing
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filtered.map((writer: any) => (
              <Link key={writer.id} href={`/writers/${writer.id}`}
                className="bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl p-6 transition block">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold flex-shrink-0">
                    {writer.name?.[0] || '?'}
                  </div>
                  <div>
                    <div className="font-bold text-lg">{writer.name}</div>
                    <div className="text-slate-400 text-sm">{writer.followers?.length || 0} followers</div>
                  </div>
                </div>
                {writer.bio && <p className="text-slate-400 text-sm mb-4 line-clamp-2">{writer.bio}</p>}
                <div className="flex items-center gap-4 text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <BookOpen size={14} /> {writer.books?.length || 0} books
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
