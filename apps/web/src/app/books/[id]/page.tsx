'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Star, ArrowLeft, Heart, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function PublicBookPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [following, setFollowing] = useState(false);
  const [followCount, setFollowCount] = useState(0);
  const [reviewing, setReviewing] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [buying, setBuying] = useState(false);

  useEffect(() => {
    fetchBook();
    checkLogin();
  }, [bookId]);

  const checkLogin = async () => {
    const token = localStorage.getItem('ub_token');
    setIsLoggedIn(!!token);
  };

  const fetchBook = async () => {
    try {
      const res = await fetch(`${API_URL}/api/marketplace/books/${bookId}`);
      if (!res.ok) throw new Error('Book not found');
      const data = await res.json();
      setBook(data);
      setFollowCount(data.book?.follows?.length || 0);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    const token = await getFreshToken();
    if (!token) { router.push('/auth/login'); return; }
    const res = await fetch(`${API_URL}/api/marketplace/books/${bookId}/follow`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setFollowing(data.following);
      setFollowCount(prev => data.following ? prev + 1 : prev - 1);
    }
  };

  const handleBuy = async () => {
    if (!isLoggedIn) { router.push('/auth/login'); return; }
    setBuying(true);
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/payments/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ plan: 'BOOK', bookId, amount: book.price }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error('Payment system not configured yet. Please try again later.');
      }
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBuying(false);
    }
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getFreshToken();
    if (!token) { router.push('/auth/login'); return; }
    const res = await fetch(`${API_URL}/api/marketplace/books/${bookId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ rating, comment }),
    });
    if (res.ok) { setReviewing(false); fetchBook(); }
  };

  const getAvgRating = () => {
    if (!book?.reviews?.length) return null;
    return (book.reviews.reduce((acc: number, r: any) => acc + r.rating, 0) / book.reviews.length).toFixed(1);
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading book...</div>
    </div>
  );

  if (error || !book) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-red-400 text-xl mb-4">{error || 'Book not found'}</div>
        <Link href="/books" className="text-blue-400 hover:text-blue-300">Browse Books</Link>
      </div>
    </div>
  );

  const avgRating = getAvgRating();
  const firstChapter = book.book?.chapters?.[0];
  const remainingChapters = book.book?.chapters?.slice(1);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="sticky top-0 z-50 bg-slate-900/90 backdrop-blur border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 text-xl font-bold">
            <BookOpen className="text-blue-400" size={28} />
            <span>Universal Book</span>
          </Link>
          <div className="flex gap-3">
            {isLoggedIn ? (
              <Link href="/dashboard" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold">Dashboard</Link>
            ) : (
              <>
                <Link href="/auth/login" className="px-4 py-2 text-slate-400 hover:text-white text-sm">Login</Link>
                <Link href="/auth/register" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold">Start Writing</Link>
              </>
            )}
          </div>
        </div>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/books" className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition">
          <ArrowLeft size={16} /> Back to Books
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Main Content */}
          <div className="md:col-span-2">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-16 h-16 bg-blue-900/50 rounded-xl flex items-center justify-center flex-shrink-0">
                <BookOpen className="text-blue-400" size={28} />
              </div>
              <div>
                <h1 className="text-3xl font-bold mb-1">{book.book?.title}</h1>
                {book.book?.subtitle && <p className="text-slate-400 mb-2">{book.book?.subtitle}</p>}
                <div className="flex items-center gap-3 flex-wrap">
                  <Link href={`/writers/${book.book?.user?.id}`} className="text-blue-400 hover:text-blue-300 text-sm">
                    by {book.book?.user?.name || 'Anonymous'}
                  </Link>
                  <span className="text-slate-600">·</span>
                  <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">{book.book?.genre}</span>
                  {avgRating && (
                    <span className="text-yellow-400 text-sm flex items-center gap-1">
                      <Star size={14} /> {avgRating} ({book.reviews?.length} reviews)
                    </span>
                  )}
                  <span className="text-slate-400 text-sm flex items-center gap-1">
                    <Heart size={14} className="text-red-400" /> {followCount} followers
                  </span>
                </div>
              </div>
            </div>

            {book.book?.synopsis && (
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
                <h2 className="font-bold mb-3">Synopsis</h2>
                <p className="text-slate-300 leading-relaxed">{book.book?.synopsis}</p>
              </div>
            )}

            {/* FREE PREVIEW - First Chapter */}
            {firstChapter && (
              <div className="mb-6">
                <h2 className="text-xl font-bold mb-4">Free Preview</h2>
                <div className="bg-slate-800 border border-green-800 rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between p-4 border-b border-slate-700">
                    <div className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-green-900/50 flex items-center justify-center text-xs text-green-400 font-bold">1</div>
                      <div>
                        <div className="font-medium">{firstChapter.title}</div>
                        <div className="text-xs text-green-400">Free Preview</div>
                      </div>
                    </div>
                    <button onClick={() => setExpandedChapter(expandedChapter === firstChapter.id ? null : firstChapter.id)}
                      className="text-slate-400 hover:text-white transition">
                      {expandedChapter === firstChapter.id ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
                    </button>
                  </div>
                    {expandedChapter === firstChapter.id && firstChapter.content && (
                      <div className="p-6">
                        <div style={{
                          color: '#e2e8f0',
                          lineHeight: '1.9',
                          fontSize: '1.05rem',
                          fontFamily: 'Georgia, serif',
                        }}>
                          <style>{`
                            .book-reader h1 { font-size: 1.8rem; font-weight: 700; margin: 1.5rem 0 1rem; color: #f1f5f9; }
                            .book-reader h2 { font-size: 1.4rem; font-weight: 600; margin: 1.3rem 0 0.8rem; color: #f1f5f9; }
                            .book-reader h3 { font-size: 1.2rem; font-weight: 600; margin: 1rem 0 0.6rem; color: #e2e8f0; }
                            .book-reader p { margin-bottom: 1.2rem; }
                            .book-reader strong { color: #f1f5f9; font-weight: 700; }
                            .book-reader em { font-style: italic; color: #cbd5e1; }
                            .book-reader ul { list-style: disc; padding-left: 1.8rem; margin-bottom: 1.2rem; }
                            .book-reader ol { list-style: decimal; padding-left: 1.8rem; margin-bottom: 1.2rem; }
                            .book-reader li { margin-bottom: 0.4rem; }
                            .book-reader blockquote { border-left: 3px solid #3b82f6; padding-left: 1rem; color: #94a3b8; font-style: italic; margin: 1.2rem 0; }
                            .book-reader code { background: #1e293b; padding: 0.2rem 0.4rem; border-radius: 4px; font-family: monospace; font-size: 0.9rem; }
                            .book-reader hr { border: none; border-top: 1px solid #334155; margin: 1.5rem 0; }
                          `}</style>
                          <div className="book-reader" dangerouslySetInnerHTML={{ __html: firstChapter.content }} />
                        </div>
                      </div>
                    )}
                  {expandedChapter === firstChapter.id && !firstChapter.content && (
                    <div className="p-6 text-slate-400 text-sm">Chapter content not available yet.</div>
                  )}
                </div>
              </div>
            )}

            {/* Locked Chapters */}
            {remainingChapters?.length > 0 && (
              <div className="mb-8">
                <h2 className="text-xl font-bold mb-4">Remaining Chapters ({remainingChapters.length})</h2>
                <div className="space-y-2">
                  {remainingChapters.map((ch: any) => (
                    <div key={ch.id} className="flex items-center gap-3 p-3 bg-slate-800/50 border border-slate-800 rounded-lg opacity-75">
                      <div className="w-7 h-7 rounded-full bg-slate-700 flex items-center justify-center text-xs text-slate-500 font-bold flex-shrink-0">
                        {ch.number}
                      </div>
                      <div className="flex-1">
                        <div className="text-sm text-slate-400">{ch.title}</div>
                      </div>
                      <span className="text-slate-500 text-lg">🔒</span>
                    </div>
                  ))}
                </div>
                {book.price > 0 && (
                  <div className="mt-4 p-4 bg-blue-900/20 border border-blue-800 rounded-xl text-center">
                    <p className="text-slate-300 text-sm mb-3">Purchase this book to unlock all {remainingChapters.length} remaining chapters</p>
                    <button onClick={handleBuy} disabled={buying}
                      className="px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-semibold transition">
                      {buying ? 'Redirecting...' : `Buy for $${book.price} — Unlock All Chapters`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Reviews */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold">Reviews ({book.reviews?.length || 0})</h2>
                {isLoggedIn && (
                  <button onClick={() => setReviewing(!reviewing)}
                    className="px-4 py-2 border border-slate-600 hover:border-blue-500 rounded-lg text-sm transition">
                    Write Review
                  </button>
                )}
              </div>

              {reviewing && (
                <form onSubmit={handleReview} className="bg-slate-800 border border-slate-700 rounded-xl p-5 mb-4">
                  <div className="mb-3">
                    <label className="block text-sm text-slate-400 mb-2">Rating</label>
                    <div className="flex gap-2">
                      {[1,2,3,4,5].map(r => (
                        <button key={r} type="button" onClick={() => setRating(r)}
                          className={`text-2xl transition ${r <= rating ? 'text-yellow-400' : 'text-slate-600'}`}>★</button>
                      ))}
                    </div>
                  </div>
                  <div className="mb-3">
                    <label className="block text-sm text-slate-400 mb-2">Comment</label>
                    <textarea value={comment} onChange={e => setComment(e.target.value)} rows={3}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                  </div>
                  <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold">Submit Review</button>
                </form>
              )}

              {book.reviews?.length === 0 ? (
                <div className="text-slate-400 text-sm text-center py-6 bg-slate-800 rounded-xl border border-slate-700">
                  No reviews yet. Be the first to review!
                </div>
              ) : (
                <div className="space-y-3">
                  {book.reviews?.map((review: any) => (
                    <div key={review.id} className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                          {review.reviewer?.name?.[0] || '?'}
                        </div>
                        <div>
                          <div className="text-sm font-medium">{review.reviewer?.name}</div>
                          <div className="text-yellow-400 text-xs">{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</div>
                        </div>
                      </div>
                      {review.comment && <p className="text-slate-300 text-sm">{review.comment}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 sticky top-24">
              <div className="text-3xl font-extrabold text-blue-400 mb-1">
                {book.price === 0 ? 'Free' : `$${book.price}`}
              </div>
              <div className="text-slate-400 text-sm mb-4">
                {book.price === 0 ? 'Available for free' : 'One-time purchase — own forever'}
              </div>

              <div className="space-y-3">
                {book.price === 0 ? (
                  <button onClick={() => setExpandedChapter(firstChapter?.id)}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-green-600 hover:bg-green-500 rounded-xl font-semibold transition">
                    📖 Read Free
                  </button>
                ) : (
                  <button onClick={handleBuy} disabled={buying}
                    className="w-full flex items-center justify-center gap-2 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-semibold transition">
                    <ShoppingCart size={18} />
                    {buying ? 'Redirecting...' : `Buy for $${book.price}`}
                  </button>
                )}
                <button onClick={handleFollow}
                  className={`w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm transition border ${
                    following ? 'border-red-500 text-red-400 hover:bg-red-900/20' : 'border-slate-600 hover:border-blue-500 text-slate-300'
                  }`}>
                  <Heart size={16} />
                  {following ? `Following (${followCount})` : `Follow (${followCount})`}
                </button>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700 space-y-2 text-sm text-slate-400">
                <div className="flex justify-between">
                  <span>Chapters</span>
                  <span className="text-white">{book.book?.chapters?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Language</span>
                  <span className="text-white">{book.book?.language || 'English'}</span>
                </div>
                <div className="flex justify-between">
                  <span>Genre</span>
                  <span className="text-white">{book.book?.genre}</span>
                </div>
                <div className="flex justify-between">
                  <span>Sales</span>
                  <span className="text-white">{book.totalSales || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Followers</span>
                  <span className="text-white">{followCount}</span>
                </div>
              </div>
            </div>

            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h3 className="font-bold mb-3">About the Writer</h3>
              <Link href={`/writers/${book.book?.user?.id}`} className="flex items-center gap-3 hover:opacity-80 transition">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold">
                  {book.book?.user?.name?.[0] || '?'}
                </div>
                <div>
                  <div className="font-medium text-sm">{book.book?.user?.name}</div>
                  <div className="text-slate-400 text-xs">View profile →</div>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
