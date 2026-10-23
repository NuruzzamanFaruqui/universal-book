'use client';
import AppNav from '@/components/AppNav';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import BookCover from '@/components/covers/BookCover';
import { BookOpen, Heart, MessageCircle, Repeat2, UserPlus, Clock, Check, X } from 'lucide-react';
import { getToken as getFreshToken } from '@/lib/auth';
import { API_URL, POLL } from '@/lib/config';
import { poll } from '@/lib/realtime';
import { openChatWindow } from '@/lib/chat';
import Avatar from '@/components/Avatar';

/**
 * The caller's relationship with this profile, as returned by
 * GET /api/social/connections/status/:id.
 *
 *   NONE      → Connect
 *   PENDING   → Pending (we asked; hover to withdraw)
 *   INCOMING  → Accept / Decline (they asked us)
 *   CONNECTED → Connected + Message
 */
type ConnectionState = 'NONE' | 'PENDING' | 'INCOMING' | 'CONNECTED';
interface Connection { state: ConnectionState; connectionId: string | null }

const NOT_CONNECTED: Connection = { state: 'NONE', connectionId: null };

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
  const [connection, setConnection] = useState<Connection | null>(null);
  const [connBusy, setConnBusy] = useState(false);
  const [connError, setConnError] = useState('');
  const [messageBusy, setMessageBusy] = useState(false);
  // Right after pressing Connect the pointer is still over the button, which
  // would immediately show "Withdraw". Arm it only once the pointer has left.
  const [withdrawArmed, setWithdrawArmed] = useState(true);

  useEffect(() => {
    setConnection(null);
    fetchData();
  }, [userId]);

  const fetchConnection = async (): Promise<Connection | undefined> => {
    const token = await getFreshToken();
    if (!token) return NOT_CONNECTED;
    const res = await fetch(`${API_URL}/api/social/connections/status/${userId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return undefined;
    const data = await res.json();
    return { state: data?.state ?? 'NONE', connectionId: data?.connectionId ?? null };
  };

  const fetchData = async () => {
    try {
      const token = await getFreshToken();
      const [profileRes, postsRes] = await Promise.all([
        fetch(`${API_URL}/api/marketplace/writers/${userId}`),
        fetch(`${API_URL}/api/social/users/${userId}/posts`),
      ]);
      let profileData: any = null;
      if (profileRes.ok) {
        profileData = await profileRes.json();
        setProfile(profileData);
        setFollowerCount(profileData.followers?.length || 0);
      }
      if (postsRes.ok) setPosts(await postsRes.json());
      if (token) {
        const [userRes, conn] = await Promise.all([
          fetch(`${API_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
          fetchConnection().catch(() => undefined),
        ]);
        if (userRes.ok) {
          const me = await userRes.json();
          setCurrentUser(me);
          setFollowing(!!profileData?.followers?.some((f: any) => f.followerId === me.id));
        }
        setConnection(conn ?? NOT_CONNECTED);
      } else {
        setConnection(NOT_CONNECTED);
      }
    } catch (e) {}
    finally { setLoading(false); }
  };

  // While a request is waiting on the other person, keep checking so the
  // button turns into Connected (or back into Connect) without a refresh.
  // Paused while our own action is in flight, so a poll can't race it.
  const waiting = !connBusy && (connection?.state === 'PENDING' || connection?.state === 'INCOMING');
  useEffect(() => {
    if (!waiting) return;
    return poll<Connection>({
      interval: POLL.connection,
      fetcher: fetchConnection,
      onData: (next) => setConnection((prev) =>
        prev && prev.state === next.state && prev.connectionId === next.connectionId ? prev : next,
      ),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waiting, userId]);

  const requireLogin = async () => {
    const token = await getFreshToken();
    if (!token) router.push('/auth/login');
    return token;
  };

  /** Runs a connection action, then re-reads the status from the server. */
  const connectionAction = async (
    request: (token: string) => Promise<Response>,
    optimistic?: Connection,
  ) => {
    const token = await requireLogin();
    if (!token || connBusy) return;
    setConnBusy(true);
    setConnError('');
    const before = connection;
    if (optimistic) setConnection(optimistic);
    try {
      const res = await request(token);
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setConnError(body?.message || 'Something went wrong. Please try again.');
      }
    } catch {
      setConnError('Could not reach the server. Please try again.');
    }
    // Whatever happened, the server's answer is the truth — this also repairs
    // a stale button if someone else changed the connection meanwhile.
    const fresh = await fetchConnection().catch(() => undefined);
    setConnection(fresh ?? before);
    setConnBusy(false);
  };

  const handleConnect = () => {
    setWithdrawArmed(false);
    return connectionAction(
      (token) => fetch(`${API_URL}/api/social/connections/${userId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      }),
      { state: 'PENDING', connectionId: null },
    );
  };

  const handleWithdraw = () =>
    connection?.connectionId &&
    connectionAction(
      (token) => fetch(`${API_URL}/api/social/connections/${connection.connectionId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      }),
      NOT_CONNECTED,
    );

  const handleRespond = (status: 'ACCEPTED' | 'DECLINED') =>
    connection?.connectionId &&
    connectionAction(
      (token) => fetch(`${API_URL}/api/social/connections/${connection.connectionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ status }),
      }),
      status === 'ACCEPTED' ? { state: 'CONNECTED', connectionId: connection.connectionId } : NOT_CONNECTED,
    );

  const handleFollow = async () => {
    const token = await requireLogin();
    if (!token) return;
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

  /** Opens the thread in the floating chat widget, or the messages page if it isn't showing. */
  const handleMessage = async () => {
    const token = await requireLogin();
    if (!token || messageBusy) return;
    setMessageBusy(true);
    try {
      const res = await fetch(`${API_URL}/api/social/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const conv = await res.json();
        if (!openChatWindow(conv)) router.push(`/messages/${conv.id}`);
      }
    } catch {}
    setMessageBusy(false);
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
  const firstName = profile.name?.split(' ')[0] || 'This writer';

  const btn = 'inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed';

  const connectControls = () => {
    // Status still loading: hold the space so the row doesn't jump.
    if (!connection) {
      return <div className={`${btn} w-28 bg-slate-700/60 animate-pulse`} aria-hidden>&nbsp;</div>;
    }
    switch (connection.state) {
      case 'CONNECTED':
        return (
          <>
            <span data-testid="connection-state" data-state="CONNECTED"
              className={`${btn} border border-emerald-700 bg-emerald-900/30 text-emerald-300 cursor-default`}>
              <Check size={15} /> Connected
            </span>
            <button onClick={handleMessage} disabled={messageBusy}
              className={`${btn} bg-blue-600 hover:bg-blue-500 text-white`}>
              <MessageCircle size={15} /> Message
            </button>
          </>
        );
      case 'PENDING':
        return (
          <button onClick={() => withdrawArmed && handleWithdraw()}
            onMouseLeave={() => setWithdrawArmed(true)}
            disabled={connBusy || !connection.connectionId}
            data-testid="connection-state" data-state="PENDING"
            title={withdrawArmed ? 'Request sent — click to withdraw' : 'Request sent'}
            className={`${btn} border border-amber-600/70 bg-amber-900/20 text-amber-300 ${
              withdrawArmed ? 'group hover:border-red-600 hover:bg-red-900/20 hover:text-red-300' : 'cursor-default'
            }`}>
            <span className="inline-flex items-center gap-1.5 group-hover:hidden"><Clock size={15} /> Pending</span>
            <span className="hidden items-center gap-1.5 group-hover:inline-flex"><X size={15} /> Withdraw</span>
          </button>
        );
      case 'INCOMING':
        return (
          <>
            <button onClick={() => handleRespond('ACCEPTED')} disabled={connBusy}
              data-testid="connection-state" data-state="INCOMING"
              className={`${btn} bg-emerald-600 hover:bg-emerald-500 text-white`}>
              <Check size={15} /> Accept
            </button>
            <button onClick={() => handleRespond('DECLINED')} disabled={connBusy}
              className={`${btn} border border-slate-600 text-slate-300 hover:border-red-500 hover:text-red-400`}>
              Decline
            </button>
          </>
        );
      default:
        return (
          <button onClick={handleConnect} disabled={connBusy}
            data-testid="connection-state" data-state="NONE"
            className={`${btn} bg-blue-600 hover:bg-blue-500 text-white`}>
            <UserPlus size={15} /> Connect
          </button>
        );
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <AppNav />

      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Profile Header */}
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-6 mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
            <Avatar user={profile} className="w-20 h-20 text-3xl shrink-0" />
            {!isOwnProfile && (
              <div className="flex flex-wrap justify-end gap-2">
                {connectControls()}
                <button onClick={handleFollow}
                  className={`${btn} font-medium ${
                    following
                      ? 'border border-slate-600 text-slate-300 hover:border-red-700 hover:text-red-400'
                      : 'border border-slate-600 text-slate-200 hover:border-blue-500'
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

          {!isOwnProfile && connection?.state === 'INCOMING' && (
            <p className="text-sm text-emerald-300 mb-3">{firstName} wants to connect with you.</p>
          )}
          {connError && <p role="alert" className="text-sm text-red-400 mb-3">{connError}</p>}

          <h1 className="text-2xl font-bold mb-1">{profile.name}</h1>
          {profile.bio && <p className="text-slate-400 text-sm mb-3">{profile.bio}</p>}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
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
          <div className="grid grid-cols-2 gap-4">
            {publishedBooks?.length === 0 ? (
              <div className="col-span-2 text-center py-12 bg-slate-800 border border-slate-700 rounded-xl text-slate-400">
                No published books yet
              </div>
            ) : (
              publishedBooks?.map((book: any) => (
                <Link key={book.id} href={`/books/${book.id}`}
                  className="bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl p-3 sm:p-4 transition block min-w-0">
                  <BookCover url={book.coverUrl} title={book.title} className="w-full rounded-lg mb-3" />
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
