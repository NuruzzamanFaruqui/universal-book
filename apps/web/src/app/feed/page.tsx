'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Heart, MessageCircle, Repeat2, Send, Trash2, Hash, Users, Bell, TrendingUp, X, LogOut, Home, PenSquare, Library, Menu } from 'lucide-react';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function FeedPage() {
  const router = useRouter();
  const [posts, setPosts] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [content, setContent] = useState('');
  const [selectedBook, setSelectedBook] = useState<any>(null);
  const [myBooks, setMyBooks] = useState<any[]>([]);
  const [posting, setPosting] = useState(false);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [trending, setTrending] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [expandedComments, setExpandedComments] = useState<string[]>([]);
  const [commentText, setCommentText] = useState<Record<string, string>>({});
  const [showBookPicker, setShowBookPicker] = useState(false);
  const [activeTab, setActiveTab] = useState<'feed' | 'explore'>('feed');
  const [showMobileMenu, setShowMobileMenu] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ub_token');
    if (!token) { router.push('/auth/login'); return; }
    fetchAll();
  }, []);

  const fetchAll = async () => {
    try {
      const token = await getFreshToken();
      const [userRes, feedRes, booksRes, suggestedRes, trendingRes, notifRes] = await Promise.all([
        fetch(`${API_URL}/api/users/me`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/social/feed`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/books`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/social/suggested-users`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/social/trending`),
        fetch(`${API_URL}/api/social/notifications`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (userRes.ok) setUser(await userRes.json());
      if (feedRes.ok) { const data = await feedRes.json(); setPosts(data.posts || []); }
      if (booksRes.ok) setMyBooks(await booksRes.json());
      if (suggestedRes.ok) setSuggested(await suggestedRes.json());
      if (trendingRes.ok) setTrending(await trendingRes.json());
      if (notifRes.ok) setNotifications(await notifRes.json());
    } catch (e) {}
    finally { setLoading(false); }
  };

  const fetchExplore = async () => {
    try {
      const res = await fetch(`${API_URL}/api/social/explore`);
      if (res.ok) { const data = await res.json(); setPosts(data.posts || []); }
    } catch (e) {}
  };

  const handleLogout = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      if (auth) { const { signOut } = await import('firebase/auth'); await signOut(auth); }
    } catch (e) {}
    localStorage.removeItem('ub_token');
    router.push('/');
  };

  const handlePost = async () => {
    if (!content.trim()) return;
    setPosting(true);
    try {
      const token = await getFreshToken();
      const hashtags = content.match(/#\w+/g)?.map(h => h.slice(1)) || [];
      const res = await fetch(`${API_URL}/api/social/posts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content, bookId: selectedBook?.id, hashtags }),
      });
      if (res.ok) {
        const newPost = await res.json();
        setPosts(prev => [newPost, ...prev]);
        setContent('');
        setSelectedBook(null);
      }
    } catch (e) {}
    finally { setPosting(false); }
  };

  const handleLike = async (postId: string) => {
    const token = await getFreshToken();
    const res = await fetch(`${API_URL}/api/social/posts/${postId}/like`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p,
        likesCount: data.liked ? p.likesCount + 1 : p.likesCount - 1,
        likes: data.liked ? [...p.likes, { userId: user?.id }] : p.likes.filter((l: any) => l.userId !== user?.id),
      } : p));
    }
  };

  const handleComment = async (postId: string) => {
    const text = commentText[postId];
    if (!text?.trim()) return;
    const token = await getFreshToken();
    const res = await fetch(`${API_URL}/api/social/posts/${postId}/comment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ content: text }),
    });
    if (res.ok) {
      const comment = await res.json();
      setPosts(prev => prev.map(p => p.id === postId ? {
        ...p, commentsCount: p.commentsCount + 1, comments: [...(p.comments || []), comment],
      } : p));
      setCommentText(prev => ({ ...prev, [postId]: '' }));
    }
  };

  const handleRepost = async (postId: string) => {
    const token = await getFreshToken();
    await fetch(`${API_URL}/api/social/posts/${postId}/repost`, {
      method: 'POST', headers: { 'Authorization': `Bearer ${token}` },
    });
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, repostsCount: p.repostsCount + 1 } : p));
  };

  const handleDelete = async (postId: string) => {
    if (!confirm('Delete this post?')) return;
    const token = await getFreshToken();
    await fetch(`${API_URL}/api/social/posts/${postId}`, {
      method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` },
    });
    setPosts(prev => prev.filter(p => p.id !== postId));
  };

  const toggleComments = (postId: string) => {
    setExpandedComments(prev => prev.includes(postId) ? prev.filter(id => id !== postId) : [...prev, postId]);
  };

  const unreadNotifs = notifications.filter(n => !n.isRead).length;

  return (
    <div className="min-h-screen bg-slate-900 text-white pb-16 md:pb-0">
      {/* Top Nav */}
      <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <Link href="/feed" className="flex items-center gap-2 text-xl font-bold">
            <BookOpen className="text-blue-400" size={26} />
            <span className="hidden sm:block">Universal Book</span>
          </Link>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-1">
            {[
              { href: '/feed', label: '🏠 Feed' },
              { href: '/books', label: '📚 Books' },
              { href: '/writers', label: '✍️ Writers' },
              { href: '/groups', label: '👥 Groups' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                className="px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 text-sm transition">
                {item.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <Link href="/notifications" className="relative p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
              <Bell size={20} />
              {unreadNotifs > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-xs flex items-center justify-center">{unreadNotifs}</span>
              )}
            </Link>
            <Link href={`/profile/${user?.id}`} className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm hidden md:flex">
              {user?.name?.[0] || '?'}
            </Link>
            <button onClick={handleLogout}
              className="hidden md:flex items-center gap-1 px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg text-sm transition">
              <LogOut size={16} /> Logout
            </button>
            {/* Mobile menu button */}
            <button onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="md:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition">
              <Menu size={20} />
            </button>
          </div>
        </div>

        {/* Mobile Menu Dropdown */}
        {showMobileMenu && (
          <div className="md:hidden bg-slate-800 border-t border-slate-700 px-4 py-3 space-y-2">
            {[
              { href: '/dashboard', label: '✍️ My Books' },
              { href: '/dashboard/new-book', label: '➕ New Book' },
              { href: '/library', label: '📖 My Library' },
              { href: '/dashboard/earnings', label: '💰 Earnings' },
              { href: '/groups', label: '👥 Groups' },
              { href: '/notifications', label: '🔔 Notifications' },
              { href: `/profile/${user?.id}`, label: '👤 My Profile' },
              { href: '/account', label: '⚙️ Account' },
            ].map(item => (
              <Link key={item.href} href={item.href} onClick={() => setShowMobileMenu(false)}
                className="block px-3 py-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-700 text-sm transition">
                {item.label}
              </Link>
            ))}
            <button onClick={handleLogout}
              className="w-full text-left px-3 py-2 rounded-lg text-red-400 hover:bg-slate-700 text-sm transition">
              🚪 Logout
            </button>
          </div>
        )}
      </nav>

      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Left Sidebar - Desktop only */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <Link href={`/profile/${user?.id}`} className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold">
                    {user?.name?.[0] || '?'}
                  </div>
                  <div>
                    <div className="font-bold">{user?.name}</div>
                    <div className="text-slate-400 text-xs truncate">{user?.email}</div>
                  </div>
                </Link>
                <div className="grid grid-cols-2 gap-2 text-center text-xs">
                  <div className="bg-slate-700 rounded-lg p-2">
                    <div className="font-bold text-blue-400">{user?.books?.length || 0}</div>
                    <div className="text-slate-400">Books</div>
                  </div>
                  <div className="bg-slate-700 rounded-lg p-2">
                    <div className="font-bold text-blue-400">{user?.followers?.length || 0}</div>
                    <div className="text-slate-400">Followers</div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-3 space-y-1">
                {[
                  { href: '/feed', label: '🏠 Feed' },
                  { href: '/dashboard', label: '✍️ My Books' },
                  { href: '/dashboard/new-book', label: '➕ Write New Book' },
                  { href: '/dashboard/earnings', label: '💰 Earnings' },
                  { href: '/library', label: '📖 My Library' },
                  { href: '/books', label: '📚 Browse Books' },
                  { href: '/groups', label: '👥 Communities' },
                  { href: '/notifications', label: '🔔 Notifications' },
                ].map(link => (
                  <Link key={link.href} href={link.href}
                    className="block px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 text-sm transition">
                    {link.label}
                  </Link>
                ))}
                <button onClick={handleLogout}
                  className="w-full text-left px-3 py-2 rounded-lg text-red-400 hover:bg-slate-700 text-sm transition">
                  🚪 Logout
                </button>
              </div>
            </div>
          </div>

          {/* Center Feed */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1">
              <button onClick={() => { setActiveTab('feed'); fetchAll(); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'feed' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                Following
              </button>
              <button onClick={() => { setActiveTab('explore'); fetchExplore(); }}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'explore' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
                Explore
              </button>
            </div>

            {/* Create Post */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                  {user?.name?.[0] || '?'}
                </div>
                <div className="flex-1">
                  <textarea value={content} onChange={e => setContent(e.target.value)}
                    placeholder="Share your thoughts, writing tips, or book excerpts... Use #hashtags"
                    rows={3}
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:border-blue-500 resize-none" />
                  {selectedBook && (
                    <div className="mt-2 p-3 bg-slate-700 rounded-lg flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <BookOpen size={16} className="text-blue-400" />
                        <span className="text-sm">{selectedBook.title}</span>
                      </div>
                      <button onClick={() => setSelectedBook(null)} className="text-slate-400 hover:text-white">
                        <X size={16} />
                      </button>
                    </div>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <button onClick={() => setShowBookPicker(!showBookPicker)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-xs text-slate-300 transition">
                      <BookOpen size={14} /> Attach Book
                    </button>
                    <button onClick={handlePost} disabled={posting || !content.trim()}
                      className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl text-sm font-semibold transition">
                      {posting ? 'Posting...' : <><Send size={14} /> Post</>}
                    </button>
                  </div>
                  {showBookPicker && (
                    <div className="mt-2 bg-slate-700 rounded-xl overflow-hidden">
                      {myBooks.length === 0 ? (
                        <div className="p-3 text-slate-400 text-sm">No books yet. <Link href="/dashboard/new-book" className="text-blue-400">Create one →</Link></div>
                      ) : myBooks.map((book: any) => (
                        <button key={book.id} onClick={() => { setSelectedBook(book); setShowBookPicker(false); }}
                          className="w-full text-left px-4 py-2 hover:bg-slate-600 text-sm transition flex items-center gap-2">
                          <BookOpen size={14} className="text-blue-400" /> {book.title}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Posts */}
            {loading ? (
              <div className="space-y-4">
                {[1,2,3].map(i => <div key={i} className="bg-slate-800 rounded-xl h-40 animate-pulse" />)}
              </div>
            ) : posts.length === 0 ? (
              <div className="text-center py-16 bg-slate-800 border border-slate-700 rounded-xl">
                <div className="text-4xl mb-3">📝</div>
                <h3 className="font-bold text-lg mb-2">No posts yet</h3>
                <p className="text-slate-400 text-sm mb-4">
                  {activeTab === 'feed' ? 'Follow writers to see their posts here' : 'Be the first to post something!'}
                </p>
                {activeTab === 'feed' && <Link href="/writers" className="text-blue-400 hover:text-blue-300 text-sm">Discover writers →</Link>}
              </div>
            ) : (
              posts.map((post: any) => (
                <div key={post.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                  <div className="flex items-start justify-between mb-3">
                    <Link href={`/profile/${post.user?.id}`} className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                        {post.user?.name?.[0] || '?'}
                      </div>
                      <div>
                        <div className="font-semibold text-sm flex items-center gap-1">
                          {post.user?.name}
                          {post.user?.isVerified && <span className="text-blue-400 text-xs">✓</span>}
                        </div>
                        <div className="text-slate-500 text-xs">{new Date(post.createdAt).toLocaleDateString()}</div>
                      </div>
                    </Link>
                    {post.userId === user?.id && (
                      <button onClick={() => handleDelete(post.id)} className="text-slate-600 hover:text-red-400 transition">
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                  <p className="text-slate-200 text-sm leading-relaxed mb-3 whitespace-pre-wrap">
                    {post.content.split(/(#\w+)/g).map((part: string, i: number) =>
                      part.startsWith('#') ? <span key={i} className="text-blue-400">{part}</span> : part
                    )}
                  </p>
                  {post.book && (
                    <Link href={`/books/${post.book.id}`}
                      className="block mb-3 p-3 bg-slate-700 border border-slate-600 hover:border-blue-500 rounded-xl transition">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-blue-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                          <BookOpen className="text-blue-400" size={18} />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">{post.book.title}</div>
                          <div className="text-slate-400 text-xs">{post.book.genre}</div>
                          {post.book.published?.isPublic && (
                            <div className="text-blue-400 text-xs">{post.book.published.price === 0 ? 'Free' : `$${post.book.published.price}`}</div>
                          )}
                        </div>
                        <div className="ml-auto text-blue-400 text-xs">Read Preview →</div>
                      </div>
                    </Link>
                  )}
                  <div className="flex items-center gap-4 text-slate-400 text-sm">
                    <button onClick={() => handleLike(post.id)}
                      className={`flex items-center gap-1.5 transition ${post.likes?.some((l: any) => l.userId === user?.id) ? 'text-red-400' : 'hover:text-red-400'}`}>
                      <Heart size={16} fill={post.likes?.some((l: any) => l.userId === user?.id) ? 'currentColor' : 'none'} />
                      {post.likesCount || 0}
                    </button>
                    <button onClick={() => toggleComments(post.id)} className="flex items-center gap-1.5 hover:text-blue-400 transition">
                      <MessageCircle size={16} /> {post.commentsCount || 0}
                    </button>
                    <button onClick={() => handleRepost(post.id)} className="flex items-center gap-1.5 hover:text-green-400 transition">
                      <Repeat2 size={16} /> {post.repostsCount || 0}
                    </button>
                  </div>
                  {expandedComments.includes(post.id) && (
                    <div className="mt-4 pt-4 border-t border-slate-700 space-y-3">
                      {post.comments?.map((comment: any) => (
                        <div key={comment.id} className="flex gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                            {comment.user?.name?.[0] || '?'}
                          </div>
                          <div className="flex-1 bg-slate-700 rounded-xl px-3 py-2">
                            <div className="text-xs font-semibold text-blue-400 mb-1">{comment.user?.name}</div>
                            <div className="text-sm text-slate-300">{comment.content}</div>
                          </div>
                        </div>
                      ))}
                      <div className="flex gap-2">
                        <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {user?.name?.[0] || '?'}
                        </div>
                        <div className="flex-1 flex gap-2">
                          <input value={commentText[post.id] || ''} onChange={e => setCommentText(prev => ({ ...prev, [post.id]: e.target.value }))}
                            placeholder="Write a comment..."
                            onKeyDown={e => { if (e.key === 'Enter') handleComment(post.id); }}
                            className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-3 py-1.5 text-white text-xs focus:outline-none focus:border-blue-500" />
                          <button onClick={() => handleComment(post.id)}
                            className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-xl text-xs transition">
                            <Send size={12} />
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          {/* Right Sidebar */}
          <div className="hidden lg:block lg:col-span-1">
            <div className="sticky top-20 space-y-4">
              {trending.length > 0 && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <h2 className="font-bold mb-3 flex items-center gap-2">
                    <TrendingUp className="text-orange-400" size={16} /> Trending
                  </h2>
                  <div className="space-y-2">
                    {trending.slice(0, 6).map((item: any, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-blue-400 text-sm">#{item.tag}</span>
                        <span className="text-slate-500 text-xs">{item.count} posts</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {suggested.length > 0 && (
                <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                  <h2 className="font-bold mb-3 flex items-center gap-2">
                    <Users className="text-blue-400" size={16} /> Writers to Follow
                  </h2>
                  <div className="space-y-3">
                    {suggested.map((writer: any) => (
                      <div key={writer.id} className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                          {writer.name?.[0] || '?'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <Link href={`/profile/${writer.id}`} className="text-sm font-medium hover:text-blue-400 truncate block">{writer.name}</Link>
                          <div className="text-xs text-slate-500">{writer.books?.length || 0} books</div>
                        </div>
                        <Link href={`/profile/${writer.id}`}
                          className="text-xs text-blue-400 border border-blue-800 hover:border-blue-600 px-2 py-1 rounded-lg transition">
                          View
                        </Link>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <div className="bg-slate-800 border border-slate-700 rounded-xl p-4">
                <h2 className="font-bold mb-3 flex items-center gap-2">
                  <BookOpen className="text-green-400" size={16} /> Quick Actions
                </h2>
                <div className="space-y-2">
                  <Link href="/dashboard/new-book"
                    className="block w-full text-center py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">
                    ✍️ Write New Book
                  </Link>
                  <Link href="/books"
                    className="block w-full text-center py-2 border border-slate-600 hover:border-blue-500 rounded-lg text-sm transition">
                    📚 Browse Books
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      <div className="fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-700 md:hidden z-40">
        <div className="flex items-center justify-around py-2">
          <Link href="/feed" className="flex flex-col items-center gap-0.5 px-3 py-1 text-blue-400">
            <Home size={22} />
            <span className="text-xs">Feed</span>
          </Link>
          <Link href="/books" className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400 hover:text-white">
            <BookOpen size={22} />
            <span className="text-xs">Books</span>
          </Link>
          <Link href="/dashboard/new-book" className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400 hover:text-white">
            <PenSquare size={22} />
            <span className="text-xs">Write</span>
          </Link>
          <Link href="/library" className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400 hover:text-white">
            <Library size={22} />
            <span className="text-xs">Library</span>
          </Link>
          <Link href="/notifications" className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400 hover:text-white relative">
            <Bell size={22} />
            {unreadNotifs > 0 && <span className="absolute top-0 right-2 w-4 h-4 bg-red-500 rounded-full text-xs flex items-center justify-center">{unreadNotifs}</span>}
            <span className="text-xs">Alerts</span>
          </Link>
          <button onClick={() => setShowMobileMenu(!showMobileMenu)} className="flex flex-col items-center gap-0.5 px-3 py-1 text-slate-400 hover:text-white">
            <Menu size={22} />
            <span className="text-xs">More</span>
          </button>
        </div>
      </div>
    </div>
  );
}
