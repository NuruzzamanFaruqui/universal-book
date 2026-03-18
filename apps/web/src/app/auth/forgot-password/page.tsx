'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import Link from 'next/link';
import { BookOpen, ArrowLeft, Mail } from 'lucide-react';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { sendPasswordResetEmail } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      if (!auth) throw new Error('Auth not available');
      await sendPasswordResetEmail(auth, email);
      setSuccess(true);
    } catch (err: any) {
      setError('Failed to send reset email. Please check your email address.');
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
          <Link href="/auth/login" className="flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6">
            <ArrowLeft size={16} /> Back to Login
          </Link>
          <h1 className="text-2xl font-bold text-white mb-2">Reset Password</h1>
          <p className="text-slate-400 text-sm mb-6">Enter your email and we'll send you a reset link.</p>

          {success ? (
            <div className="text-center py-6">
              <div className="w-16 h-16 bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                <Mail className="text-green-400" size={28} />
              </div>
              <h2 className="text-lg font-bold text-white mb-2">Check your email</h2>
              <p className="text-slate-400 text-sm mb-6">
                We sent a password reset link to <span className="text-white font-semibold">{email}</span>
              </p>
              <Link href="/auth/login" className="text-blue-400 hover:text-blue-300 text-sm">
                Back to Login
              </Link>
            </div>
          ) : (
            <>
              {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-4 text-sm">{error}</div>}
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Email Address</label>
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                    placeholder="your@email.com"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
                </div>
                <button type="submit" disabled={loading}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-semibold text-white transition">
                  {loading ? 'Sending...' : 'Send Reset Link'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
