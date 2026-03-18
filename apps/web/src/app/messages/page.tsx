'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Mail, ArrowLeft, Search } from 'lucide-react';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function MessagesPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<any[]>([]);
  const [connections, setConnections] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('ub_token');
    if (!token) { router.push('/auth/login'); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = await getFreshToken();
      const [convRes, userRes, connRes] = await Promise.all([
        fetch(`${API_URL}/api/social/conversations`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/users/me`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/social/connections`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (convRes.ok) setConversations(await convRes.json());
      if (userRes.ok) setCurrentUser(await userRes.json());
      if (connRes.ok) setConnections(await connRes.json());
    } catch (e) {}
    finally { setLoading(false); }
  };

  const startConversation = async (userId: string) => {
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/social/conversations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ userId }),
      });
      if (res.ok) {
        const conv = await res.json();
        router.push(`/messages/${conv.id}`);
      }
    } catch (e) {}
  };

  const getOtherUser = (conv: any) => {
    return conv.user1?.id === currentUser?.id ? conv.user2 : conv.user1;
  };

  const getConnectionUser = (conn: any) => {
    return conn.sender?.id === currentUser?.id ? conn.receiver : conn.sender;
  };

  const filteredConnections = connections.filter((c: any) => {
    const user = getConnectionUser(c);
    return user?.name?.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/feed" className="text-slate-400 hover:text-white transition">
            <ArrowLeft size={20} />
          </Link>
          <h1 className="font-bold text-lg flex items-center gap-2">
            <Mail size={20} className="text-blue-400" /> Messages
          </h1>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-4 py-6">
        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-2.5 text-slate-500" size={16} />
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search connections..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500" />
        </div>

        {/* Connections - Start New Chat */}
        {filteredConnections.length > 0 && (
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-slate-400 mb-3">Your Connections</h2>
            <div className="flex gap-3 overflow-x-auto pb-2">
              {filteredConnections.map((conn: any) => {
                const user = getConnectionUser(conn);
                return (
                  <button key={conn.id} onClick={() => startConversation(user?.id)}
                    className="flex flex-col items-center gap-1 flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-lg font-bold border-2 border-slate-700 hover:border-blue-500 transition">
                      {user?.name?.[0] || '?'}
                    </div>
                    <span className="text-xs text-slate-400 truncate w-14 text-center">{user?.name?.split(' ')[0]}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Recent Conversations */}
        <h2 className="text-sm font-semibold text-slate-400 mb-3">Recent Conversations</h2>
        {loading ? (
          <div className="space-y-3">
            {[1,2,3].map(i => <div key={i} className="bg-slate-800 rounded-xl h-16 animate-pulse" />)}
          </div>
        ) : conversations.length === 0 ? (
          <div className="text-center py-16 bg-slate-800 border border-slate-700 rounded-xl">
            <Mail className="mx-auto text-slate-600 mb-3" size={40} />
            <p className="text-slate-400 mb-2">No conversations yet</p>
            <p className="text-slate-500 text-sm">Connect with people to start chatting</p>
          </div>
        ) : (
          <div className="space-y-2">
            {conversations.map((conv: any) => {
              const other = getOtherUser(conv);
              const lastMsg = conv.messages?.[0];
              return (
                <Link key={conv.id} href={`/messages/${conv.id}`}
                  className="flex items-center gap-3 p-4 bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl transition">
                  <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-lg font-bold flex-shrink-0">
                    {other?.name?.[0] || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm">{other?.name}</div>
                    <div className="text-slate-400 text-xs truncate">
                      {lastMsg ? lastMsg.content : 'No messages yet'}
                    </div>
                  </div>
                  {lastMsg && (
                    <div className="text-xs text-slate-500 flex-shrink-0">
                      {new Date(lastMsg.createdAt).toLocaleDateString()}
                    </div>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
