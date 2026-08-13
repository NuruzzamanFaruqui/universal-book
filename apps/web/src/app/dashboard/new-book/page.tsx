'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, AlertCircle } from 'lucide-react';
import { getToken as getFreshToken } from '@/lib/auth';
import { API_URL } from '@/lib/config';

/**
 * There is no "how would you like to create your book?" step any more.
 *
 * Clicking Write Book creates an empty book and opens the editor. Drafting with
 * AI and importing a manuscript are actions inside the editor, offered when the
 * author wants them — not gates in front of the cursor. Nothing asks for money
 * before a word has been written.
 */
export default function NewBookPage() {
  const router = useRouter();
  const [error, setError] = useState('');
  const started = useRef(false);

  useEffect(() => {
    // Guard against React's double-invoked effects in development, which would
    // otherwise leave an orphan empty book behind.
    if (started.current) return;
    started.current = true;

    (async () => {
      try {
        const token = await getFreshToken();
        if (!token) { router.replace('/auth/login'); return; }

        const res = await fetch(`${API_URL}/api/books/blank`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Could not start a new book.');

        const book = await res.json();
        router.replace(`/dashboard/books/${book.id}/edit`);
      } catch (e: any) {
        setError(e.message || 'Could not start a new book.');
      }
    })();
  }, [router]);

  if (error) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center px-4">
        <div className="max-w-sm w-full bg-slate-800 border border-slate-700 rounded-2xl p-7 text-center">
          <AlertCircle className="text-red-400 mx-auto mb-3" size={28} />
          <h1 className="text-lg font-bold text-white mb-2">That didn&apos;t work</h1>
          <p className="text-slate-400 text-sm mb-6">{error}</p>
          <div className="flex gap-2 justify-center">
            <button onClick={() => location.reload()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">
              Try again
            </button>
            <Link href="/feed"
              className="px-4 py-2 border border-slate-600 hover:border-slate-500 rounded-lg text-sm transition">
              Back
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <BookOpen className="text-blue-400 mx-auto mb-3 animate-pulse" size={34} />
        <p className="text-slate-400 text-sm">Opening your editor…</p>
      </div>
    </div>
  );
}
