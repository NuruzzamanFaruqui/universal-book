'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, LogOut, User, Zap, Home } from 'lucide-react';

export default function DashboardNav() {
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      if (auth) {
        const { signOut } = await import('firebase/auth');
        await signOut(auth);
      }
    } catch (e) {}
    localStorage.removeItem('ub_token');
    router.push('/');
  };

  return (
    <nav className="flex items-center justify-between px-8 py-4 border-b border-slate-700 bg-slate-900">
      <Link href="/feed" className="flex items-center gap-2 text-xl font-bold text-white">
        <BookOpen className="text-blue-400" size={24} />
        <span>Universal Book</span>
      </Link>
      <div className="flex items-center gap-4">
        <Link href="/feed" className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition">
          <Home size={16} /> Feed
        </Link>
        <Link href="/dashboard" className="text-slate-400 hover:text-white text-sm transition">My Books</Link>
        <Link href="/dashboard/templates" className="text-slate-400 hover:text-white text-sm transition">Templates</Link>
        <Link href="/dashboard/earnings" className="text-slate-400 hover:text-white text-sm transition">Earnings</Link>
        <Link href="/library" className="text-slate-400 hover:text-white text-sm transition">My Library</Link>
        <Link href="/groups" className="text-slate-400 hover:text-white text-sm transition">Groups</Link>
        <Link href="/dashboard/author-groups" className="text-slate-400 hover:text-white text-sm transition">Co-Write</Link>
        <Link href="/account/subscription" className="flex items-center gap-1 text-yellow-400 hover:text-yellow-300 text-sm transition font-semibold">
          <Zap size={14} /> Upgrade
        </Link>
        <Link href="/account" className="flex items-center gap-1 text-slate-400 hover:text-white text-sm transition">
          <User size={16} /> Account
        </Link>
        <button onClick={handleLogout} className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition">
          <LogOut size={16} /> Logout
        </button>
      </div>
    </nav>
  );
}
