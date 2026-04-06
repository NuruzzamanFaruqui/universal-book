'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Search } from 'lucide-react';
import MarketingNav from '@/components/MarketingNav';

const API_URL = "https://api.universal-book.com";
const GENRES = ['All','Fantasy','Sci-Fi','Romance','Thriller','Self-Help','Business','Mystery','Horror','Biography'];

export default function BooksPage() {
  const searchParams = useSearchParams();
  const [books, setBooks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [genre, setGenre] = useState(searchParams.get('genre') || 'All');
  const [page, setPage] = useState(1);

  useEffect(() => { fetchBooks(); }, [genre, page]);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (genre && genre !== 'All') params.set('genre', genre);
      if (search) params.set('search', search);
      params.set('page', String(page));
      const res = await fetch(`${API_URL}/api/marketplace/books?${params}`);
      if (res.ok) {
        const data = await res.json();
        setBooks(data.books);
        setTotal(data.total);
      }
    } catch (e) {}
    finally { setLoading(false); }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchBooks();
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <MarketingNav />

      <div className="max-w-7xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Browse Books</h1>
          <p className="text-slate-400">{total} books available</p>
        </div>

        <div className="flex gap-4 mb-6 flex-wrap">
          <form onSubmit={handleSearch} className="flex gap-2 flex-1">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search books..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
            </div>
            <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold">Search</button>
          </form>
        </div>

        <div className="flex gap-2 flex-wrap mb-8">
          {GENRES.map(g => (
            <button key={g} onClick={() => { setGenre(g); setPage(1); }}
              className={`px-4 py-1.5 rounded-full text-sm transition ${
                genre === g ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
              }`}>
              {g}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="bg-slate-800 rounded-xl h-56 animate-pulse" />)}
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-slate-700 rounded-2xl">
            <BookOpen className="mx-auto text-slate-600 mb-4" size={48} />
            <h2 className="text-xl font-semibold text-slate-400 mb-2">No books found</h2>
            <p className="text-slate-500 mb-6">Be the first to publish a book!</p>
            <Link href="/auth/register" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold">Start Writing</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {books.map((pb: any) => (
              <Link key={pb.id} href={`/books/${pb.bookId}`}
                className="bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl p-5 transition block">
                <div className="w-10 h-10 bg-blue-900/50 rounded-lg flex items-center justify-center mb-3">
                  <BookOpen className="text-blue-400" size={18} />
                </div>
                <h3 className="font-bold mb-1 line-clamp-2 text-sm">{pb.book?.title}</h3>
                <p className="text-slate-400 text-xs mb-1">by {pb.book?.user?.name || 'Anonymous'}</p>
                <p className="text-slate-500 text-xs mb-3">{pb.book?.genre}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{pb.book?.chapters?.length || 0} chapters</span>
                  <span className="text-blue-400 font-bold text-sm">{pb.price === 0 ? 'Free' : `$${pb.price}`}</span>
                </div>
                {pb.reviews?.length > 0 && (
                  <div className="text-yellow-400 text-xs mt-1">
                    ★ {(pb.reviews.reduce((a: number, r: any) => a + r.rating, 0) / pb.reviews.length).toFixed(1)}
                    <span className="text-slate-500 ml-1">({pb.reviews.length})</span>
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}

        {total > 12 && (
          <div className="flex justify-center gap-3 mt-10">
            <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg text-sm">Previous</button>
            <span className="px-4 py-2 text-slate-400 text-sm">Page {page} of {Math.ceil(total/12)}</span>
            <button onClick={() => setPage(p => p+1)} disabled={page >= Math.ceil(total/12)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg text-sm">Next</button>
          </div>
        )}
      </div>
    </div>
  );
}