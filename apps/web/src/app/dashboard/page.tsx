'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Plus, Trash2, Clock } from 'lucide-react';
import DashboardNav from '@/components/DashboardNav';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function DashboardPage() {
  const router = useRouter();
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('ub_token');
    if (!token) { router.push('/auth/login'); return; }
    fetchBooks();
  }, []);

  const fetchBooks = async () => {
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/books`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load books');
      setBooks(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteBook = async (id: string) => {
    if (!confirm('Are you sure you want to delete this book?')) return;
    setDeleting(id);
    try {
      const token = await getFreshToken();
      await fetch(`${API_URL}/api/books/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setBooks(books.filter(b => b.id !== id));
    } catch (err: any) {
      setError('Failed to delete book');
    } finally {
      setDeleting('');
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading your books...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <DashboardNav />
      <div className="max-w-6xl mx-auto px-8 py-12">
        {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-6">{error}</div>}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Books</h1>
            <p className="text-slate-400 mt-1">{books.length} book{books.length !== 1 ? 's' : ''} created</p>
          </div>
          <Link href="/dashboard/new-book" className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition">
            <Plus size={18} /> New Book
          </Link>
        </div>
        {books.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-slate-700 rounded-2xl">
            <BookOpen className="mx-auto text-slate-600 mb-4" size={48} />
            <h2 className="text-xl font-semibold text-slate-400 mb-2">No books yet</h2>
            <p className="text-slate-500 mb-6">Create your first AI-powered book</p>
            <Link href="/dashboard/new-book" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition">Create Your First Book</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book) => (
              <div key={book.id} className="bg-slate-800 border border-slate-700 rounded-xl p-6 hover:border-blue-500 transition group">
                <div className="flex items-start justify-between mb-4">
                  <BookOpen className="text-blue-400" size={28} />
                  <button onClick={() => deleteBook(book.id)} disabled={deleting === book.id}
                    className="text-slate-600 hover:text-red-400 transition opacity-0 group-hover:opacity-100">
                    <Trash2 size={16} />
                  </button>
                </div>
                <h3 className="font-bold text-lg mb-1 line-clamp-2">{book.title}</h3>
                {book.subtitle && <p className="text-slate-400 text-sm mb-2 line-clamp-1">{book.subtitle}</p>}
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full">{book.genre}</span>
                  <span className="text-xs bg-slate-700 text-slate-300 px-2 py-1 rounded-full">{book.chapters?.length || 0} chapters</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${book.status === 'COMPLETE' ? 'bg-green-900 text-green-300' : book.status === 'GENERATING' ? 'bg-yellow-900 text-yellow-300' : 'bg-slate-700 text-slate-300'}`}>{book.status}</span>
                </div>
                <div className="flex items-center gap-1 text-slate-500 text-xs mb-4">
                  <Clock size={12} />
                  {new Date(book.createdAt).toLocaleDateString()}
                </div>
                <Link href={`/dashboard/books/${book.id}`} className="block w-full text-center py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">
                  Open Book
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
