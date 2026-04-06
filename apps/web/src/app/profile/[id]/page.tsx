'use client';
import AppNav from '@/components/AppNav';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, ArrowLeft, Users, Heart, MessageCircle, Repeat2 } from 'lucide-react';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function ProfilePage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [activeTab, setActiveTab] = useState<'posts' | 'books'>('posts');

  useEffect(() => {
    fetchData();
  }, [userId]);

  const fetchData = async () => {
    try {
      const token = await getFreshToken();
      const [profileRes, postsRes] = await Promise.all([
        fetch(`${API_URL}/api/marketplace/writers/${userId}`),
        fetch(`${API_URL}/api/social/users/${userId}/posts`),
      ]);
      if (profileRes.ok) {
        const data = await profileRes.json();
        setProfile(data);
        setFollowerCount(data.followers?.length || 0);
      }
      if (postsRes.ok) setPosts(await postsRes.json());
      if (token) {
        const userRes = await fetch(`${API_URL}/api/users/me`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (userRes.ok) setCurrentUser(await userRes.json());
      }
    } catch (e) {}
    finally { setLoading(false); }
  };

  const handleFollow = async () => {
    const token = await getFreshToken();
    if (!token) { router.push('/auth/login'); return; }
    const res = await fetch(`${API_URL}/api/marketplace/writers/${userId}/follow`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setFollowing(data.following);
      setFollowerCount(prev => data.following ? prev + 1 : prev - 1);
    }
  };

  const handleMessage = async () => {
    const token = await getFreshToken();
    if (!token) { router.push('/auth/login'); return; }
    const res = await fetch(`${API_URL}/api/social/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ userId }),
    });
    if (res.ok) {
      const conv = await res.json();
      router.push(`/messages/${conv.id}`);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading profile...</div>
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-red-400 text-xl mb-4">Profile not found</div>
        <Link href="/feed" className="text-blue-400">Back to Feed</Link>
      </div>
    </div>
  );

  const publishedBooks = profile.books?.filter((b: any) => b.published?.isPublic);
  const isOwnProfile = currentUser?.id === userId;

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <AppNav />

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Profile Header */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-3xl font-bold">
              {profile.name?.[0] || '?'}
            </div>
            {!isOwnProfile && (
              <div className="flex gap-2">
                <button onClick={handleMessage}
                  className="px-4 py-2 border border-slate-600 hover:border-blue-500 rounded-xl text-sm transition">
                  💌 Message
                </button>
                <button onClick={handleFollow}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
                    following ? 'border border-red-700 text-red-400 hover:bg-red-900/20' : 'bg-blue-600 hover:bg-blue-500'
                  }`}>
                  {following ? 'Unfollow' : 'Follow'}
                </button>
              </div>
            )}
            {isOwnProfile && (
              <Link href="/account" className="px-4 py-2 border border-slate-600 hover:border-blue-500 rounded-xl text-sm transition">
                Edit Profile
              </Link>
            )}
          </div>

          <h1 className="text-2xl font-bold mb-1">{profile.name}</h1>
          {profile.bio && <p className="text-slate-400 text-sm mb-3">{profile.bio}</p>}

          <div className="flex items-center gap-6 text-sm">
            <div>
              <span className="font-bold text-white">{publishedBooks?.length || 0}</span>
              <span className="text-slate-400 ml-1">Books</span>
            </div>
            <div>
              <span className="font-bold text-white">{followerCount}</span>
              <span className="text-slate-400 ml-1">Followers</span>
            </div>
            <div>
              <span className="font-bold text-white">{profile.following?.length || 0}</span>
              <span className="text-slate-400 ml-1">Following</span>
            </div>
            <div>
              <span className="font-bold text-white">{posts.length}</span>
              <span className="text-slate-400 ml-1">Posts</span>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-800 border border-slate-700 rounded-xl p-1 mb-6">
          <button onClick={() => setActiveTab('posts')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'posts' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            Posts ({posts.length})
          </button>
          <button onClick={() => setActiveTab('books')}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${activeTab === 'books' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
            Books ({publishedBooks?.length || 0})
          </button>
        </div>

        {/* Posts Tab */}
        {activeTab === 'posts' && (
          <div className="space-y-4">
            {posts.length === 0 ? (
              <div className="text-center py-12 bg-slate-800 border border-slate-700 rounded-xl text-slate-400">
                No posts yet
              </div>
            ) : (
              posts.map((post: any) => (
                <div key={post.id} className="bg-slate-800 border border-slate-700 rounded-xl p-5">
                  <p className="text-slate-200 text-sm leading-relaxed mb-3 whitespace-pre-wrap">
                    {post.content.split(/(#\w+)/g).map((part: string, i: number) =>
                      part.startsWith('#') ? (
                        <span key={i} className="text-blue-400">{part}</span>
                      ) : part
                    )}
                  </p>
                  {post.book && (
                    <Link href={`/books/${post.book.id}`}
                      className="block mb-3 p-3 bg-slate-700 rounded-xl border border-slate-600 hover:border-blue-500 transition">
                      <div className="flex items-center gap-2">
                        <BookOpen size={14} className="text-blue-400" />
                        <span className="text-sm font-medium">{post.book.title}</span>
                      </div>
                    </Link>
                  )}
                  <div className="flex items-center gap-4 text-slate-500 text-xs">
                    <span className="flex items-center gap-1"><Heart size={12} /> {post.likesCount || 0}</span>
                    <span className="flex items-center gap-1"><MessageCircle size={12} /> {post.commentsCount || 0}</span>
                    <span className="flex items-center gap-1"><Repeat2 size={12} /> {post.repostsCount || 0}</span>
                    <span className="ml-auto">{new Date(post.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Books Tab */}
        {activeTab === 'books' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {publishedBooks?.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-slate-800 border border-slate-700 rounded-xl text-slate-400">
                No published books yet
              </div>
            ) : (
              publishedBooks?.map((book: any) => (
                <Link key={book.id} href={`/books/${book.id}`}
                  className="bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl p-5 transition block">
                  <div className="w-10 h-10 bg-blue-900/50 rounded-lg flex items-center justify-center mb-3">
                    <BookOpen className="text-blue-400" size={18} />
                  </div>
                  <h3 className="font-bold mb-1 line-clamp-2">{book.title}</h3>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">{book.genre}</span>
                    <span className="text-blue-400 font-bold text-sm">
                      {book.published?.price === 0 ? 'Free' : `$${book.published?.price}`}
                    </span>
                  </div>
                </Link>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}
