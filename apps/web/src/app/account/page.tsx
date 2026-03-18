'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, ArrowLeft, User, Mail, Save, Zap, Shield } from 'lucide-react';

const API_URL = "https://api.universal-book.com";
const ADMIN_EMAILS = ['faruqui.swe@diu.edu.bd', 'levin.kuhlmann@monash.edu'];

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ub_token');
    if (!token) { router.push('/auth/login'); return; }
    fetchUser();
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { auth } = await import('@/lib/firebase');
      if (!auth) return;
      const { onAuthStateChanged } = await import('firebase/auth');
      const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        if (firebaseUser?.email) {
          const email = firebaseUser.email.toLowerCase().trim();
          setIsAdmin(ADMIN_EMAILS.some(a => a.toLowerCase() === email));
        }
        unsubscribe();
      });
    } catch (e) {}
  };

  const fetchUser = async () => {
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setUser(data);
      setName(data.name || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      setSuccess('Profile updated successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading profile...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="flex items-center justify-between px-8 py-4 border-b border-slate-700">
        <div className="flex items-center gap-2 text-xl font-bold">
          <BookOpen className="text-blue-400" size={24} />
          <span>Universal Book</span>
        </div>
        <Link href="/dashboard" className="flex items-center gap-2 text-slate-400 hover:text-white">
          <ArrowLeft size={18} /> Back to Dashboard
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-8 py-12">
        <h1 className="text-3xl font-bold mb-8">My Account</h1>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-6">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500 text-green-400 rounded-lg p-3 mb-6">{success}</div>}

        {/* Admin Panel Access */}
        {isAdmin && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-900/50 rounded-lg flex items-center justify-center">
                  <Shield className="text-red-400" size={20} />
                </div>
                <div>
                  <div className="font-bold text-red-300">Admin Access</div>
                  <div className="text-slate-400 text-sm">You have administrative privileges</div>
                </div>
              </div>
              <Link href="/universalbook-admin"
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-semibold transition">
                <Shield size={14} /> Open Admin Panel
              </Link>
            </div>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 mb-6">
          <div className="flex items-center gap-4 mb-8">
            <div className="w-16 h-16 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold">
              {user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div>
              <div className="font-bold text-lg">{user?.name || 'No name set'}</div>
              <div className="text-slate-400 text-sm">{user?.email}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 bg-blue-900 text-blue-300 rounded-full">
                  {user?.plan || 'FREE'} Plan
                </span>
                {isAdmin && (
                  <span className="text-xs px-2 py-0.5 bg-red-900 text-red-300 rounded-full flex items-center gap-1">
                    <Shield size={10} /> Super Admin
                  </span>
                )}
              </div>
            </div>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Your full name" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input type="email" value={user?.email || ''} disabled
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-slate-400 cursor-not-allowed" />
              </div>
              <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
            </div>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-semibold transition">
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Stats Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-4">Your Stats</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-400">{user?.books?.length || 0}</div>
              <div className="text-slate-400 text-sm">Books Created</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-400">
                {user?.books?.reduce((acc: number, b: any) => acc + (b.chapters?.length || 0), 0) || 0}
              </div>
              <div className="text-slate-400 text-sm">Chapters Written</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-400">{user?.plan || 'FREE'}</div>
              <div className="text-slate-400 text-sm">Current Plan</div>
            </div>
          </div>
        </div>

        {/* Subscription Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg mb-1">Subscription Plan</h2>
              <p className="text-slate-400 text-sm">Manage your plan and billing</p>
            </div>
            <Link href="/account/subscription"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">
              <Zap size={14} /> Manage Plan
            </Link>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-slate-800 border border-red-900 rounded-xl p-6">
          <h2 className="font-bold text-lg text-red-400 mb-4">Danger Zone</h2>
          <p className="text-slate-400 text-sm mb-4">Once you delete your account, all your books will be permanently deleted.</p>
          <button className="px-4 py-2 border border-red-700 text-red-400 hover:bg-red-900/30 rounded-lg text-sm transition">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
