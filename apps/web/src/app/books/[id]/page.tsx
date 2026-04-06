'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Star, ArrowLeft, Heart, Share2, CheckCircle, Wallet, CreditCard, ChevronDown, ChevronUp } from 'lucide-react';
import MarketingNav from '@/components/MarketingNav';

const API_URL = 'https://api.universal-book.com';

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return null;
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
  const [authChecked, setAuthChecked] = useState(false);
  const [buying, setBuying] = useState(false);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [alreadyOwned, setAlreadyOwned] = useState(false);
  const [shareLink, setShareLink] = useState('');
  const [shareCopied, setShareCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [affiliateCode, setAffiliateCode] = useState('');
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);

  useEffect(() => {
    // Capture affiliate code from URL
    const urlParams = new URLSearchParams(window.location.search);
    const ref = urlParams.get('ref');
    if (ref) {
      localStorage.setItem('ub_ref', ref);
      setAffiliateCode(ref);
      fetch(`${API_URL}/api/payments/affiliate/click/${ref}`, { method: 'POST' });
    } else {
      const stored = localStorage.getItem('ub_ref');
      if (stored) setAffiliateCode(stored);
    }

    // Auth check using onAuthStateChanged — the only reliable method
    const initAuth = async () => {
      try {
        const { auth } = await import('@/lib/firebase');
        if (!auth) { setAuthChecked(true); return; }
        const { onAuthStateChanged } = await import('firebase/auth');
        onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            setIsLoggedIn(true);
            const token = await firebaseUser.getIdToken();
            localStorage.setItem('ub_token', token);
            // Fetch credit balance
            const balRes = await fetch(`${API_URL}/api/payments/balance`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (balRes.ok) setCreditBalance((await balRes.json()).balance);
            // Check library
            const libRes = await fetch(`${API_URL}/api/marketplace/library`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (libRes.ok) {
              const lib = await libRes.json();
              const owned = lib.some((p: any) => p.publishedBook?.bookId === bookId || p.bookId === bookId);
              setAlreadyOwned(owned);
            }
          } else {
            setIsLoggedIn(false);
          }
          setAuthChecked(true);
        });
      } catch (e) {
        setAuthChecked(true);
      }
    };

    initAuth();
    fetchBook();
  }, [bookId]);

  // Re-fetch book once auth is checked so we send token for chapter unlocking
  useEffect(() => {
    if (authChecked) fetchBook();
  }, [authChecked]);

  const fetchBook = async () => {
    try {
      const token = await getFreshToken();
      const headers: any = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;
      const res = await fetch(`${API_URL}/api/marketplace/books/${bookId}`, { headers });
      if (!res.ok) throw new Error('Book not found');
      const data = await res.json();
      setBook(data);
      setFollowCount(data.book?.follows?.length || 0);
      if (data.hasAccess) setAlreadyOwned(true);
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
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setFollowing(data.following);
      setFollowCount(prev => data.following ? prev + 1 : prev - 1);
    }
  };

  const handleBuyWithCard = async () => {
    setBuying(true);
    try {
      const token = await getFreshToken();
      if (!token) { router.push('/auth/login'); return; }
      const res = await fetch(`${API_URL}/api/payments/buy-book/card`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookId, affiliateCode: affiliateCode || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Payment failed');
      }
      const { url } = await res.json();
      if (url) window.location.href = url;
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBuying(false);
    }
  };

  const handleBuyWithCredits = async () => {
    setBuying(true);
    try {
      const token = await getFreshToken();
      if (!token) { router.push('/auth/login'); return; }
      const res = await fetch(`${API_URL}/api/payments/buy-book/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookId, affiliateCode: affiliateCode || undefined }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Purchase failed');
      }
      localStorage.removeItem('ub_ref');
      setAlreadyOwned(true);
      await fetchBook();
      router.push('/library');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setBuying(false);
    }
  };

  const handleGetShareLink = async () => {
    if (!isLoggedIn) { router.push('/auth/login'); return; }
    setGeneratingLink(true);
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/payments/affiliate/link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ bookId }),
      });
      if (res.ok) {
        const data = await res.json();
        setShareLink(`${window.location.origin}/books/${bookId}?ref=${data.code}`);
      }
    } catch (e) {}
    setGeneratingLink(false);
  };

  const handleReview = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = await getFreshToken();
    if (!token) { router.push('/auth/login'); return; }
    const res = await fetch(`${API_URL}/api/marketplace/books/${bookId}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
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
  const price = book.price || 0;
  const hasEnoughCredits = creditBalance !== null && creditBalance >= price;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <MarketingNav />

      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/books" className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 w-fit">
          <ArrowLeft size={18} /> Back to Books
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Left: Book Info */}
          <div className="md:col-span-2 space-y-6">
            <div>
              <span className="text-xs bg-blue-900/50 text-blue-300 px-3 py-1 rounded-full border border-blue-700">
                {book.book?.genre}
              </span>
              <h1 className="text-4xl font-bold mt-3">{book.book?.title}</h1>
              {book.book?.subtitle && <p className="text-slate-400 text-lg mt-1">{book.book.subtitle}</p>}
              <div className="flex items-center gap-4 mt-3">
                <Link href={`/writers/${book.book?.user?.id}`} className="text-blue-400 hover:underline text-sm">
                  by {book.book?.user?.name}
                </Link>
                {avgRating && (
                  <div className="flex items-center gap-1 text-yellow-400 text-sm">
                    <Star size={14} fill="currentColor" />
                    <span>{avgRating} ({book.reviews?.length} reviews)</span>
                  </div>
                )}
              </div>
            </div>

            {/* Synopsis */}
            {book.book?.synopsis && (
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <h3 className="font-semibold mb-2 text-slate-300">About this book</h3>
                <p className="text-slate-300 leading-relaxed">{book.book.synopsis}</p>
              </div>
            )}

            {/* First Chapter - Free Preview */}
            {firstChapter && (
              <div>
                <h3 className="font-semibold text-lg mb-3">
                  {book.hasAccess ? `Chapter 1: ${firstChapter.title}` : `Free Preview — Chapter 1: ${firstChapter.title}`}
                </h3>
                <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                  <button
                    onClick={() => setExpandedChapter(expandedChapter === firstChapter.id ? null : firstChapter.id)}
                    className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition"
                  >
                    <span className="text-blue-400 font-medium">{firstChapter.title}</span>
                    {expandedChapter === firstChapter.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                  </button>
                  {expandedChapter === firstChapter.id && firstChapter.content && (
                    <div className="p-6 border-t border-slate-700">
                      <style>{`
                        .book-reader h1, .book-reader h2, .book-reader h3 { color: #f1f5f9; margin: 1rem 0 0.5rem; font-weight: 600; }
                        .book-reader p { margin-bottom: 1rem; color: #cbd5e1; line-height: 1.8; }
                        .book-reader strong { color: #f1f5f9; }
                        .book-reader blockquote { border-left: 3px solid #3b82f6; padding-left: 1rem; color: #94a3b8; font-style: italic; margin: 1rem 0; }
                      `}</style>
                      <div className="book-reader" dangerouslySetInnerHTML={{ __html: firstChapter.content }} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Remaining Chapters */}
            {remainingChapters?.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3">
                  {book.hasAccess
                    ? `${remainingChapters.length} More Chapter${remainingChapters.length > 1 ? 's' : ''}`
                    : `${remainingChapters.length} More Chapter${remainingChapters.length > 1 ? 's' : ''} — Purchase to Unlock`
                  }
                </h3>
                <div className="space-y-2">
                  {remainingChapters.map((ch: any) => (
                    <div key={ch.id}>
                      {book.hasAccess && ch.content ? (
                        <div className="bg-slate-800/50 border border-slate-700 rounded-xl overflow-hidden">
                          <button
                            onClick={() => setExpandedChapter(expandedChapter === ch.id ? null : ch.id)}
                            className="w-full flex items-center justify-between p-4 hover:bg-slate-700/30 transition"
                          >
                            <span className="text-blue-400 font-medium">Chapter {ch.number}: {ch.title}</span>
                            {expandedChapter === ch.id ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                          </button>
                          {expandedChapter === ch.id && (
                            <div className="p-6 border-t border-slate-700">
                              <style>{`
                                .book-reader h1, .book-reader h2, .book-reader h3 { color: #f1f5f9; margin: 1rem 0 0.5rem; font-weight: 600; }
                                .book-reader p { margin-bottom: 1rem; color: #cbd5e1; line-height: 1.8; }
                                .book-reader strong { color: #f1f5f9; }
                                .book-reader blockquote { border-left: 3px solid #3b82f6; padding-left: 1rem; color: #94a3b8; font-style: italic; margin: 1rem 0; }
                              `}</style>
                              <div className="book-reader" dangerouslySetInnerHTML={{ __html: ch.content }} />
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-3 bg-slate-800/30 border border-slate-700 rounded-lg px-4 py-3 opacity-60">
                          <span className="text-slate-500">🔒</span>
                          <span className="text-slate-400 text-sm">Chapter {ch.number}: {ch.title}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reviews */}
            {book.reviews?.length > 0 && (
              <div>
                <h3 className="font-semibold text-lg mb-3">Reviews</h3>
                <div className="space-y-3">
                  {book.reviews.map((r: any) => (
                    <div key={r.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex text-yellow-400">
                          {[...Array(r.rating)].map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
                        </div>
                        <span className="text-slate-400 text-sm">{r.reviewer?.name}</span>
                      </div>
                      {r.comment && <p className="text-slate-300 text-sm">{r.comment}</p>}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right: Purchase Card */}
          <div className="space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 sticky top-24">
              <p className="text-4xl font-bold text-white mb-1">${price.toFixed(2)}</p>
              <p className="text-slate-400 text-sm mb-5">{book.book?.chapters?.length} chapters</p>

              {alreadyOwned ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-emerald-400 bg-emerald-900/20 border border-emerald-700 rounded-xl p-3">
                    <CheckCircle size={18} />
                    <span className="font-semibold">You own this book</span>
                  </div>
                  <Link
                    href="/library"
                    className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
                  >
                    Read in Library
                  </Link>
                </div>
              ) : !authChecked ? (
                <div className="w-full h-12 bg-slate-700 rounded-xl animate-pulse" />
              ) : !isLoggedIn ? (
                <Link
                  href="/auth/login"
                  className="block w-full text-center bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-colors"
                >
                  Login to Purchase
                </Link>
              ) : (
                <div className="space-y-3">
                  <button
                    onClick={handleBuyWithCard}
                    disabled={buying}
                    className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-3 rounded-xl transition-colors"
                  >
                    <CreditCard size={18} />
                    {buying ? 'Processing...' : `Pay $${price.toFixed(2)} with Card`}
                  </button>
                  <button
                    onClick={handleBuyWithCredits}
                    disabled={buying || !hasEnoughCredits}
                    className="w-full flex items-center justify-center gap-2 bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition-colors"
                  >
                    <Wallet size={18} />
                    {`Pay $${price.toFixed(2)} with Credits`}
                  </button>
                  {creditBalance !== null && (
                    <p className="text-xs text-center text-slate-500">
                      Balance: <span className={hasEnoughCredits ? 'text-emerald-400' : 'text-red-400'}>${creditBalance.toFixed(2)}</span>
                      {!hasEnoughCredits && (
                        <Link href="/account/topup" className="text-blue-400 hover:underline ml-1">Top up</Link>
                      )}
                    </p>
                  )}
                </div>
              )}

              <div className="border-t border-slate-700 my-5" />

              <button
                onClick={handleFollow}
                className="w-full flex items-center justify-center gap-2 border border-slate-600 hover:border-pink-500 text-slate-300 hover:text-pink-400 py-2.5 rounded-xl transition-colors text-sm"
              >
                <Heart size={16} className={following ? 'fill-pink-500 text-pink-500' : ''} />
                {following ? 'Following' : 'Follow'} ({followCount})
              </button>

              {/* Affiliate Share */}
              <div className="mt-3">
                {!shareLink ? (
                  <button
                    onClick={handleGetShareLink}
                    disabled={generatingLink || !isLoggedIn}
                    className="w-full flex items-center justify-center gap-2 border border-slate-600 hover:border-blue-500 text-slate-300 hover:text-blue-400 py-2.5 rounded-xl transition-colors text-sm disabled:opacity-50"
                  >
                    <Share2 size={16} />
                    {generatingLink ? 'Generating...' : isLoggedIn ? 'Share & Earn 10%' : 'Login to Share & Earn'}
                  </button>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 text-center">Your affiliate link — earn 10% on sales!</p>
                    <div className="flex gap-2">
                      <input readOnly value={shareLink}
                        className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-300 truncate" />
                      <button
                        onClick={() => { navigator.clipboard.writeText(shareLink); setShareCopied(true); setTimeout(() => setShareCopied(false), 2000); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-xs whitespace-nowrap"
                      >
                        {shareCopied ? '✓ Copied' : 'Copy'}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Author */}
              <div className="mt-5 pt-4 border-t border-slate-700">
                <p className="text-xs text-slate-500 mb-2">Written by</p>
                <Link href={`/writers/${book.book?.user?.id}`} className="flex items-center gap-2 hover:opacity-80">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                    {book.book?.user?.name?.[0]?.toUpperCase()}
                  </div>
                  <span className="text-sm text-slate-300">{book.book?.user?.name}</span>
                </Link>
              </div>
            </div>

            {/* Leave Review */}
            {alreadyOwned && isLoggedIn && (
              <div className="bg-slate-800 border border-slate-700 rounded-2xl p-5">
                <h3 className="font-semibold mb-3">Leave a Review</h3>
                {!reviewing ? (
                  <button onClick={() => setReviewing(true)}
                    className="w-full border border-slate-600 hover:border-yellow-500 text-slate-300 hover:text-yellow-400 py-2 rounded-xl text-sm transition-colors">
                    ⭐ Write a Review
                  </button>
                ) : (
                  <form onSubmit={handleReview} className="space-y-3">
                    <div className="flex gap-1">
                      {[1,2,3,4,5].map(n => (
                        <button key={n} type="button" onClick={() => setRating(n)}>
                          <Star size={20} className={n <= rating ? 'text-yellow-400 fill-yellow-400' : 'text-slate-600'} />
                        </button>
                      ))}
                    </div>
                    <textarea value={comment} onChange={e => setComment(e.target.value)}
                      placeholder="Share your thoughts..." rows={3}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white resize-none" />
                    <div className="flex gap-2">
                      <button type="submit" className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-2 rounded-lg text-sm">Submit</button>
                      <button type="button" onClick={() => setReviewing(false)} className="flex-1 border border-slate-600 text-slate-400 py-2 rounded-lg text-sm">Cancel</button>
                    </div>
                  </form>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}