'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Search, Star, TrendingUp, ArrowRight, ChevronRight, LogOut, User, Bell, PenSquare } from 'lucide-react';

const API_URL = "https://api.universal-book.com";

const GENRES = [
  { name: 'Self-Help', emoji: '🌱', color: 'from-green-900 to-green-800' },
  { name: 'Business', emoji: '💼', color: 'from-blue-900 to-blue-800' },
  { name: 'Fantasy', emoji: '🏰', color: 'from-purple-900 to-purple-800' },
  { name: 'Sci-Fi', emoji: '🚀', color: 'from-cyan-900 to-cyan-800' },
  { name: 'Romance', emoji: '💕', color: 'from-pink-900 to-pink-800' },
  { name: 'Thriller', emoji: '🔪', color: 'from-red-900 to-red-800' },
  { name: 'Mystery', emoji: '🔍', color: 'from-yellow-900 to-yellow-800' },
  { name: 'Biography', emoji: '👤', color: 'from-orange-900 to-orange-800' },
  { name: 'Horror', emoji: '👻', color: 'from-slate-900 to-slate-800' },
  { name: 'Technology', emoji: '💻', color: 'from-indigo-900 to-indigo-800' },
  { name: 'History', emoji: '📜', color: 'from-amber-900 to-amber-800' },
  { name: 'Science', emoji: '🔬', color: 'from-teal-900 to-teal-800' },
  { name: 'Philosophy', emoji: '🧠', color: 'from-violet-900 to-violet-800' },
  { name: 'Psychology', emoji: '💭', color: 'from-fuchsia-900 to-fuchsia-800' },
  { name: 'Education', emoji: '🎓', color: 'from-sky-900 to-sky-800' },
  { name: 'Health', emoji: '❤️', color: 'from-rose-900 to-rose-800' },
  { name: 'Travel', emoji: '✈️', color: 'from-emerald-900 to-emerald-800' },
  { name: 'Cooking', emoji: '🍳', color: 'from-lime-900 to-lime-800' },
  { name: 'Poetry', emoji: '✍️', color: 'from-zinc-900 to-zinc-800' },
  { name: 'Literary Fiction', emoji: '📖', color: 'from-stone-900 to-stone-800' },
];

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function MarketplacePage() {
  const [search, setSearch] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [userLoading, setUserLoading] = useState(true);
  const [genreBooks, setGenreBooks] = useState<Record<string, { popular: any[], newest: any[] }>>({});
  const [loading, setLoading] = useState(true);
  const [featuredBooks, setFeaturedBooks] = useState<any[]>([]);

    useEffect(() => {
        fetchMarketplace();
        const setupAuth = async () => {
          try {
            const { auth } = await import('@/lib/firebase');
            if (!auth) return;
            const { onAuthStateChanged } = await import('firebase/auth');
            onAuthStateChanged(auth, async (firebaseUser) => {
              if (firebaseUser) {
                setIsLoggedIn(true);
                const token = await firebaseUser.getIdToken();
                localStorage.setItem('ub_token', token);
                const res = await fetch(`${API_URL}/api/users/me`, {
                  headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                  const data = await res.json();
                  setUser(data);
                }
              } else {
                setIsLoggedIn(false);
                setUser(null);
              }
              setUserLoading(false);
            });
          } catch (e) {
            setUserLoading(false);
          }
        };
        setupAuth();
      }, []);

  const fetchUser = async () => {
      try {
        const token = await getFreshToken();
        const res = await fetch(`${API_URL}/api/users/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) setUser(await res.json());
      } catch (e) {}
      finally { setUserLoading(false); }
    };

  const fetchMarketplace = async () => {
    try {
      const res = await fetch(`${API_URL}/api/marketplace/books?limit=100`);
      if (res.ok) {
        const data = await res.json();
        const books: any[] = data.books || [];
        setFeaturedBooks(books.filter((b: any) => b.isFeatured).slice(0, 6) || books.slice(0, 6));

        // Organize by genre
        const byGenre: Record<string, { popular: any[], newest: any[] }> = {};
        GENRES.forEach(g => {
          const genreBooks = books.filter((b: any) =>
            b.book?.genre?.toLowerCase() === g.name.toLowerCase()
          );
          if (genreBooks.length > 0) {
            const sorted = [...genreBooks].sort((a, b) => b.totalSales - a.totalSales);
            const newest = [...genreBooks].sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime());
            byGenre[g.name] = { popular: sorted.slice(0, 5), newest: newest.slice(0, 5) };
          }
        });
        setGenreBooks(byGenre);
      }
    } catch (e) {}
    finally { setLoading(false); }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (search.trim()) window.location.href = `/books?search=${encodeURIComponent(search)}`;
  };

  const handleLogout = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      if (auth) { const { signOut } = await import('firebase/auth'); await signOut(auth); }
    } catch (e) {}
    localStorage.removeItem('ub_token');
    setIsLoggedIn(false);
    setUser(null);
  };

  const getAvgRating = (reviews: any[]) => {
    if (!reviews?.length) return null;
    return (reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length).toFixed(1);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* NAV */}
      <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold flex-shrink-0">
            <BookOpen className="text-blue-400" size={28} />
            <span className="hidden sm:block">Universal Book</span>
          </Link>

          {/* Search Bar */}
          <form onSubmit={handleSearch} className="flex-1 max-w-xl hidden md:flex">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={18} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search books, authors, genres..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-10 pr-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </form>

          {/* Nav Links */}
          <div className="flex items-center gap-2">
            <Link href="/books" className="hidden md:block text-slate-400 hover:text-white text-sm transition px-2">Browse</Link>
            <Link href="/writers" className="hidden md:block text-slate-400 hover:text-white text-sm transition px-2">Writers</Link>

            {isLoggedIn ? (
              <>
                <Link href="/feed" className="hidden md:flex items-center gap-1 text-slate-400 hover:text-white text-sm transition px-2">
                  🏠 Feed
                </Link>
                <Link href="/dashboard/new-book"
                  className="hidden md:flex items-center gap-1 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">
                  <PenSquare size={14} /> Write
                </Link>
                <Link href="/notifications" className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
                  <Bell size={18} />
                </Link>
                <Link href={`/profile/${user?.id}`}
                  className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm">
                  {userLoading ? '...' : (user?.name?.[0]?.toUpperCase() || '?')}
                </Link>
                <button onClick={handleLogout}
                  className="hidden md:flex items-center gap-1 p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition text-sm">
                  <LogOut size={16} />
                </button>
              </>
            ) : (
              <>
                <Link href="/auth/login" className="px-3 py-1.5 text-slate-400 hover:text-white text-sm transition">Login</Link>
                <Link href="/auth/register" className="px-4 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">
                  Start Writing Free
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Mobile Search */}
        <div className="md:hidden px-4 pb-3">
          <form onSubmit={handleSearch}>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search books..."
                className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
          </form>
        </div>
      </nav>

      {/* HERO */}
      <div className="bg-gradient-to-r from-blue-950 via-slate-900 to-slate-900 py-12 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-4 leading-tight">
            Discover AI-Written Books<br />
            <span className="text-blue-400">From Expert Authors</span>
          </h1>
          <p className="text-slate-400 text-lg mb-6 max-w-2xl mx-auto">
            Thousands of books across every genre. Written by real experts using AI. Learn, explore, and grow.
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            {isLoggedIn ? (
              <>
                <Link href="/dashboard/new-book"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition flex items-center gap-2">
                  ✍️ Write Your Book
                </Link>
                <Link href="/feed"
                  className="px-6 py-3 border border-slate-600 hover:border-blue-500 rounded-xl font-bold transition">
                  🏠 Go to Feed
                </Link>
              </>
            ) : (
              <>
                <Link href="/auth/register"
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition">
                  Start Writing Free
                </Link>
                <Link href="/auth/login"
                  className="px-6 py-3 border border-slate-600 hover:border-blue-500 rounded-xl font-bold transition">
                  Login
                </Link>
              </>
            )}
          </div>
        </div>
      </div>

      {/* GENRE PILLS */}
      <div className="bg-slate-800 border-b border-slate-700 py-4 px-4 overflow-x-auto">
        <div className="max-w-7xl mx-auto flex gap-3 min-w-max md:min-w-0 md:flex-wrap">
          <Link href="/books" className="px-4 py-2 bg-blue-600 rounded-full text-sm font-semibold whitespace-nowrap">
            All Books
          </Link>
          {GENRES.map(g => (
            <Link key={g.name} href={`/books?genre=${g.name}`}
              className="px-4 py-2 bg-slate-700 hover:bg-slate-600 border border-slate-600 hover:border-blue-500 rounded-full text-sm whitespace-nowrap transition">
              {g.emoji} {g.name}
            </Link>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-10 space-y-16">

        {/* Featured Books */}
        {featuredBooks.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <Star className="text-yellow-400" size={24} /> Featured Books
              </h2>
              <Link href="/books?featured=true" className="text-blue-400 hover:text-blue-300 text-sm flex items-center gap-1">
                View all <ChevronRight size={16} />
              </Link>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {featuredBooks.map((pb: any) => (
                <BookCard key={pb.id} pb={pb} getAvgRating={getAvgRating} />
              ))}
            </div>
          </section>
        )}

        {/* Genre Sections — Udemy Style */}
        {loading ? (
          <div className="space-y-8">
            {[1,2,3].map(i => (
              <div key={i}>
                <div className="h-8 bg-slate-800 rounded w-48 mb-4 animate-pulse" />
                <div className="grid grid-cols-5 gap-4">
                  {[1,2,3,4,5].map(j => <div key={j} className="bg-slate-800 rounded-xl h-48 animate-pulse" />)}
                </div>
              </div>
            ))}
          </div>
        ) : Object.keys(genreBooks).length === 0 ? (
          <div className="text-center py-20">
            <BookOpen className="mx-auto text-slate-600 mb-4" size={60} />
            <h2 className="text-2xl font-bold text-slate-400 mb-2">No books published yet</h2>
            <p className="text-slate-500 mb-6">Be the first author to publish on Universal Book!</p>
            <Link href="/auth/register" className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold transition">
              Start Writing Free
            </Link>
          </div>
        ) : (
          GENRES.filter(g => genreBooks[g.name]).map(genre => {
            const { popular, newest } = genreBooks[genre.name];
            return (
              <section key={genre.name}>
                {/* Genre Header */}
                <div className={`bg-gradient-to-r ${genre.color} rounded-2xl p-6 mb-6`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-4xl">{genre.emoji}</span>
                      <div>
                        <h2 className="text-2xl font-bold">{genre.name}</h2>
                        <p className="text-slate-300 text-sm">{popular.length + newest.length} books available</p>
                      </div>
                    </div>
                    <Link href={`/books?genre=${genre.name}`}
                      className="flex items-center gap-1 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm transition">
                      Browse all <ArrowRight size={14} />
                    </Link>
                  </div>
                </div>

                {/* Most Popular */}
                <div className="mb-8">
                  <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <TrendingUp className="text-orange-400" size={18} /> Most Popular in {genre.name}
                  </h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {popular.map((pb: any) => (
                      <BookCard key={pb.id} pb={pb} getAvgRating={getAvgRating} />
                    ))}
                  </div>
                </div>

                {/* New Releases */}
                {newest.some(b => !popular.find(p => p.id === b.id)) && (
                  <div>
                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                      🆕 New in {genre.name}
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                      {newest.filter(b => !popular.find(p => p.id === b.id)).map((pb: any) => (
                        <BookCard key={pb.id} pb={pb} getAvgRating={getAvgRating} />
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })
        )}
      </div>

      {/* Footer */}
      <footer className="border-t border-slate-800 py-8 mt-12">
        <div className="max-w-7xl mx-auto px-6 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2 font-bold">
            <BookOpen className="text-blue-400" size={20} /> Universal Book
          </div>
          <div className="flex gap-6 text-sm text-slate-400 flex-wrap">
            <Link href="/about" className="hover:text-white">About</Link>
            <Link href="/pricing" className="hover:text-white">Pricing</Link>
            <Link href="/writers" className="hover:text-white">Writers</Link>
            <Link href="/privacy" className="hover:text-white">Privacy</Link>
            <Link href="/terms" className="hover:text-white">Terms</Link>
            <Link href="/contact" className="hover:text-white">Contact</Link>
          </div>
          <div className="text-slate-500 text-sm">© 2026 Universal Book</div>
        </div>
      </footer>
    </div>
  );
}

function BookCard({ pb, getAvgRating }: any) {
  const rating = getAvgRating(pb.reviews);
  return (
    <Link href={`/books/${pb.bookId}`}
      className="bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl overflow-hidden transition group">
      {/* Book Cover */}
      <div className="aspect-[3/4] bg-gradient-to-br from-blue-900 to-slate-800 flex items-center justify-center p-4">
        <BookOpen className="text-blue-400 opacity-50 group-hover:opacity-80 transition" size={40} />
      </div>
      {/* Book Info */}
      <div className="p-3">
        <h3 className="font-bold text-xs line-clamp-2 mb-1 leading-tight">{pb.book?.title}</h3>
        <p className="text-slate-500 text-xs mb-1 truncate">{pb.book?.user?.name}</p>
        {rating && (
          <div className="flex items-center gap-1 mb-1">
            <span className="text-yellow-400 text-xs font-bold">{rating}</span>
            <span className="text-yellow-400 text-xs">★</span>
            <span className="text-slate-500 text-xs">({pb.reviews?.length})</span>
          </div>
        )}
        <div className="font-bold text-blue-400 text-sm">
          {pb.price === 0 ? 'Free' : `$${pb.price}`}
        </div>
      </div>
    </Link>
  );
}
