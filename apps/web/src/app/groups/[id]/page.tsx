'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Users, Send, Globe, Lock } from 'lucide-react';
import DashboardNav from '@/components/DashboardNav';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const groupId = params.id as string;
  const [group, setGroup] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchGroup();
    fetchCurrentUser();
  }, [groupId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchCurrentUser = async () => {
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) setCurrentUser(await res.json());
    } catch (e) {}
  };

  const fetchGroup = async () => {
    try {
      const [groupRes, messagesRes] = await Promise.all([
        fetch(`${API_URL}/api/groups/${groupId}`),
        fetch(`${API_URL}/api/groups/${groupId}/messages`),
      ]);
      if (groupRes.ok) setGroup(await groupRes.json());
      if (messagesRes.ok) setMessages(await messagesRes.json());
    } catch (e) {}
    finally { setLoading(false); }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim()) return;
    const token = await getFreshToken();
    if (!token) { router.push('/auth/login'); return; }
    setSending(true);
    try {
      const res = await fetch(`${API_URL}/api/groups/${groupId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ message }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        setMessages(prev => [...prev, newMsg]);
        setMessage('');
      }
    } catch (e) {}
    finally { setSending(false); }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading group...</div>
    </div>
  );

  if (!group) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <div className="text-red-400 text-xl mb-4">Group not found</div>
        <Link href="/groups" className="text-blue-400">Back to Groups</Link>
      </div>
    </div>
  );

  const isMember = group.members?.some((m: any) => m.userId === currentUser?.id);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <DashboardNav />
      <div className="max-w-6xl mx-auto px-8 py-8 flex-1 w-full">
        <Link href="/groups" className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition">
          <ArrowLeft size={16} /> Back to Groups
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 h-full">
          {/* Sidebar */}
          <div className="lg:col-span-1 space-y-4">
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <div className="w-14 h-14 bg-blue-900/50 rounded-xl flex items-center justify-center mb-4">
                <Users className="text-blue-400" size={24} />
              </div>
              <h1 className="font-bold text-xl mb-2">{group.name}</h1>
              {group.description && <p className="text-slate-400 text-sm mb-3">{group.description}</p>}
              <div className="flex items-center gap-2 text-xs text-slate-500 mb-3">
                {group.isPublic ? <><Globe size={12} /> Public Group</> : <><Lock size={12} /> Private Group</>}
              </div>
              <div className="text-sm text-slate-400">
                <div className="flex justify-between mb-1">
                  <span>Members</span>
                  <span className="text-white font-medium">{group.members?.length || 0}</span>
                </div>
                <div className="flex justify-between">
                  <span>Messages</span>
                  <span className="text-white font-medium">{messages.length}</span>
                </div>
              </div>
            </div>

            {/* Members List */}
            <div className="bg-slate-800 border border-slate-700 rounded-xl p-5">
              <h2 className="font-bold mb-3 text-sm">Members ({group.members?.length || 0})</h2>
              <div className="space-y-2">
                {group.members?.slice(0, 10).map((member: any) => (
                  <div key={member.userId} className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {member.user?.name?.[0] || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm truncate">{member.user?.name}</div>
                    </div>
                    {member.role === 'admin' && (
                      <span className="text-xs text-yellow-400">Admin</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Chat Area */}
          <div className="lg:col-span-3 flex flex-col bg-slate-800 border border-slate-700 rounded-xl overflow-hidden" style={{ height: '600px' }}>
            <div className="px-5 py-3 border-b border-slate-700">
              <h2 className="font-bold">Group Chat</h2>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {messages.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  No messages yet. Be the first to say hello! 👋
                </div>
              ) : (
                messages.map((msg: any) => (
                  <div key={msg.id} className={`flex gap-3 ${msg.userId === currentUser?.id ? 'flex-row-reverse' : ''}`}>
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                      {msg.user?.name?.[0] || '?'}
                    </div>
                    <div className={`max-w-xs lg:max-w-md ${msg.userId === currentUser?.id ? 'items-end' : 'items-start'} flex flex-col`}>
                      <div className="text-xs text-slate-500 mb-1">
                        {msg.userId !== currentUser?.id && <span className="mr-2">{msg.user?.name}</span>}
                        {new Date(msg.createdAt).toLocaleTimeString()}
                      </div>
                      <div className={`px-4 py-2 rounded-2xl text-sm ${
                        msg.userId === currentUser?.id
                          ? 'bg-blue-600 text-white rounded-tr-sm'
                          : 'bg-slate-700 text-slate-200 rounded-tl-sm'
                      }`}>
                        {msg.message}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>

            {/* Message Input */}
            {currentUser ? (
              <form onSubmit={handleSend} className="p-4 border-t border-slate-700 flex gap-3">
                <input value={message} onChange={e => setMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
                <button type="submit" disabled={sending || !message.trim()}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl transition">
                  <Send size={18} />
                </button>
              </form>
            ) : (
              <div className="p-4 border-t border-slate-700 text-center">
                <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 text-sm">
                  Login to join the conversation →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
