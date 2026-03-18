'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { BookOpen } from 'lucide-react';

const API_URL = "https://api.universal-book.com";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { createUserWithEmailAndPassword, updateProfile } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      if (!auth) throw new Error('Auth not available');

      // Step 1: Create Firebase user
      const result = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(result.user, { displayName: name });

      // Step 2: Get fresh token
      const token = await result.user.getIdToken(true);

      // Step 3: Register in our backend
      const res = await fetch(`${API_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.message || 'Backend registration failed');
      }

      // Step 4: Store token
      localStorage.setItem('ub_token', token);
      router.push('/feed');
    } catch (err: any) {
      setError(err.message || 'Registration failed');
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
          <h1 className="text-2xl font-bold text-white mb-6">Create your account</h1>
          {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-4 text-sm">{error}</div>}
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Full Name</label>
              <input type="text" value={name} onChange={e => setName(e.target.value)} required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-semibold text-white transition">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>
          <p className="text-slate-400 text-center mt-4">
            Have an account? <Link href="/auth/login" className="text-blue-400 hover:text-blue-300">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
