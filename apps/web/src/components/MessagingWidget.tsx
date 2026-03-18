'use client';

import { useEffect, useState, useRef } from 'react';
import { MessageCircle, X, Send, ChevronDown, Edit, Minus } from 'lucide-react';
import { ref, onValue, push, off, set } from 'firebase/database';
import { database } from '@/lib/firebase';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return null;
}

export default function MessagingWidget() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [conversations, setConversations] = useState<any[]>([]);
  const [openChats, setOpenChats] = useState<any[]>([]);
  const [minimizedChats, setMinimizedChats] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<Record<string, any[]>>({});
  const [messageText, setMessageText] = useState<Record<string, string>>({});
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const [onlineLoaded, setOnlineLoaded] = useState(false);
  const messagesEndRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // Listen to Firebase auth state — reacts to login/logout without reload
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;

    const setupAuthListener = async () => {
      try {
        const { auth } = await import('@/lib/firebase');
        if (!auth) return;
        const { onAuthStateChanged } = await import('firebase/auth');
        unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            setIsLoggedIn(true);
            fetchCurrentUser();
          } else {
            // Logged out — clear everything
            setIsLoggedIn(false);
            setCurrentUser(null);
            setOpenChats([]);
            setMessages({});
            setConversations([]);
            setIsOpen(false);
            setMinimizedChats(new Set());
          }
        });
      } catch (e) {}
    };

    setupAuthListener();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    fetchConversations();
    if (database) {
      const onlineRef = ref(database, `online/${currentUser.id}`);
      set(onlineRef, { name: currentUser.name, lastSeen: Date.now() });
      const allOnlineRef = ref(database, 'online');
      onValue(allOnlineRef, (snapshot) => {
        setOnlineLoaded(true);
        const data = snapshot.val();
        setOnlineUsers(data ? new Set(Object.keys(data)) : new Set());
      });
    }
  }, [currentUser]);

  useEffect(() => {
    openChats.forEach(chat => {
      if (!database) return;
      const messagesRef = ref(database, `conversations/${chat.id}/messages`);
      onValue(messagesRef, (snapshot) => {
        const data = snapshot.val();
        if (data) {
          const msgs = (Object.values(data) as any[]).sort((a: any, b: any) => a.timestamp - b.timestamp);
          setMessages(prev => {
            const prevIds = new Set((prev[chat.id] || []).map((m: any) => m.id));
            const newMsgs = msgs.filter((m: any) => !prevIds.has(m.id));
            if (newMsgs.length === 0) return prev;
            return { ...prev, [chat.id]: [...(prev[chat.id] || []), ...newMsgs] };
          });
        }
      });
    });
  }, [openChats]);

  useEffect(() => {
    openChats.forEach(chat => {
      if (minimizedChats.has(chat.id)) return;
      const el = messagesEndRefs.current[chat.id];
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
  }, [messages, minimizedChats]);

  const fetchCurrentUser = async () => {
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/users/me`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setCurrentUser(await res.json());
    } catch (e) {}
  };

  const fetchConversations = async () => {
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/social/conversations`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setConversations(await res.json());
    } catch (e) {}
  };

  const openChat = async (conv: any) => {
    if (openChats.find(c => c.id === conv.id)) {
      setMinimizedChats(prev => { const next = new Set(prev); next.delete(conv.id); return next; });
      return;
    }
    setOpenChats(prev => [...prev.slice(-2), conv]);
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/social/conversations/${conv.id}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) { const msgs = await res.json(); setMessages(prev => ({ ...prev, [conv.id]: msgs })); }
    } catch (e) {}
  };

  const closeChat = (convId: string) => {
    setOpenChats(prev => prev.filter(c => c.id !== convId));
    setMinimizedChats(prev => { const next = new Set(prev); next.delete(convId); return next; });
    setMessages(prev => { const next = { ...prev }; delete next[convId]; return next; });
  };

  const toggleMinimize = (convId: string) => {
    setMinimizedChats(prev => {
      const next = new Set(prev);
      if (next.has(convId)) next.delete(convId); else next.add(convId);
      return next;
    });
  };

  const handleSend = async (convId: string) => {
    const text = messageText[convId];
    if (!text?.trim() || !currentUser) return;
    try {
      const token = await getFreshToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/social/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        setMessages(prev => ({ ...prev, [convId]: [...(prev[convId] || []), newMsg] }));
        if (database) {
          push(ref(database, `conversations/${convId}/messages`), {
            id: newMsg.id, senderId: currentUser.id, content: text, timestamp: Date.now(),
          });
        }
        setMessageText(prev => ({ ...prev, [convId]: '' }));
      }
    } catch (e) {}
  };

  const getOtherUser = (conv: any) => {
    if (!currentUser) return null;
    return conv.user1?.id === currentUser.id ? conv.user2 : conv.user1;
  };

  const isOnline = (userId: string) => onlineLoaded && onlineUsers.has(userId);

  if (!isLoggedIn || !currentUser) return null;

  return (
    <div className="fixed bottom-0 right-4 z-50 flex items-end gap-2">
      {openChats.map((chat) => {
        const other = getOtherUser(chat);
        const online = other ? isOnline(other.id) : false;
        const chatMessages = messages[chat.id] || [];
        const isMinimized = minimizedChats.has(chat.id);

        return (
          <div key={chat.id} className="w-80 bg-white rounded-t-xl shadow-2xl flex flex-col border border-gray-200"
            style={{ height: isMinimized ? 'auto' : '440px' }}>
            <div className="flex items-center justify-between px-3 py-2.5 bg-white border-b border-gray-200 rounded-t-xl cursor-pointer hover:bg-gray-50"
              onClick={() => toggleMinimize(chat.id)}>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center font-bold text-white text-sm">
                    {other?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  {online && <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-white" />}
                </div>
                <div>
                  <div className="font-semibold text-gray-900 text-sm">{other?.name || 'Chat'}</div>
                  <div className={`text-xs ${online ? 'text-green-600' : 'text-gray-400'}`}>
                    {online ? 'Active now' : 'Offline'}
                  </div>
                </div>
              </div>
              <div className="flex gap-1" onClick={e => e.stopPropagation()}>
                <button onClick={() => toggleMinimize(chat.id)} className="p-1 text-gray-500 hover:bg-gray-100 rounded" title="Minimize">
                  <Minus size={14} />
                </button>
                <button onClick={() => closeChat(chat.id)} className="p-1 text-gray-500 hover:bg-gray-100 rounded" title="Close">
                  <X size={14} />
                </button>
              </div>
            </div>

            {!isMinimized && (
              <>
                <div className="flex-1 overflow-y-auto p-3 space-y-2 bg-white">
                  {chatMessages.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold text-white mx-auto mb-2">
                        {other?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <p className="font-semibold text-gray-800 text-sm">{other?.name}</p>
                      <p className="text-gray-400 text-xs mt-1">Say hello! 👋</p>
                    </div>
                  ) : (
                    chatMessages.map((msg: any, i) => {
                      const isOwn = msg.sender?.id === currentUser?.id || msg.senderId === currentUser?.id;
                      return (
                        <div key={msg.id || i} className={`flex items-end gap-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                          {!isOwn && (
                            <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold text-white flex-shrink-0">
                              {other?.name?.[0]?.toUpperCase() || '?'}
                            </div>
                          )}
                          <div className={`max-w-52 px-3 py-2 rounded-2xl text-sm ${
                            isOwn ? 'bg-blue-600 text-white rounded-br-sm' : 'bg-gray-100 text-gray-800 rounded-bl-sm'
                          }`}>
                            {msg.content}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={el => { messagesEndRefs.current[chat.id] = el; }} />
                </div>
                <div className="border-t border-gray-200 bg-white rounded-b-xl px-3 py-2 flex items-center gap-2">
                  <input value={messageText[chat.id] || ''}
                    onChange={e => setMessageText(prev => ({ ...prev, [chat.id]: e.target.value }))}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(chat.id); } }}
                    placeholder="Write a message..."
                    className="flex-1 bg-gray-100 rounded-full px-4 py-2 text-sm text-gray-800 focus:outline-none focus:bg-gray-200" />
                  <button onClick={() => handleSend(chat.id)} disabled={!messageText[chat.id]?.trim()}
                    className="w-8 h-8 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 rounded-full flex items-center justify-center transition">
                    <Send size={14} className="text-white" />
                  </button>
                </div>
              </>
            )}
          </div>
        );
      })}

      {isOpen && (
        <div className="w-72 bg-white rounded-t-xl shadow-2xl border border-gray-200" style={{ maxHeight: '420px' }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200">
            <span className="font-semibold text-gray-900">Messaging</span>
            <div className="flex gap-1">
              <button className="p-1 text-gray-500 hover:bg-gray-100 rounded"><Edit size={16} /></button>
              <button onClick={() => setIsOpen(false)} className="p-1 text-gray-500 hover:bg-gray-100 rounded">
                <ChevronDown size={16} />
              </button>
            </div>
          </div>
          <div className="overflow-y-auto" style={{ maxHeight: '370px' }}>
            {conversations.length === 0 ? (
              <div className="text-center text-gray-400 text-sm py-8 px-4">
                No conversations yet. Connect with people to start chatting!
              </div>
            ) : (
              conversations.map((conv: any) => {
                const other = getOtherUser(conv);
                const online = other ? isOnline(other.id) : false;
                const lastMsg = conv.messages?.[0];
                return (
                  <button key={conv.id} onClick={() => { openChat(conv); setIsOpen(false); }}
                    className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 border-b border-gray-100">
                    <div className="relative flex-shrink-0">
                      <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-lg font-bold text-white">
                        {other?.name?.[0]?.toUpperCase() || '?'}
                      </div>
                      {online && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white" />}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="text-sm font-semibold text-gray-900 truncate">{other?.name || 'User'}</div>
                      <div className="text-xs text-gray-500 truncate">{lastMsg ? lastMsg.content : 'Start a conversation'}</div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      <button onClick={() => { setIsOpen(!isOpen); fetchConversations(); }}
        className="w-14 h-14 bg-white hover:bg-gray-50 border border-gray-300 rounded-full flex items-center justify-center shadow-lg transition mb-4">
        <MessageCircle size={24} className="text-gray-700" />
      </button>
    </div>
  );
}
