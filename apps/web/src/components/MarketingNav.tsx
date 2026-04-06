'use client';
import { useEffect, useState, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen, ChevronDown, LogOut, Settings, LayoutDashboard } from 'lucide-react';

export default function MarketingNav() {
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [checked, setChecked] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { auth } = await import('@/lib/firebase');
        if (!auth) { setChecked(true); return; }
        const { onAuthStateChanged } = await import('firebase/auth');
        onAuthStateChanged(auth, async (firebaseUser) => {
          if (firebaseUser) {
            setIsLoggedIn(true);
            const token = await firebaseUser.getIdToken();
            localStorage.setItem('ub_token', token);
            const res = await fetch('https://api.universal-book.com/api/users/me', {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (res.ok) setUser(await res.json());
          } else {
            setIsLoggedIn(false);
            setUser(null);
          }
          setChecked(true);
        });
      } catch (e) { setChecked(true); }
    };
    checkAuth();

    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleLogout = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      if (auth) await auth.signOut();
    } catch (e) {}
    localStorage.removeItem('ub_token');
    setIsLoggedIn(false);
    setUser(null);
    setShowDropdown(false);
    router.push('/');
  };

  return (
    <nav className="w-full border-b border-slate-800 bg-slate-900/80 backdrop-blur sticky top-0 z-50">
      <div className="flex items-center justify-between px-6 py-4 max-w-7xl mx-auto">
        {/* Logo — always goes to home */}
        <Link href="/" className="flex items-center gap-2 text-xl font-bold text-white">
          <BookOpen className="text-blue-400" size={28} />
          <span>Universal Book</span>
        </Link>

        {/* Center Links */}
        <div className="hidden md:flex items-center gap-6 text-sm text-slate-400">
          <Link href="/books" className="hover:text-white transition">Books</Link>
          <Link href="/writers" className="hover:text-white transition">Writers</Link>
          <Link href="/features" className="hover:text-white transition">Features</Link>

        </div>

        {/* Right Side */}
        <div className="flex items-center gap-3">
          {!checked ? (
            <div className="w-8 h-8 bg-slate-700 rounded-full animate-pulse" />
          ) : isLoggedIn ? (
            <div className="flex items-center gap-3">
              <Link href="/feed"
                className="hidden sm:block px-4 py-2 text-slate-300 hover:text-white text-sm transition">
                Feed
              </Link>
              {/* Avatar dropdown */}
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowDropdown(!showDropdown)}
                  className="flex items-center gap-2 hover:bg-slate-800 p-1.5 rounded-lg transition"
                >
                  <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold text-white">
                    {user?.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <span className="hidden sm:block text-sm text-slate-300">{user?.name?.split(' ')[0]}</span>
                  <ChevronDown size={14} className="text-slate-400" />
                </button>

                {showDropdown && (
                  <div className="absolute right-0 top-full mt-2 w-52 bg-slate-800 border border-slate-700 rounded-xl shadow-xl overflow-hidden z-50">
                    <div className="px-4 py-3 border-b border-slate-700">
                      <p className="font-semibold text-sm text-white truncate">{user?.name}</p>
                      <p className="text-xs text-slate-400 truncate">{user?.email}</p>
                    </div>
                    <Link href="/feed" onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 transition">
                      <LayoutDashboard size={16} /> Go to Feed
                    </Link>
                    <Link href="/account" onClick={() => setShowDropdown(false)}
                      className="flex items-center gap-3 px-4 py-3 text-sm text-slate-300 hover:bg-slate-700 transition">
                      <Settings size={16} /> Settings
                    </Link>
                    <button onClick={handleLogout}
                      className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-400 hover:bg-slate-700 transition">
                      <LogOut size={16} /> Logout
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              <Link href="/auth/login" className="px-4 py-2 text-slate-300 hover:text-white transition text-sm">Login</Link>
              <Link href="/auth/register" className="px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition text-sm">Get Started</Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
