'use client';
import MarketingNav from '@/components/MarketingNav';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import BookCover from '@/components/covers/BookCover';
import { BookOpen, ArrowLeft, Users, Heart } from 'lucide-react';
import { getToken as getFreshToken } from '@/lib/auth';
import { API_URL } from '@/lib/config';
import Avatar from '@/components/Avatar';



export default function WriterProfilePage() {
  const params = useParams();
  const router = useRouter();
  const writerId = params.id as string;
  const [writer, setWriter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [following, setFollowing] = useState(false);
  const [followerCount, setFollowerCount] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    fetchWriter();
    setIsLoggedIn(!!localStorage.getItem('ub_token'));
  }, [writerId]);

  const fetchWriter = async () => {
    try {
      const res = await fetch(`${API_URL}/api/marketplace/writers/${writerId}`);
      if (!res.ok) throw new Error('Writer not found');
      const data = await res.json();
      setWriter(data);
      setFollowerCount(data.followers?.length || 0);

      const token = await getFreshToken();
      if (token) {
        const meRes = await fetch(`${API_URL}/api/users/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (meRes.ok) {
          const me = await meRes.json();
          setFollowing(!!data.followers?.some((f: any) => f.followerId === me.id));
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    const token = await getFreshToken();
    if (!token) { router.push('/auth/login'); return; }
    const res = await fetch(`${API_URL}/api/marketplace/writers/${writerId}/follow`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
    });
    if (res.ok) {
      const data = await res.json();
      setFollowing(data.following);
      setFollowerCount(prev => data.following ? prev + 1 : prev - 1);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading profile...</div>
    </div>
  );

  if (error || !writer) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-red-400 text-xl mb-4">{error || 'Writer not found'}</div>
        <Link href="/writers" className="text-blue-400 hover:text-blue-300">Browse Writers</Link>
      </div>
    </div>
  );

  const publishedBooks = writer.books?.filter((b: any) => b.published?.isPublic);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <MarketingNav />

      <div className="max-w-5xl mx-auto px-6 py-10">
        <Link href="/writers" className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition">
          <ArrowLeft size={16} /> Back to Writers
        </Link>

        {/* Profile Header */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 mb-8">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-5">
              <Avatar user={writer} className="w-20 h-20 text-3xl flex-shrink-0" />
              <div>
                <h1 className="text-3xl font-bold mb-1">{writer.name}</h1>
                {writer.bio && <p className="text-slate-400 mb-3 max-w-lg">{writer.bio}</p>}
                <div className="flex items-center gap-6 text-sm text-slate-400">
                  <span className="flex items-center gap-1">
                    <BookOpen size={14} className="text-blue-400" />
                    {publishedBooks?.length || 0} published books
                  </span>
                  <span className="flex items-center gap-1">
                    <Users size={14} className="text-purple-400" />
                    {followerCount} followers
                  </span>
                  <span className="flex items-center gap-1">
                    <Heart size={14} className="text-pink-400" />
                    {writer.following?.length || 0} following
                  </span>
                </div>
              </div>
            </div>
            {isLoggedIn && (
              <button onClick={handleFollow}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-semibold transition border ${
                  following
                    ? 'border-red-500 text-red-400 hover:bg-red-900/20'
                    : 'border-blue-500 text-blue-400 hover:bg-blue-900/20'
                }`}>
                <Users size={16} />
                {following ? 'Unfollow' : 'Follow Writer'}
              </button>
            )}
          </div>
        </div>

        {/* Published Books */}
        <h2 className="text-2xl font-bold mb-6">
          Published Books ({publishedBooks?.length || 0})
        </h2>

        {publishedBooks?.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-slate-700 rounded-2xl">
            <BookOpen className="mx-auto text-slate-600 mb-4" size={40} />
            <p className="text-slate-400">No published books yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6">
            {publishedBooks?.map((book: any) => (
              <Link key={book.id} href={`/books/${book.id}`}
                className="bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl p-3 sm:p-4 transition block min-w-0">
                <BookCover url={book.coverUrl} title={book.title} className="w-full rounded-lg mb-3" />
                <h3 className="font-bold mb-1 line-clamp-2">{book.title}</h3>
                {book.subtitle && <p className="text-slate-400 text-xs mb-2 line-clamp-1">{book.subtitle}</p>}
                <div className="flex items-center justify-between mt-3">
                  <span className="text-xs bg-slate-700 px-2 py-0.5 rounded-full">{book.genre}</span>
                  <span className="text-blue-400 font-bold text-sm">
                    {book.published?.price === 0 ? 'Free' : `$${book.published?.price}`}
                  </span>
                </div>
                <div className="text-slate-500 text-xs mt-2">
                  {book.chapters?.length || 0} chapters
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
