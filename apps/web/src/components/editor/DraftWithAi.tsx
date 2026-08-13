'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Loader2, Sparkles, Wallet, X } from 'lucide-react';
import { getToken as getFreshToken } from '@/lib/auth';
import { API_URL } from '@/lib/config';

const AI_BOOK_COST = 5;

interface Props {
  bookId: string;
  /** True once the author has written anything — AI drafting is then refused. */
  hasWriting: boolean;
  onDone: () => void;
  onClose: () => void;
}

/**
 * Asks for credits at the moment the author wants a paid service, never before.
 * Nothing about money appears until this panel is deliberately opened.
 */
export default function DraftWithAi({ bookId, hasWriting, onDone, onClose }: Props) {
  const [balance, setBalance] = useState<number | null>(null);
  const [topic, setTopic] = useState('');
  const [chapters, setChapters] = useState(8);
  const [phase, setPhase] = useState<'idle' | 'outline' | 'writing'>('idle');
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [error, setError] = useState('');

  useEffect(() => { loadBalance(); }, []);

  const loadBalance = async () => {
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/payments/balance`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setBalance((await res.json()).balance ?? 0);
    } catch { setBalance(0); }
  };

  const short = balance !== null && balance < AI_BOOK_COST;

  const run = async () => {
    if (!topic.trim()) { setError('Tell me what the book is about first.'); return; }
    setError('');
    setPhase('outline');

    try {
      const token = await getFreshToken();

      const res = await fetch(`${API_URL}/api/books/${bookId}/draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic: topic.trim(), chaptersCount: chapters }),
      });
      const book = await res.json();
      if (!res.ok) throw new Error(book?.message || 'Could not build the outline.');

      // Chapters are written one at a time so progress is visible rather than
      // the author watching a spinner for two minutes.
      setPhase('writing');
      const list = book.chapters || [];
      setProgress({ done: 0, total: list.length });

      for (let i = 0; i < list.length; i++) {
        await fetch(`${API_URL}/api/books/${bookId}/chapters/${list[i].id}/generate`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
        setProgress({ done: i + 1, total: list.length });
      }

      onDone();
    } catch (e: any) {
      setError(e.message || 'Something went wrong.');
      setPhase('idle');
    }
  };

  if (hasWriting) {
    return (
      <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3.5">
        <div className="flex items-start justify-between gap-2 mb-2">
          <h4 className="text-[13px] font-semibold text-slate-200">Draft with AI</h4>
          <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={14} /></button>
        </div>
        <p className="text-[12px] text-slate-400 leading-relaxed">
          This book already has your writing in it. AI drafting replaces everything, so it&apos;s only
          offered on an empty book — start a new one if that&apos;s what you want.
        </p>
        <p className="text-[12px] text-slate-400 leading-relaxed mt-2">
          To use AI here, select a passage and choose <strong className="text-slate-200">Expand</strong>,
          or press <code className="px-1 bg-slate-800 rounded text-[11px] font-mono">/</code> to keep writing.
        </p>
      </div>
    );
  }

  if (phase !== 'idle') {
    return (
      <div className="bg-slate-900/60 border border-indigo-500/40 rounded-xl p-3.5">
        <div className="flex items-center gap-2 mb-2.5">
          <Loader2 size={14} className="animate-spin text-indigo-400" />
          <h4 className="text-[13px] font-semibold text-slate-200">
            {phase === 'outline' ? 'Building the outline…' : 'Writing your chapters…'}
          </h4>
        </div>
        {phase === 'writing' && (
          <>
            <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden mb-2">
              <div className="h-full bg-gradient-to-r from-indigo-500 to-indigo-300 rounded-full transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }} />
            </div>
            <p className="text-[11.5px] text-slate-400 tabular-nums">
              Chapter {progress.done} of {progress.total}
            </p>
          </>
        )}
        <p className="text-[11px] text-slate-500 mt-2 leading-relaxed">
          You can keep this tab open — chapters appear in the outline as they finish.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3.5">
      <div className="flex items-start justify-between gap-2 mb-2.5">
        <h4 className="text-[13px] font-semibold text-slate-200 flex items-center gap-1.5">
          <Sparkles size={13} className="text-indigo-400" /> Draft the whole book
        </h4>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={14} /></button>
      </div>

      <textarea
        value={topic}
        onChange={e => setTopic(e.target.value)}
        rows={3}
        placeholder="What is this book about? A sentence or two is plenty."
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-[12.5px]
                   text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 resize-none"
      />

      <div className="flex items-center gap-2 mt-2.5">
        <label htmlFor="chcount" className="text-[11.5px] text-slate-400">Chapters</label>
        <input id="chcount" type="number" min={1} max={30} value={chapters}
          onChange={e => setChapters(Math.min(30, Math.max(1, Number(e.target.value) || 1)))}
          className="w-16 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[12.5px]
                     text-slate-200 focus:outline-none focus:border-indigo-500 tabular-nums" />
        <span className="ml-auto text-[11.5px] text-slate-400 tabular-nums">
          ${AI_BOOK_COST.toFixed(2)}
        </span>
      </div>

      {error && <p className="text-[11.5px] text-red-400 mt-2 leading-relaxed">{error}</p>}

      {short ? (
        <div className="mt-3 pt-3 border-t border-slate-700/60">
          <div className="flex items-start gap-2 mb-2.5">
            <Wallet size={14} className="text-amber-400 shrink-0 mt-0.5" />
            <p className="text-[12px] text-amber-200/90 leading-relaxed">
              This costs ${AI_BOOK_COST.toFixed(2)} and you have ${(balance ?? 0).toFixed(2)}.
              Add ${(AI_BOOK_COST - (balance ?? 0)).toFixed(2)} to continue.
            </p>
          </div>
          <Link href={`/account/topup?next=${encodeURIComponent(`/dashboard/books/${bookId}/edit`)}`}
            className="block text-center w-full px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900
                       rounded-lg text-[12.5px] font-semibold transition">
            Add credits
          </Link>
          <button onClick={loadBalance}
            className="w-full mt-1.5 text-[11px] text-slate-500 hover:text-slate-300 transition">
            I&apos;ve topped up — check again
          </button>
        </div>
      ) : (
        <button onClick={run} disabled={!topic.trim()}
          className="w-full mt-3 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40
                     disabled:cursor-not-allowed rounded-lg text-[12.5px] font-semibold transition">
          Write it — ${AI_BOOK_COST.toFixed(2)}
        </button>
      )}

      <p className="text-[10.5px] text-slate-500 mt-2 leading-relaxed">
        Replaces this empty book with a full draft you can then edit. Refunded if it fails.
      </p>
    </div>
  );
}
