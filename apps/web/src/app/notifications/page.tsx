'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Bell, ArrowLeft, Heart, MessageCircle, Users, BookOpen, UserPlus } from 'lucide-react';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

const notifIcons: any = {
  POST_LIKE: <Heart size={16} className="text-red-400" />,
  POST_COMMENT: <MessageCircle size={16} className="text-blue-400" />,
  CONNECTION_REQUEST: <UserPlus size={16} className="text-green-400" />,
  CONNECTION_ACCEPTED: <Users size={16} className="text-purple-400" />,
  BOOK_PUBLISHED: <BookOpen size={16} className="text-yellow-400" />,
};

export default function NotificationsPage() {
  const router = useRouter();
  const [notifications, setNotifications] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('ub_token');
    if (!token) { router.push('/auth/login'); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = await getFreshToken();
      const [notifRes, pendingRes] = await Promise.all([
        fetch(`${API_URL}/api/social/notifications`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/social/connections/pending`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (notifRes.ok) setNotifications(await notifRes.json());
      if (pendingRes.ok) setPendingRequests(await pendingRes.json());
    } catch (e) {}
    finally { setLoading(false); }
  };

  const handleConnectionResponse = async (connectionId: string, status: 'ACCEPTED' | 'DECLINED') => {
    try {
      const token = await getFreshToken();
      await fetch(`${API_URL}/api/social/connections/${connectionId}/respond`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ status }),
      });
      setPendingRequests(prev => prev.filter(r => r.id !== connectionId));
    } catch (e) {}
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/feed" className="text-slate-400 hover:text-white transition">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <Bell size={20} className="text-blue-400" /> Notifications
          </h1>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Pending Connection Requests */}
        {pendingRequests.length > 0 && (
          <div className="bg-slate-800 border border-blue-800 rounded-xl p-4">
            <h2 className="font-bold mb-4 text-blue-400 flex items-center gap-2">
              <UserPlus size={16} /> Connection Requests ({pendingRequests.length})
            </h2>
            <div className="space-y-3">
              {pendingRequests.map((req: any) => (
                <div key={req.id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-600 flex items-center justify-center font-bold flex-shrink-0">
                    {req.sender?.name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/profile/${req.sender?.id}`} className="font-semibold text-sm hover:text-blue-400">
                      {req.sender?.name}
                    </Link>
                    {req.sender?.bio && <p className="text-slate-400 text-xs truncate">{req.sender?.bio}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleConnectionResponse(req.id, 'ACCEPTED')}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold transition">
                      Accept
                    </button>
                    <button onClick={() => handleConnectionResponse(req.id, 'DECLINED')}
                      className="px-3 py-1.5 border border-slate-600 hover:border-red-500 text-slate-400 hover:text-red-400 rounded-lg text-xs transition">
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Notifications */}
        {loading ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => <div key={i} className="bg-slate-800 rounded-xl h-16 animate-pulse" />)}
          </div>
        ) : notifications.length === 0 ? (
          <div className="text-center py-16 bg-slate-800 border border-slate-700 rounded-xl">
            <Bell className="mx-auto text-slate-600 mb-3" size={40} />
            <p className="text-slate-400">No notifications yet</p>
          </div>
        ) : (
          <div className="space-y-2">
            {notifications.map((notif: any) => (
              <div key={notif.id} className={`flex items-start gap-3 p-4 rounded-xl border transition ${
                notif.isRead ? 'bg-slate-800 border-slate-700' : 'bg-blue-900/20 border-blue-800'
              }`}>
                <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center flex-shrink-0">
                  {notifIcons[notif.type] || <Bell size={16} className="text-slate-400" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-slate-200">{notif.message}</p>
                  <p className="text-xs text-slate-500 mt-1">{new Date(notif.createdAt).toLocaleDateString()}</p>
                </div>
                {!notif.isRead && <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 mt-2" />}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
