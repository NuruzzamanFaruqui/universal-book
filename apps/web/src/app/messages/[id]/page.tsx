'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Send } from 'lucide-react';
import { ref, onValue, push, off } from 'firebase/database';
import { database } from '@/lib/firebase';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function ChatPage() {
  const params = useParams();
  const router = useRouter();
  const conversationId = params.id as string;
  const [messages, setMessages] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [otherUser, setOtherUser] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const currentUserRef = useRef<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('ub_token');
    if (!token) { router.push('/auth/login'); return; }
    fetchData();
  }, [conversationId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!database || !currentUser) return;
    const messagesRef = ref(database, `conversations/${conversationId}/messages`);
    onValue(messagesRef, (snapshot) => {
      const data = snapshot.val();
      if (data) {
        const firebaseMessages = Object.values(data) as any[];
        firebaseMessages.sort((a: any, b: any) => a.timestamp - b.timestamp);
        setMessages(prev => {
          const prevIds = new Set(prev.map((m: any) => m.id));
          const newMsgs = firebaseMessages.filter((m: any) => !prevIds.has(m.id));
          if (newMsgs.length === 0) return prev;
          return [...prev, ...newMsgs];
        });
      }
    });
    return () => off(messagesRef);
  }, [conversationId, currentUser]);

  const fetchData = async () => {
    try {
      const token = await getFreshToken();
      const userRes = await fetch(`${API_URL}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      let userData: any = null;
      if (userRes.ok) {
        userData = await userRes.json();
        setCurrentUser(userData);
        currentUserRef.current = userData;
      }

      const msgsRes = await fetch(`${API_URL}/api/social/conversations/${conversationId}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (msgsRes.ok) {
        const msgs = await msgsRes.json();
        setMessages(msgs);
        if (msgs.length > 0 && userData) {
          const other = msgs.find((m: any) => m.sender?.id !== userData.id)?.sender;
          if (other) setOtherUser(other);
        }
      }
    } catch (e) {}
    finally { setLoading(false); }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!message.trim() || !currentUser) return;
    setSending(true);
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/social/conversations/${conversationId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content: message }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        setMessages(prev => [...prev, newMsg]);
        if (database) {
          const messagesRef = ref(database, `conversations/${conversationId}/messages`);
          push(messagesRef, {
            id: newMsg.id,
            senderId: currentUser.id,
            content: message,
            timestamp: Date.now(),
          });
        }
        setMessage('');
      }
    } catch (e) {}
    finally { setSending(false); }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <nav className="sticky top-0 z-50 bg-slate-900/95 backdrop-blur border-b border-slate-800">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center gap-4">
          <Link href="/messages" className="text-slate-400 hover:text-white transition">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-sm">
              {otherUser?.name?.[0] || '?'}
            </div>
            <div>
              <div className="font-semibold text-sm">{otherUser?.name || 'Chat'}</div>
              <div className="text-xs text-green-400">● Online</div>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto max-w-2xl mx-auto w-full px-4 py-4 space-y-3">
        {loading ? (
          <div className="text-center text-slate-400 py-8">Loading messages...</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-slate-400 py-8">No messages yet. Say hello! 👋</div>
        ) : (
          messages.map((msg: any, i) => {
            const isOwn = msg.sender?.id === currentUser?.id || msg.senderId === currentUser?.id;
            return (
              <div key={msg.id || i} className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : ''}`}>
                {!isOwn && (
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {msg.sender?.name?.[0] || '?'}
                  </div>
                )}
                <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl text-sm ${
                  isOwn ? 'bg-blue-600 text-white rounded-tr-sm' : 'bg-slate-700 text-slate-200 rounded-tl-sm'
                }`}>
                  {msg.content}
                  <div className={`text-xs mt-1 ${isOwn ? 'text-blue-200' : 'text-slate-500'}`}>
                    {new Date(msg.createdAt || Date.now()).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div className="border-t border-slate-800 bg-slate-900 max-w-2xl mx-auto w-full px-4 py-3">
        <form onSubmit={handleSend} className="flex gap-3">
          <input value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
          <button type="submit" disabled={sending || !message.trim()}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl transition">
            <Send size={18} />
          </button>
        </form>
      </div>
    </div>
  );
}
