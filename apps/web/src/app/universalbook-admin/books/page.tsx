'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Search, RefreshCw, BookOpen } from 'lucide-react';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function AdminBooksPage() {
  const [books, setBooks] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => { fetchBooks(); }, []);

  useEffect(() => {
    let result = books;
    if (search) result = result.filter(b => b.title?.toLowerCase().includes(search.toLowerCase()) || b.genre?.toLowerCase().includes(search.toLowerCase()));
    if (statusFilter !== 'ALL') result = result.filter(b => b.status === statusFilter);
    setFiltered(result);
  }, [search, statusFilter, books]);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/admin/books`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setBooks(data);
        setFiltered(data);
      }
    } catch (e) {}
    finally { setLoading(false); }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Books</h1>
          <p className="text-gray-400 text-sm mt-1">{books.length} total books generated</p>
        </div>
        <button onClick={fetchBooks} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total', value: books.length },
          { label: 'Complete', value: books.filter(b => b.status === 'COMPLETE').length },
          { label: 'Generating', value: books.filter(b => b.status === 'GENERATING').length },
          { label: 'Draft', value: books.filter(b => b.status === 'DRAFT').length },
        ].map((stat, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-gray-400 text-sm">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by title or genre..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none"
        >
          <option value="ALL">All Status</option>
          <option value="COMPLETE">Complete</option>
          <option value="GENERATING">Generating</option>
          <option value="DRAFT">Draft</option>
          <option value="FAILED">Failed</option>
        </select>
      </div>

      {/* Books Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider">Book</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider">Genre</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider">Chapters</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider">Status</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider">Created</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">Loading books...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={5} className="px-6 py-8 text-center text-gray-400">No books found</td></tr>
            ) : (
              filtered.map((book, i) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-green-900/50 flex items-center justify-center flex-shrink-0">
                        <BookOpen size={14} className="text-green-400" />
                      </div>
                      <div>
                        <div className="text-sm font-medium line-clamp-1">{book.title}</div>
                        {book.subtitle && <div className="text-xs text-gray-400 line-clamp-1">{book.subtitle}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full">{book.genre}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-300">{book.chapters?.length || 0}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      book.status === 'COMPLETE' ? 'bg-green-900 text-green-300' :
                      book.status === 'GENERATING' ? 'bg-yellow-900 text-yellow-300' :
                      book.status === 'FAILED' ? 'bg-red-900 text-red-300' :
                      'bg-gray-800 text-gray-400'
                    }`}>{book.status}</span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {book.createdAt ? new Date(book.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
