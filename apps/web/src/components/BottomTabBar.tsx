'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Home, BookOpen, PlusCircle, LayoutDashboard, User, X, Sparkles, PenSquare, Upload, FileEdit } from 'lucide-react';

export default function BottomTabBar() {
  const pathname = usePathname();
  const router = useRouter();
  const [showCreateSheet, setShowCreateSheet] = useState(false);
  const [showMeSheet, setShowMeSheet] = useState(false);

  const isActive = (href: string) => pathname === href || (href !== '/feed' && pathname.startsWith(href));

  const handleCreateOption = (path: string) => {
    setShowCreateSheet(false);
    router.push(path);
  };

  return (
    <>
      {/* Bottom Tab Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-800 md:hidden">
        <div className="flex items-center justify-around h-16 px-2">

          {/* Feed */}
          <Link href="/feed"
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
              isActive('/feed') ? 'text-blue-400' : 'text-slate-500'
            }`}>
            <Home size={22} />
            <span className="text-xs font-medium">Feed</span>
          </Link>

          {/* Discover */}
          <Link href="/books"
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
              isActive('/books') ? 'text-blue-400' : 'text-slate-500'
            }`}>
            <BookOpen size={22} />
            <span className="text-xs font-medium">Books</span>
          </Link>

          {/* Create — Center */}
          <button
            onClick={() => { setShowCreateSheet(true); setShowMeSheet(false); }}
            className="flex flex-col items-center gap-1 px-4 py-2"
          >
            <div className="w-12 h-12 -mt-6 bg-blue-600 hover:bg-blue-500 rounded-full flex items-center justify-center shadow-lg shadow-blue-900/50 transition-colors border-4 border-slate-900">
              <PlusCircle size={22} className="text-white" />
            </div>
            <span className="text-xs font-medium text-slate-500 mt-1">New</span>
          </button>

          {/* Mine */}
          <Link href="/dashboard"
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
              isActive('/dashboard') || isActive('/library') || isActive('/dashboard/earnings')
                ? 'text-blue-400' : 'text-slate-500'
            }`}>
            <LayoutDashboard size={22} />
            <span className="text-xs font-medium">Mine</span>
          </Link>

          {/* Me */}
          <button
            onClick={() => { setShowMeSheet(true); setShowCreateSheet(false); }}
            className={`flex flex-col items-center gap-1 px-4 py-2 rounded-xl transition-colors ${
              showMeSheet ? 'text-blue-400' : 'text-slate-500'
            }`}>
            <User size={22} />
            <span className="text-xs font-medium">Me</span>
          </button>
        </div>
      </div>

      {/* Create Bottom Sheet */}
      {showCreateSheet && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 md:hidden" onClick={() => setShowCreateSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 rounded-t-2xl md:hidden">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-slate-600 rounded-full" />
            </div>
            <div className="px-4 pb-8 pt-2">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">Create</h3>
                <button onClick={() => setShowCreateSheet(false)}
                  className="p-2 text-slate-400 hover:text-white">
                  <X size={20} />
                </button>
              </div>
              <div className="space-y-3">
                {/* Write a Post */}
                <button
                  onClick={() => handleCreateOption('/feed?compose=true')}
                  className="w-full flex items-center gap-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-4 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-blue-900/50 rounded-xl flex items-center justify-center shrink-0">
                    <FileEdit size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <p className="font-semibold">Write a Post</p>
                    <p className="text-slate-400 text-sm">Share something with your followers</p>
                  </div>
                </button>

                {/* AI Book */}
                <button
                  onClick={() => handleCreateOption('/dashboard/new-book?mode=ai')}
                  className="w-full flex items-center gap-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-4 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-purple-900/50 rounded-xl flex items-center justify-center shrink-0">
                    <Sparkles size={20} className="text-purple-400" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">AI Book</p>
                      <span className="text-xs bg-purple-900/50 text-purple-400 px-2 py-0.5 rounded-full border border-purple-700">💳 $5</span>
                    </div>
                    <p className="text-slate-400 text-sm">Claude AI writes your book</p>
                  </div>
                </button>

                {/* Self Write */}
                <button
                  onClick={() => handleCreateOption('/dashboard/new-book?mode=self')}
                  className="w-full flex items-center gap-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-4 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-blue-900/50 rounded-xl flex items-center justify-center shrink-0">
                    <PenSquare size={20} className="text-blue-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">Write Yourself</p>
                      <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full border border-green-700">Free</span>
                    </div>
                    <p className="text-slate-400 text-sm">Use our professional editor</p>
                  </div>
                </button>

                {/* Import */}
                <button
                  onClick={() => handleCreateOption('/dashboard/new-book?mode=import')}
                  className="w-full flex items-center gap-4 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl p-4 transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-green-900/50 rounded-xl flex items-center justify-center shrink-0">
                    <Upload size={20} className="text-green-400" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">Import Book</p>
                      <span className="text-xs bg-green-900/50 text-green-400 px-2 py-0.5 rounded-full border border-green-700">Free</span>
                    </div>
                    <p className="text-slate-400 text-sm">Upload .docx, .pdf, .txt</p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Me Bottom Sheet */}
      {showMeSheet && (
        <>
          <div className="fixed inset-0 bg-black/60 z-50 md:hidden" onClick={() => setShowMeSheet(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 bg-slate-900 border-t border-slate-700 rounded-t-2xl md:hidden">
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 bg-slate-600 rounded-full" />
            </div>
            <MeSheetContent onClose={() => setShowMeSheet(false)} />
          </div>
        </>
      )}
    </>
  );
}

function MeSheetContent({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [creditBalance, setCreditBalance] = useState<number | null>(null);

  useState(() => {
    const init = async () => {
      try {
        const { auth } = await import('@/lib/firebase');
        if (!auth?.currentUser) return;
        const token = await auth.currentUser.getIdToken();
        const [userRes, balRes] = await Promise.all([
          fetch('https://api.universal-book.com/api/users/me', { headers: { Authorization: `Bearer ${token}` } }),
          fetch('https://api.universal-book.com/api/payments/balance', { headers: { Authorization: `Bearer ${token}` } }),
        ]);
        if (userRes.ok) setUser(await userRes.json());
        if (balRes.ok) setCreditBalance((await balRes.json()).balance);
      } catch (e) {}
    };
    init();
  });

  const handleLogout = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      if (auth) await auth.signOut();
    } catch (e) {}
    localStorage.removeItem('ub_token');
    onClose();
    router.push('/auth/login');
  };

  const menuItems = [
    { href: '/dashboard', icon: '📚', label: 'My Books' },
    { href: '/library', icon: '🗂', label: 'My Library' },
    { href: '/dashboard/earnings', icon: '💰', label: 'Earnings & Credits' },
    { href: '/dashboard/author-groups', icon: '✍️', label: 'Co-Write' },
    { href: '/groups', icon: '👥', label: 'Groups' },
    { href: '/notifications', icon: '🔔', label: 'Notifications' },
    { href: '/messages', icon: '💬', label: 'Messages' },
    { href: '/account', icon: '⚙️', label: 'Settings' },
  ];

  return (
    <div className="px-4 pb-8 pt-2">
      {/* Profile Header */}
      <div className="flex items-center gap-3 py-4 border-b border-slate-700 mb-2">
        <div className="w-12 h-12 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold">
          {user?.name?.[0]?.toUpperCase() || '?'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{user?.name || 'Loading...'}</p>
          <p className="text-slate-400 text-sm truncate">{user?.email}</p>
        </div>
      </div>

      {/* Credit Balance */}
      <div className="flex items-center justify-between bg-emerald-900/20 border border-emerald-700/50 rounded-xl px-4 py-3 mb-3">
        <div>
          <p className="text-xs text-slate-400">Credit Balance</p>
          <p className="text-xl font-bold text-emerald-400">
            {creditBalance === null ? '...' : `$${creditBalance.toFixed(2)}`}
          </p>
        </div>
        <Link href="/account/topup" onClick={onClose}
          className="bg-emerald-700 hover:bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-semibold">
          + Add
        </Link>
      </div>

      {/* Menu Items */}
      <div className="space-y-1 mb-4">
        {menuItems.map(item => (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            className="flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-slate-800 transition-colors"
          >
            <span className="text-xl w-8 text-center">{item.icon}</span>
            <span className="text-slate-200 font-medium">{item.label}</span>
            <span className="ml-auto text-slate-500">→</span>
          </Link>
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full py-3 text-red-400 border border-red-900/50 rounded-xl hover:bg-red-900/20 transition-colors font-semibold"
      >
        Logout
      </button>
    </div>
  );
}
