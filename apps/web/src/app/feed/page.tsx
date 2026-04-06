'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen, PenSquare, Heart, MessageCircle, Repeat2,
  Sparkles, Upload, Wallet, TrendingUp, Users, Plus,
  LayoutDashboard, Library, DollarSign, Link2, Search
} from 'lucide-react';
import AppNav from '@/components/AppNav';
import BottomTabBar from '@/components/BottomTabBar';

const API_URL = 'https://api.universal-book.com';

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return null;
}

export default function FeedPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') || 'feed';
  const [activeTab, setActiveTab] = useState(initialTab);
  const [user, setUser] = useState<any>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      if (!auth) { router.push('/auth/login'); return; }
      const { onAuthStateChanged } = await import('firebase/auth');
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (!firebaseUser) { router.push('/auth/login'); return; }
        const token = await firebaseUser.getIdToken();
        localStorage.setItem('ub_token', token);
        const [userRes, balRes] = await Promise.all([
          fetch(`${API_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetch(`${API_URL}/api/payments/balance`, { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (userRes.ok) setUser(await userRes.json());
        if (balRes.ok) setCreditBalance((await balRes.json()).balance);
        setLoading(false);
      });
    } catch (e) { setLoading(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <div className="text-center">
        <BookOpen className="text-blue-400 mx-auto mb-3 animate-pulse" size={40} />
        <p className="text-slate-400">Loading...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <AppNav />

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="flex gap-6">

          {/* LEFT SIDEBAR — desktop only */}
          <aside className="hidden lg:flex flex-col w-60 shrink-0 gap-3">
            {/* Profile Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center text-lg font-bold shrink-0">
                  {user?.name?.[0]?.toUpperCase() || '?'}
                </div>
                <div className="min-w-0">
                  <p className="font-bold text-sm truncate">{user?.name}</p>
                  <p className="text-slate-400 text-xs truncate">{user?.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="bg-slate-800 rounded-lg py-2">
                  <p className="font-bold text-white">{user?.books?.length || 0}</p>
                  <p className="text-slate-400">Books</p>
                </div>
                <div className="bg-slate-800 rounded-lg py-2">
                  <p className="font-bold text-white">{user?.followers?.length || 0}</p>
                  <p className="text-slate-400">Followers</p>
                </div>
              </div>
            </div>

            {/* Navigation */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3">
              {[
                { icon: <TrendingUp size={17} />, label: 'Feed', tab: 'feed' },
                { icon: <BookOpen size={17} />, label: 'Discover Books', tab: 'discover' },
                { icon: <LayoutDashboard size={17} />, label: 'My Books', tab: 'mine' },
                { icon: <Library size={17} />, label: 'My Library', tab: 'library' },
                { icon: <DollarSign size={17} />, label: 'Earnings', tab: 'earnings' },
                { icon: <Link2 size={17} />, label: 'Affiliate Links', tab: 'affiliate' },
                { icon: <Users size={17} />, label: 'Groups', href: '/groups' },
              ].map(item => (
                item.href ? (
                  <Link key={item.label} href={item.href}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-slate-400 hover:text-white hover:bg-slate-800 transition-colors">
                    {item.icon} {item.label}
                  </Link>
                ) : (
                  <button key={item.label}
                    onClick={() => setActiveTab(item.tab!)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-colors ${
                      activeTab === item.tab
                        ? 'bg-blue-600/20 text-blue-400'
                        : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }`}>
                    {item.icon} {item.label}
                  </button>
                )
              ))}
            </div>

            {/* Credits */}
            <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-1">
                <Wallet size={16} className="text-emerald-400" />
                <p className="text-xs text-slate-400">Credit Balance</p>
              </div>
              <p className="text-2xl font-bold text-emerald-400 mb-3">
                {creditBalance === null ? '...' : `$${creditBalance.toFixed(2)}`}
              </p>
              <Link href="/account/topup"
                className="block w-full text-center bg-emerald-700 hover:bg-emerald-600 text-white text-sm font-semibold py-2 rounded-xl transition-colors">
                + Add Credits
              </Link>
            </div>

            {/* Create Book Button */}
            <Link href="/dashboard/new-book"
              className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-500 text-white font-semibold py-3 rounded-2xl transition-colors">
              <Plus size={18} /> Create Book
            </Link>
          </aside>

          {/* MAIN CONTENT */}
          <main className="flex-1 min-w-0">
            {/* Tab Bar — desktop */}
            <div className="hidden md:flex border-b border-slate-800 mb-6">
              {[
                { key: 'feed', label: '📰 Feed' },
                { key: 'discover', label: '📖 Discover' },
                { key: 'mine', label: '📚 Mine' },
              ].map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`px-6 py-3 text-sm font-semibold border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? 'border-blue-500 text-blue-400'
                      : 'border-transparent text-slate-400 hover:text-white'
                  }`}>
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            {activeTab === 'feed' && <FeedTab user={user} />}
            {activeTab === 'discover' && <DiscoverTab />}
            {activeTab === 'mine' && <MineTab creditBalance={creditBalance} />}
            {activeTab === 'library' && <LibraryTab />}
            {activeTab === 'earnings' && <EarningsTab />}
            {activeTab === 'affiliate' && <AffiliateTab />}
          </main>

          {/* RIGHT PANEL — desktop only */}
          <aside className="hidden xl:flex flex-col w-72 shrink-0 gap-4">
            {/* Quick Stats */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
              <h3 className="font-semibold text-sm mb-3 text-slate-300">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">💳 Credits</span>
                  <span className="text-emerald-400 font-bold">
                    {creditBalance === null ? '...' : `$${creditBalance.toFixed(2)}`}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">📚 My Books</span>
                  <span className="text-white font-bold">{user?.books?.length || 0}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-slate-400 text-sm">👥 Followers</span>
                  <span className="text-white font-bold">{user?.followers?.length || 0}</span>
                </div>
              </div>
            </div>

            {/* Trending Hashtags */}
            <TrendingPanel />

            {/* Suggested Writers */}
            <SuggestedWriters />
          </aside>
        </div>
      </div>

      {/* Mobile Bottom Tab Bar */}
      <BottomTabBar />

      {/* Bottom padding for mobile tab bar */}
      <div className="h-20 md:hidden" />
    </div>
  );
}

// ─── FEED TAB ────────────────────────────────────────────────────────────────
function FeedTab({ user }: { user: any }) {
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedType, setFeedType] = useState<'following' | 'explore'>('following');
  const [postContent, setPostContent] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => { fetchPosts(); }, [feedType]);

  const fetchPosts = async () => {
    setLoading(true);
    try {
      const token = await getFreshToken();
      const endpoint = feedType === 'following' ? '/api/social/feed' : '/api/social/explore';
      const res = await fetch(`${API_URL}${endpoint}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setPosts(data.posts || []);
      }
    } catch (e) {}
    setLoading(false);
  };

  const handlePost = async () => {
    if (!postContent.trim()) return;
    setPosting(true);
    try {
      const token = await getFreshToken();
      const hashtags = (postContent.match(/#\w+/g) || []).map((h: string) => h.slice(1));
      const res = await fetch(`${API_URL}/api/social/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ content: postContent, hashtags }),
      });
      if (res.ok) {
        setPostContent('');
        fetchPosts();
      }
    } catch (e) {}
    setPosting(false);
  };

  const handleLike = async (postId: string) => {
    const token = await getFreshToken();
    await fetch(`${API_URL}/api/social/posts/${postId}/like`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchPosts();
  };

  return (
    <div className="space-y-4">
      {/* Post Composer */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <div className="flex gap-3">
          <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold shrink-0">
            {user?.name?.[0]?.toUpperCase() || '?'}
          </div>
          <div className="flex-1">
            <textarea
              value={postContent}
              onChange={e => setPostContent(e.target.value)}
              placeholder="What's on your mind? Use #hashtags"
              rows={3}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-sm text-white placeholder-slate-500 resize-none focus:outline-none focus:border-blue-500 transition-colors"
            />
            <div className="flex justify-between items-center mt-2">
              <span className="text-xs text-slate-500">{postContent.length}/500</span>
              <button
                onClick={handlePost}
                disabled={!postContent.trim() || posting}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {posting ? 'Posting...' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Feed Type Toggle */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1">
        {(['following', 'explore'] as const).map(type => (
          <button key={type} onClick={() => setFeedType(type)}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
              feedType === type ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
            }`}>
            {type === 'following' ? '👥 Following' : '🌍 Explore'}
          </button>
        ))}
      </div>

      {/* Posts */}
      {loading ? (
        <div className="space-y-4">
          {[1,2,3].map(i => <div key={i} className="bg-slate-900 rounded-2xl h-40 animate-pulse border border-slate-800" />)}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 rounded-2xl border border-slate-800">
          <p className="text-slate-400 text-lg mb-2">No posts yet</p>
          <p className="text-slate-500 text-sm">
            {feedType === 'following' ? 'Follow some writers to see their posts here' : 'Be the first to post something!'}
          </p>
        </div>
      ) : (
        posts.map((post: any) => (
          <div key={post.id} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 hover:border-slate-700 transition-colors">
            <div className="flex items-start gap-3 mb-3">
              <Link href={`/profile/${post.user?.id}`}>
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold shrink-0 hover:opacity-80 transition-opacity">
                  {post.user?.name?.[0]?.toUpperCase() || '?'}
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <Link href={`/profile/${post.user?.id}`} className="font-semibold text-sm hover:text-blue-400 transition-colors">
                    {post.user?.name}
                  </Link>
                  {post.user?.isVerified && <span className="text-blue-400 text-xs">✓</span>}
                </div>
                <p className="text-xs text-slate-500">
                  {new Date(post.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </p>
              </div>
            </div>

            <p className="text-slate-200 text-sm leading-relaxed mb-3 whitespace-pre-wrap">{post.content}</p>

            {post.book && (
              <Link href={`/books/${post.book.id}`}
                className="flex items-center gap-3 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-3 mb-3 transition-colors">
                <BookOpen size={18} className="text-blue-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold truncate">{post.book.title}</p>
                  <p className="text-xs text-slate-400">{post.book.genre}</p>
                </div>
              </Link>
            )}

            {post.hashtags?.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-3">
                {post.hashtags.map((tag: string) => (
                  <span key={tag} className="text-blue-400 text-xs hover:underline cursor-pointer">#{tag}</span>
                ))}
              </div>
            )}

            <div className="flex items-center gap-6 pt-2 border-t border-slate-800">
              <button onClick={() => handleLike(post.id)}
                className="flex items-center gap-2 text-slate-500 hover:text-red-400 transition-colors text-sm">
                <Heart size={16} /> {post._count?.likes || post.likesCount || 0}
              </button>
              <button className="flex items-center gap-2 text-slate-500 hover:text-blue-400 transition-colors text-sm">
                <MessageCircle size={16} /> {post._count?.comments || post.commentsCount || 0}
              </button>
              <button className="flex items-center gap-2 text-slate-500 hover:text-green-400 transition-colors text-sm">
                <Repeat2 size={16} /> {post._count?.reposts || post.repostsCount || 0}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

// ─── DISCOVER TAB ─────────────────────────────────────────────────────────────
function DiscoverTab() {
  const [books, setBooks] = useState<any[]>([]);
  const [featured, setFeatured] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [genre, setGenre] = useState('All');
  const [loading, setLoading] = useState(true);

  const GENRES = ['All','Fantasy','Sci-Fi','Romance','Thriller','Self-Help','Business','Mystery','Horror','Biography'];

  useEffect(() => { fetchBooks(); }, [genre]);

  const fetchBooks = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (genre !== 'All') params.set('genre', genre);
      if (search) params.set('search', search);
      const [booksRes, featuredRes] = await Promise.all([
        fetch(`${API_URL}/api/marketplace/books?${params}`),
        fetch(`${API_URL}/api/marketplace/new-releases`),
      ]);
      if (booksRes.ok) setBooks((await booksRes.json()).books || []);
      if (featuredRes.ok) setFeatured(await featuredRes.json());
    } catch (e) {}
    setLoading(false);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchBooks();
  };

  return (
    <div className="space-y-6">
      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search books, authors..."
            className="w-full bg-slate-900 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white focus:outline-none focus:border-blue-500 transition-colors" />
        </div>
        <button type="submit" className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-xl text-sm font-semibold transition-colors">Search</button>
      </form>

      {/* Genre Pills */}
      <div className="flex gap-2 flex-wrap">
        {GENRES.map(g => (
          <button key={g} onClick={() => setGenre(g)}
            className={`px-4 py-1.5 rounded-full text-sm transition-colors ${
              genre === g ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-400 hover:text-white border border-slate-700'
            }`}>
            {g}
          </button>
        ))}
      </div>

      {/* New Releases */}
      {featured.length > 0 && (
        <div>
          <h3 className="font-semibold mb-3 text-slate-300">🆕 New Releases</h3>
          <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
            {featured.slice(0, 6).map((pb: any) => (
              <Link key={pb.id} href={`/books/${pb.bookId}`}
                className="bg-slate-900 border border-slate-800 hover:border-blue-500 rounded-xl p-4 min-w-[160px] transition-colors shrink-0">
                <div className="w-8 h-8 bg-blue-900/50 rounded-lg flex items-center justify-center mb-2">
                  <BookOpen className="text-blue-400" size={14} />
                </div>
                <p className="font-semibold text-xs line-clamp-2 mb-1">{pb.book?.title}</p>
                <p className="text-slate-500 text-xs">{pb.book?.genre}</p>
                <p className="text-blue-400 font-bold text-sm mt-2">{pb.price === 0 ? 'Free' : `$${pb.price}`}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* All Books */}
      <div>
        <h3 className="font-semibold mb-3 text-slate-300">📚 All Books</h3>
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <div key={i} className="bg-slate-900 rounded-xl h-40 animate-pulse border border-slate-800" />)}
          </div>
        ) : books.length === 0 ? (
          <div className="text-center py-12 text-slate-500">No books found</div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {books.map((pb: any) => (
              <Link key={pb.id} href={`/books/${pb.bookId}`}
                className="bg-slate-900 border border-slate-800 hover:border-blue-500 rounded-xl p-4 transition-colors">
                <div className="w-8 h-8 bg-blue-900/50 rounded-lg flex items-center justify-center mb-3">
                  <BookOpen className="text-blue-400" size={14} />
                </div>
                <h4 className="font-semibold text-sm line-clamp-2 mb-1">{pb.book?.title}</h4>
                <p className="text-slate-400 text-xs mb-1">by {pb.book?.user?.name}</p>
                <p className="text-slate-500 text-xs mb-2">{pb.book?.genre}</p>
                <p className="text-blue-400 font-bold text-sm">{pb.price === 0 ? 'Free' : `$${pb.price}`}</p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── MINE TAB ─────────────────────────────────────────────────────────────────
function MineTab({ creditBalance }: { creditBalance: number | null }) {
  const [myBooks, setMyBooks] = useState<any[]>([]);
  const [library, setLibrary] = useState<any[]>([]);
  const [earnings, setEarnings] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    const token = await getFreshToken();
    if (!token) return;
    try {
      const [booksRes, libRes, balRes] = await Promise.all([
        fetch(`${API_URL}/api/books`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/marketplace/library`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/payments/transactions`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (booksRes.ok) setMyBooks(await booksRes.json());
      if (libRes.ok) setLibrary(await libRes.json());
      if (balRes.ok) {
        const txs = await balRes.json();
        const authorEarnings = txs.filter((t: any) => t.type === 'BOOK_SALE_EARNING').reduce((s: number, t: any) => s + t.amount, 0);
        const affiliateEarnings = txs.filter((t: any) => t.type === 'AFFILIATE_EARNING').reduce((s: number, t: any) => s + t.amount, 0);
        setEarnings({ author: authorEarnings, affiliate: affiliateEarnings });
      }
    } catch (e) {}
    setLoading(false);
  };

  if (loading) return <div className="space-y-4">{[1,2,3].map(i => <div key={i} className="bg-slate-900 rounded-2xl h-32 animate-pulse border border-slate-800" />)}</div>;

  return (
    <div className="space-y-6">
      {/* Credits Banner */}
      <div className="bg-emerald-900/20 border border-emerald-700/40 rounded-2xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-slate-400 mb-1">Credit Balance</p>
          <p className="text-3xl font-bold text-emerald-400">{creditBalance === null ? '...' : `$${creditBalance.toFixed(2)}`}</p>
        </div>
        <Link href="/account/topup"
          className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
          + Add Credits
        </Link>
      </div>

      {/* My Books */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-slate-300">📚 My Books ({myBooks.length})</h3>
          <Link href="/dashboard/new-book"
            className="flex items-center gap-1 text-blue-400 text-sm hover:underline">
            <Plus size={14} /> Create New
          </Link>
        </div>
        {myBooks.length === 0 ? (
          <div className="text-center py-8 bg-slate-900 border border-slate-800 rounded-2xl">
            <BookOpen className="mx-auto text-slate-600 mb-2" size={32} />
            <p className="text-slate-400 text-sm mb-3">No books yet</p>
            <Link href="/dashboard/new-book"
              className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
              Create Your First Book
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myBooks.map((book: any) => (
              <div key={book.id} className="bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-xl p-4 flex items-center gap-4 transition-colors">
                <div className="w-10 h-10 bg-blue-900/50 rounded-xl flex items-center justify-center shrink-0">
                  <BookOpen className="text-blue-400" size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">{book.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      book.status === 'COMPLETE' ? 'bg-green-900/50 text-green-400' :
                      book.status === 'GENERATING' ? 'bg-yellow-900/50 text-yellow-400' :
                      'bg-slate-700 text-slate-400'
                    }`}>{book.status}</span>
                    <span className="text-slate-500 text-xs">{book.chapters?.length || 0} chapters</span>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Link href={`/dashboard/books/${book.id}`}
                    className="px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs font-medium transition-colors">
                    Manage
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* My Library */}
      <div>
        <h3 className="font-semibold text-slate-300 mb-3">🗂 My Library ({library.length})</h3>
        {library.length === 0 ? (
          <div className="text-center py-8 bg-slate-900 border border-slate-800 rounded-2xl">
            <p className="text-slate-400 text-sm mb-3">No purchased books yet</p>
            <Link href="/books" className="text-blue-400 text-sm hover:underline">Browse Books</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            {library.map((purchase: any) => (
              <Link key={purchase.id}
                href={`/books/${purchase.publishedBook?.bookId || purchase.bookId}`}
                className="bg-slate-900 border border-slate-800 hover:border-blue-500 rounded-xl p-4 transition-colors">
                <div className="w-8 h-8 bg-purple-900/50 rounded-lg flex items-center justify-center mb-2">
                  <BookOpen className="text-purple-400" size={14} />
                </div>
                <p className="font-semibold text-xs line-clamp-2">{purchase.publishedBook?.book?.title}</p>
                <p className="text-slate-500 text-xs mt-1">by {purchase.publishedBook?.book?.user?.name}</p>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Earnings Summary */}
      {earnings && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-300">💰 Earnings</h3>
            <Link href="/dashboard/earnings" className="text-blue-400 text-sm hover:underline">View Details →</Link>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">📚 Book Sales</p>
              <p className="text-xl font-bold text-blue-400">${earnings.author.toFixed(2)}</p>
            </div>
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <p className="text-xs text-slate-400 mb-1">🔗 Affiliate</p>
              <p className="text-xl font-bold text-purple-400">${earnings.affiliate.toFixed(2)}</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── LIBRARY TAB ──────────────────────────────────────────────────────────────
function LibraryTab() {
  const [library, setLibrary] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/marketplace/library`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setLibrary(await res.json());
      setLoading(false);
    };
    fetch_();
  }, []);

  if (loading) return <div className="grid grid-cols-2 gap-4">{[1,2,3,4].map(i => <div key={i} className="bg-slate-900 rounded-xl h-40 animate-pulse border border-slate-800" />)}</div>;

  return (
    <div>
      <h3 className="font-semibold text-slate-300 mb-4">🗂 My Library ({library.length})</h3>
      {library.length === 0 ? (
        <div className="text-center py-16 bg-slate-900 border border-slate-800 rounded-2xl">
          <BookOpen className="mx-auto text-slate-600 mb-3" size={40} />
          <p className="text-slate-400 mb-2">No purchased books yet</p>
          <Link href="/books" className="text-blue-400 hover:underline text-sm">Browse the marketplace</Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {library.map((purchase: any) => (
            <Link key={purchase.id}
              href={`/books/${purchase.publishedBook?.bookId || purchase.bookId}`}
              className="bg-slate-900 border border-slate-800 hover:border-blue-500 rounded-xl p-4 transition-colors">
              <div className="w-10 h-10 bg-purple-900/50 rounded-xl flex items-center justify-center mb-3">
                <BookOpen className="text-purple-400" size={16} />
              </div>
              <p className="font-semibold text-sm line-clamp-2 mb-1">{purchase.publishedBook?.book?.title}</p>
              <p className="text-slate-400 text-xs">by {purchase.publishedBook?.book?.user?.name}</p>
              <p className="text-emerald-400 text-xs mt-2">✓ Owned</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── EARNINGS TAB ─────────────────────────────────────────────────────────────
function EarningsTab() {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 text-center">
      <DollarSign className="mx-auto text-slate-600 mb-3" size={40} />
      <p className="text-slate-300 font-semibold mb-2">Full Earnings Dashboard</p>
      <p className="text-slate-500 text-sm mb-4">View your complete earnings history, affiliate stats, and transaction log</p>
      <Link href="/dashboard/earnings"
        className="inline-block bg-blue-600 hover:bg-blue-500 text-white px-6 py-2.5 rounded-xl font-semibold text-sm transition-colors">
        Open Earnings Dashboard →
      </Link>
    </div>
  );
}

// ─── AFFILIATE TAB ────────────────────────────────────────────────────────────
function AffiliateTab() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetch_ = async () => {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/payments/affiliate/stats`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) setStats(await res.json());
      setLoading(false);
    };
    fetch_();
  }, []);

  if (loading) return <div className="bg-slate-900 rounded-2xl h-40 animate-pulse border border-slate-800" />;

  return (
    <div className="space-y-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
        <h3 className="font-semibold mb-1">🔗 Affiliate Earnings</h3>
        <p className="text-3xl font-bold text-purple-400">${stats?.totalEarnings?.toFixed(2) || '0.00'}</p>
        <p className="text-slate-400 text-sm mt-1">from {stats?.links?.length || 0} affiliate links</p>
      </div>
      {stats?.links?.length > 0 && (
        <div className="space-y-3">
          {stats.links.map((link: any) => {
            const earned = link.earnings.reduce((s: number, e: any) => s + e.amount, 0);
            const shareUrl = `${window.location.origin}/books/${link.bookId}?ref=${link.code}`;
            return (
              <div key={link.id} className="bg-slate-900 border border-slate-800 rounded-xl p-4">
                <div className="flex justify-between items-start mb-2">
                  <p className="font-semibold text-sm">{link.book?.title}</p>
                  <p className="text-purple-400 font-bold">${earned.toFixed(2)}</p>
                </div>
                <p className="text-slate-500 text-xs mb-2">{link.clicks} clicks · {link.earnings.length} sales</p>
                <div className="flex gap-2">
                  <input readOnly value={shareUrl}
                    className="flex-1 bg-slate-800 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-400 truncate" />
                  <button onClick={() => navigator.clipboard.writeText(shareUrl)}
                    className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-lg text-xs shrink-0 transition-colors">
                    Copy
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {(!stats?.links || stats.links.length === 0) && (
        <div className="text-center py-12 bg-slate-900 border border-slate-800 rounded-2xl">
          <Link2 className="mx-auto text-slate-600 mb-3" size={40} />
          <p className="text-slate-400 text-sm mb-2">No affiliate links yet</p>
          <p className="text-slate-500 text-xs">Share any book from the marketplace to earn 10% commission on sales</p>
        </div>
      )}
    </div>
  );
}

// ─── TRENDING PANEL ───────────────────────────────────────────────────────────
function TrendingPanel() {
  const [trending, setTrending] = useState<any[]>([]);

  useEffect(() => {
    fetch(`${API_URL}/api/social/trending`)
      .then(r => r.json()).then(setTrending).catch(() => {});
  }, []);

  if (!trending.length) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <h3 className="font-semibold text-sm mb-3 text-slate-300">🔥 Trending</h3>
      <div className="space-y-2">
        {trending.slice(0, 6).map((t: any) => (
          <div key={t.tag} className="flex items-center justify-between">
            <span className="text-blue-400 text-sm">#{t.tag}</span>
            <span className="text-slate-500 text-xs">{t.count} posts</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SUGGESTED WRITERS ────────────────────────────────────────────────────────
function SuggestedWriters() {
  const [writers, setWriters] = useState<any[]>([]);

  useEffect(() => {
    const fetch_ = async () => {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/social/suggested-users`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setWriters(await res.json());
    };
    fetch_();
  }, []);

  if (!writers.length) return null;

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
      <h3 className="font-semibold text-sm mb-3 text-slate-300">👥 Suggested Writers</h3>
      <div className="space-y-3">
        {writers.slice(0, 4).map((w: any) => (
          <Link key={w.id} href={`/profile/${w.id}`}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold shrink-0">
              {w.name?.[0]?.toUpperCase() || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{w.name}</p>
              <p className="text-xs text-slate-500">{w.books?.length || 0} books</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
