'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen } from 'lucide-react';

const API_URL = "https://universal-book-api-73444175926.us-central1.run.app";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { signInWithEmailAndPassword } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      if (!auth) throw new Error('Auth not available');
      const result = await signInWithEmailAndPassword(auth, email, password);
      const token = await result.user.getIdToken(true);
      await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      });
      localStorage.setItem('ub_token', token);
      router.push('/feed');
    } catch (err: any) {
      setError('Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-8">
          <BookOpen className="text-blue-400" size={32} />
          <span className="text-2xl font-bold text-white">Universal Book</span>
        </div>
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
          <h1 className="text-2xl font-bold text-white mb-6">Welcome back</h1>
          {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-4 text-sm">{error}</div>}
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
              <div className="text-right mt-1">
                <Link href="/auth/forgot-password" className="text-sm text-blue-400 hover:text-blue-300">
                  Forgot password?
                </Link>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-semibold text-white transition">
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
          <p className="text-slate-400 text-center mt-4">
            No account? <Link href="/auth/register" className="text-blue-400 hover:text-blue-300">Register free</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
