'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, ArrowLeft } from 'lucide-react';

const API_URL = "https://api.universal-book.com";

export default function GenrePage() {
  const params = useParams();
  const genre = decodeURIComponent(params.genre as string);
  const [books, setBooks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchBooks(); }, [genre]);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/api/marketplace/books?genre=${encodeURIComponent(genre)}`);
      if (res.ok) {
        const data = await res.json();
        setBooks(data.books);
        setTotal(data.total);
      }
    } catch (e) {}
    finally { setLoading(false); }
  };

  const genreEmojis: any = {
    'Fantasy': '🏰', 'Sci-Fi': '🚀', 'Romance': '💕', 'Thriller': '🔪',
    'Self-Help': '🌱', 'Business': '💼', 'Mystery': '🔍', 'Horror': '👻',
    'Biography': '👤', 'Literary Fiction': '📖',
  };

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
        <Link href="/books" className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition">
          <ArrowLeft size={16} /> Back to Books
        </Link>

        <div className="flex items-center gap-4 mb-8">
          <div className="text-5xl">{genreEmojis[genre] || '📚'}</div>
          <div>
            <h1 className="text-3xl font-bold">{genre}</h1>
            <p className="text-slate-400">{total} books in this genre</p>
          </div>
        </div>

        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="bg-slate-800 rounded-xl h-56 animate-pulse" />)}
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-slate-700 rounded-2xl">
            <div className="text-6xl mb-4">{genreEmojis[genre] || '📚'}</div>
            <h2 className="text-xl font-semibold text-slate-400 mb-2">No {genre} books yet</h2>
            <p className="text-slate-500 mb-6">Be the first to write a {genre} book!</p>
            <Link href="/auth/register" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold">
              Start Writing
            </Link>
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
                <p className="text-slate-400 text-xs mb-3">by {pb.book?.user?.name || 'Anonymous'}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">{pb.book?.chapters?.length || 0} chapters</span>
                  <span className="text-blue-400 font-bold text-sm">{pb.price === 0 ? 'Free' : `$${pb.price}`}</span>
                </div>
                {pb.reviews?.length > 0 && (
                  <div className="text-yellow-400 text-xs mt-1">
                    ★ {(pb.reviews.reduce((a: number, r: any) => a + r.rating, 0) / pb.reviews.length).toFixed(1)}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
