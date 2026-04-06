'use client';

import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { BookOpen, Bell, Wallet, ChevronDown, Settings, LogOut } from 'lucide-react';

const API_URL = 'https://api.universal-book.com';

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return null;
}

export default function AppNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<any>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<any[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    initAuth();
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const initAuth = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      if (!auth) return;
      const { onAuthStateChanged } = await import('firebase/auth');
      onAuthStateChanged(auth, async (firebaseUser) => {
        if (firebaseUser) {
          const token = await firebaseUser.getIdToken();
          localStorage.setItem('ub_token', token);
          const [userRes, balRes, notifRes] = await Promise.all([
            fetch(`${API_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_URL}/api/payments/balance`, { headers: { Authorization: `Bearer ${token}` } }),
            fetch(`${API_URL}/api/social/notifications/unread-count`, { headers: { Authorization: `Bearer ${token}` } }),
          ]);
          if (userRes.ok) setUser(await userRes.json());
          if (balRes.ok) setCreditBalance((await balRes.json()).balance);
          if (notifRes.ok) setUnreadCount((await notifRes.json()).count || 0);
        }
      });
    } catch (e) {}
  };

  const fetchNotifications = async () => {
    const token = await getFreshToken();
    if (!token) return;
    const res = await fetch(`${API_URL}/api/social/notifications`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      setNotifications(await res.json());
      setUnreadCount(0);
    }
  };

  const handleNotificationClick = () => {
    setShowNotifications(!showNotifications);
    if (!showNotifications) fetchNotifications();
    setShowDropdown(false);
  };

  const handleLogout = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      if (auth) await auth.signOut();
    } catch (e) {}
    localStorage.removeItem('ub_token');
    router.push('/auth/login');
  };

  const navLinks = [
    { href: '/feed', label: '📰 Feed' },
    { href: '/books', label: '📖 Discover' },
    { href: '/dashboard', label: '📚 My Books' },
    { href: '/groups', label: '👥 Groups' },
  ];

  const isActive = (href: string) => pathname === href || (href !== '/feed' && pathname.startsWith(href));

  return (
    <nav className="sticky top-0 z-50 bg-slate-900 border-b border-slate-800">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">

        {/* Logo */}
        <Link href="/feed" className="flex items-center gap-2 font-bold text-white shrink-0">
          <BookOpen className="text-blue-400" size={22} />
          <span className="hidden sm:block text-base">Universal Book</span>
        </Link>

        {/* Desktop Nav Links */}
        <div className="hidden md:flex items-center gap-1 flex-1 justify-center">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                isActive(link.href)
                  ? 'bg-slate-700 text-white'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800'
              }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Right Side */}
        <div className="flex items-center gap-2 shrink-0">

          {/* Credit Balance */}
          <Link
            href="/account/topup"
            className="hidden sm:flex items-center gap-1.5 bg-emerald-900/40 hover:bg-emerald-900/70 border border-emerald-700/50 text-emerald-400 px-3 py-1.5 rounded-lg text-sm transition-colors"
          >
            <Wallet size={14} />
            <span className="font-semibold">
              {creditBalance === null ? '...' : `$${creditBalance.toFixed(2)}`}
            </span>
          </Link>

          {/* Notifications */}
          <div className="relative" ref={notifRef}>
            <button
              onClick={handleNotificationClick}
              className="relative p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            >
              <Bell size={20} />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {showNotifications && (
              <div className="absolute right-0 top-full mt-2 w-80 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
                  <h3 className="font-semibold text-sm">Notifications</h3>
                  <Link href="/notifications" onClick={() => setShowNotifications(false)}
                    className="text-blue-400 text-xs hover:underline">See all</Link>
                </div>
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-8 text-center text-slate-500 text-sm">No notifications yet</div>
                  ) : (
                    notifications.slice(0, 8).map((n: any) => (
                      <div key={n.id} className={`px-4 py-3 border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors ${!n.isRead ? 'bg-blue-900/10' : ''}`}>
                        <p className="text-sm text-slate-300">{n.message}</p>
                        <p className="text-xs text-slate-500 mt-1">
                          {new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Avatar Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => { setShowDropdown(!showDropdown); setShowNotifications(false); }}
              className="flex items-center gap-2 p-1.5 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
                {user?.name?.[0]?.toUpperCase() || '?'}
              </div>
              <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
            </button>

            {showDropdown && (
              <div className="absolute right-0 top-full mt-2 w-48 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                <div className="px-4 py-3 border-b border-slate-700">
                  <p className="font-semibold text-sm text-white truncate">{user?.name}</p>
                  <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                </div>
                <Link href="/account" onClick={() => setShowDropdown(false)}
                  className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 transition-colors">
                  <Settings size={16} /> Settings
                </Link>
                <button onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-slate-700 transition-colors">
                  <LogOut size={16} /> Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
  );
}
