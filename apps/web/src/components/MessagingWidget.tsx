'use client';

import { useEffect, useState, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { MessageCircle, X, Send, ChevronDown, Edit, Minus } from 'lucide-react';
import { getToken, onAuthChange, getStoredToken } from '@/lib/auth';
import { subscribeToMessages, subscribeToPresence, ChatMessage, Unsubscribe } from '@/lib/realtime';
import Avatar from '@/components/Avatar';
import { API_URL, POLL } from '@/lib/config';
import { OPEN_CHAT_EVENT } from '@/lib/chat';

export default function MessagingWidget() {
  // The editor is a full-screen writing surface with its own right-hand panel;
  // a floating chat bubble lands on top of it.
  const pathname = usePathname();
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
  // Mirrors `messages` so the polling effect can read the newest timestamp
  // without taking `messages` as a dependency and restarting on every arrival.
  const messagesRef = useRef<Record<string, any[]>>({});
  useEffect(() => { messagesRef.current = messages; }, [messages]);
  const openChatsRef = useRef<any[]>([]);
  useEffect(() => { openChatsRef.current = openChats; }, [openChats]);

  // Track sign-in state so the widget reacts to login/logout without a reload.
  useEffect(() => {
    const sync = () => {
      if (getStoredToken()) {
        setIsLoggedIn(true);
        fetchCurrentUser();
      } else {
        setIsLoggedIn(false);
        setCurrentUser(null);
        setOpenChats([]);
        setMessages({});
        setConversations([]);
        setIsOpen(false);
        setMinimizedChats(new Set());
      }
    };
    sync();
    return onAuthChange(sync);
  }, []);

  useEffect(() => {
    if (!currentUser) return;
    fetchConversations();

    // Refresh the conversation list so unread counts and ordering stay live.
    const convTimer = setInterval(fetchConversations, POLL.conversations);
    return () => clearInterval(convTimer);
  }, [currentUser]);

  // Online indicators. AuthProvider owns the heartbeat; this only reads.
  //
  // Keyed on the peer ids rather than the conversations array: that array is
  // refetched on an interval and arrives with a new identity every time, which
  // tore this subscription down and restarted it every few seconds.
  const conversationsRef = useRef<any[]>([]);
  useEffect(() => { conversationsRef.current = conversations; }, [conversations]);

  const peerKey = currentUser
    ? conversations
        .map((c: any) => (c.user1?.id === currentUser.id ? c.user2?.id : c.user1?.id))
        .filter(Boolean)
        .sort()
        .join(',')
    : '';

  useEffect(() => {
    if (!currentUser) return;

    const peerIds = () =>
      conversationsRef.current
        .map((c: any) => (c.user1?.id === currentUser.id ? c.user2?.id : c.user1?.id))
        .filter(Boolean);

    return subscribeToPresence(
      peerIds,
      (online) => {
        setOnlineLoaded(true);
        setOnlineUsers(new Set(Object.keys(online).filter((id) => online[id])));
      },
      POLL.presence,
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, peerKey]);

  // One message poll per open chat window.
  useEffect(() => {
    if (!currentUser) return;

    const subs: Unsubscribe[] = openChats.map((chat) => {
      const existing = messagesRef.current[chat.id] || [];
      const latest = existing.length ? existing[existing.length - 1].createdAt : undefined;

      return subscribeToMessages(
        chat.id,
        (incoming: ChatMessage[]) => {
          setMessages((prev) => {
            const seen = new Set((prev[chat.id] || []).map((m: any) => m.id));
            const fresh = incoming.filter((m) => !seen.has(m.id));
            if (!fresh.length) return prev;
            return { ...prev, [chat.id]: [...(prev[chat.id] || []), ...fresh] };
          });
        },
        POLL.messages,
        latest,
      );
    });

    return () => subs.forEach((stop) => stop());
    // Keyed on which chats are open, not their contents — re-subscribing on
    // every incoming message would reset each poll clock.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openChats.map((c) => c.id).join(','), currentUser]);

  useEffect(() => {
    openChats.forEach(chat => {
      if (minimizedChats.has(chat.id)) return;
      const el = messagesEndRefs.current[chat.id];
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    });
  }, [messages, minimizedChats]);

  const fetchCurrentUser = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/users/me`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setCurrentUser(await res.json());
    } catch (e) {}
  };

  const fetchConversations = async () => {
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/social/conversations`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (res.ok) setConversations(await res.json());
    } catch (e) {}
  };

  // Written against updater functions and refs rather than the state values,
  // so the window-event listener below can hold one copy of it for its whole
  // lifetime without seeing stale state.
  const openChat = async (conv: any) => {
    setMinimizedChats(prev => {
      if (!prev.has(conv.id)) return prev;
      const next = new Set(prev); next.delete(conv.id); return next;
    });
    if (openChatsRef.current.some(c => c.id === conv.id)) return;
    setOpenChats(prev => (prev.some(c => c.id === conv.id) ? prev : [...prev.slice(-2), conv]));
    try {
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/social/conversations/${conv.id}/messages`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) { const msgs = await res.json(); setMessages(prev => ({ ...prev, [conv.id]: msgs })); }
    } catch (e) {}
  };

  // Lets other components open a thread here — see lib/chat.ts. Only claims
  // the event while the widget is actually on screen, so the caller can fall
  // back to the full messages page otherwise.
  const visibleRef = useRef(false);
  visibleRef.current = isLoggedIn && !!currentUser && !pathname?.endsWith('/edit');
  useEffect(() => {
    const onOpen = (e: Event) => {
      const conv = (e as CustomEvent).detail;
      if (!visibleRef.current || !conv?.id) return;
      e.preventDefault();
      setIsOpen(false);
      openChat(conv);
      fetchConversations();
    };
    window.addEventListener(OPEN_CHAT_EVENT, onOpen);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, onOpen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const token = await getToken();
      if (!token) return;
      const res = await fetch(`${API_URL}/api/social/conversations/${convId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content: text }),
      });
      if (res.ok) {
        const newMsg = await res.json();
        // Optimistic append; the poll dedupes by id so it won't double up.
        setMessages(prev => ({ ...prev, [convId]: [...(prev[convId] || []), newMsg] }));
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
  if (pathname?.endsWith('/edit')) return null;

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
                  <Avatar user={other} className="w-8 h-8 text-sm" />
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
                      <Avatar user={other} className="w-16 h-16 text-2xl mx-auto mb-2" />
                      <p className="font-semibold text-gray-800 text-sm">{other?.name}</p>
                      <p className="text-gray-400 text-xs mt-1">Say hello! 👋</p>
                    </div>
                  ) : (
                    chatMessages.map((msg: any, i) => {
                      const isOwn = msg.sender?.id === currentUser?.id || msg.senderId === currentUser?.id;
                      return (
                        <div key={msg.id || i} className={`flex items-end gap-1 ${isOwn ? 'flex-row-reverse' : ''}`}>
                          {!isOwn && (
                            <Avatar user={other} className="w-6 h-6 text-xs flex-shrink-0" />
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
                      <Avatar user={other} className="w-12 h-12 text-lg" />
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
