'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, Users, LayoutDashboard, Settings, BookMarked, LogOut, Shield, ChevronRight } from 'lucide-react';

const ADMIN_EMAILS = ['faruqui.swe@diu.edu.bd', 'levin.kuhlmann@monash.edu'];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [status, setStatus] = useState<'loading' | 'authorized' | 'denied'>('loading');
  const [debugMsg, setDebugMsg] = useState('Initializing...');

  useEffect(() => {
    let mounted = true;
    const checkAdmin = async () => {
      try {
        const { auth } = await import('@/lib/firebase');
        if (!auth) { if (mounted) { setDebugMsg('No auth'); setStatus('denied'); } return; }
        const { onAuthStateChanged } = await import('firebase/auth');
        const unsubscribe = onAuthStateChanged(auth, (user) => {
          if (!mounted) return;
          unsubscribe();
          if (!user || !user.email) { setDebugMsg('Not logged in'); setStatus('denied'); router.push('/auth/login'); return; }
          const email = user.email.toLowerCase().trim();
          setDebugMsg(`Logged in as: ${email}`);
          const isAdmin = ADMIN_EMAILS.some(a => a.toLowerCase() === email);
          if (isAdmin) { setStatus('authorized'); }
          else { setDebugMsg(`Not admin: ${email}`); setStatus('denied'); }
        });
      } catch (e: any) {
        if (mounted) { setDebugMsg(`Error: ${e.message}`); setStatus('denied'); }
      }
    };
    checkAdmin();
    return () => { mounted = false; };
  }, []);

  const handleLogout = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      if (auth) { const { signOut } = await import('firebase/auth'); await signOut(auth); }
    } catch (e) {}
    localStorage.removeItem('ub_token');
    router.push('/');
  };

  if (status === 'loading') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-white text-xl mb-2">Verifying admin access...</div>
        <div className="text-gray-500 text-xs mt-2">{debugMsg}</div>
      </div>
    </div>
  );

  if (status === 'denied') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="text-red-400 text-xl mb-2">Access Denied</div>
        <div className="text-gray-400 text-sm mt-1">{debugMsg}</div>
        <Link href="/dashboard" className="mt-6 inline-block px-4 py-2 bg-blue-600 rounded-lg text-white text-sm">Back to Dashboard</Link>
      </div>
    </div>
  );

  const navItems = [
    { href: '/universalbook-admin', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { href: '/universalbook-admin/users', label: 'Users', icon: <Users size={18} /> },
    { href: '/universalbook-admin/books', label: 'Books', icon: <BookMarked size={18} /> },
    { href: '/universalbook-admin/team', label: 'Team & Roles', icon: <Shield size={18} /> },
    { href: '/universalbook-admin/settings', label: 'Settings', icon: <Settings size={18} /> },
  ];

  return (
    <div className="min-h-screen bg-gray-950 text-white flex">
      <aside className="w-64 bg-gray-900 border-r border-gray-800 flex flex-col fixed h-full">
        <div className="px-6 py-5 border-b border-gray-800">
          <div className="flex items-center gap-2 text-lg font-bold">
            <BookOpen className="text-blue-400" size={22} />
            <span>Universal Book</span>
          </div>
          <div className="text-xs text-red-400 font-semibold mt-1 flex items-center gap-1">
            <Shield size={10} /> ADMIN PANEL
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                pathname === item.href ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`}>
              {item.icon}{item.label}
              {pathname === item.href && <ChevronRight size={14} className="ml-auto" />}
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-800 space-y-2">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-gray-800 transition">
            <LayoutDashboard size={18} /> User Dashboard
          </Link>
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-400 hover:text-red-400 hover:bg-gray-800 transition">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>
      <main className="flex-1 ml-64 min-h-screen">{children}</main>
    </div>
  );
}
