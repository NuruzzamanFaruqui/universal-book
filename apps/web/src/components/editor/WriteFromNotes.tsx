'use client';

import { useRef, useState } from 'react';
import { FileText, Loader2, Paperclip, X } from 'lucide-react';
import { draftFromNotes } from '@/lib/writing-ai';

interface Props {
  bookId: string;
  chapterId: string;
  chapterTitle: string;
  /** True if the chapter already has prose — drafting would replace it. */
  hasContent: boolean;
  onDone: () => void;
  onClose: () => void;
}

/**
 * Turns material the author already has into a chapter.
 *
 * This is the shortest path from what someone knows to words on the page, and
 * the one thing that stops output reading like every other AI book: the
 * substance is theirs, and the model is told not to add any of its own.
 */
export default function WriteFromNotes({
  bookId, chapterId, chapterTitle, hasContent, onDone, onClose,
}: Props) {
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [confirming, setConfirming] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const readFile = async (file: File) => {
    setError('');
    // Plain text only here; .docx and .pdf go through the import flow, which
    // already has the parsing for them.
    if (!/\.(txt|md|markdown)$/i.test(file.name)) {
      setError('Paste the text, or use Import a manuscript for .docx and .pdf files.');
      return;
    }
    const text = await file.text();
    setNotes(prev => (prev ? `${prev}\n\n${text}` : text));
  };

  const run = async () => {
    if (notes.trim().length < 40) {
      setError('Give me a little more to work with — a few lines at least.');
      return;
    }
    if (hasContent && !confirming) { setConfirming(true); return; }

    setBusy(true);
    setError('');
    try {
      await draftFromNotes(bookId, chapterId, notes);
      onDone();
    } catch (e: any) {
      setError(e.message);
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3.5">
      <div className="flex items-start justify-between gap-2 mb-2">
        <h4 className="text-[13px] font-semibold text-slate-200 flex items-center gap-1.5">
          <FileText size={13} className="text-indigo-400" /> Write from my notes
        </h4>
        <button onClick={onClose} className="text-slate-500 hover:text-slate-300"><X size={14} /></button>
      </div>

      <p className="text-[11.5px] text-slate-500 leading-relaxed mb-2.5">
        Rough notes, a transcript, bullet points — anything. I&apos;ll shape it into prose for{' '}
        <strong className="text-slate-400">{chapterTitle || 'this chapter'}</strong> without adding
        facts or examples of my own.
      </p>

      <textarea
        value={notes}
        onChange={e => { setNotes(e.target.value); setConfirming(false); }}
        rows={8}
        placeholder={'- the handover always fails at the same point\n- runbook survives, judgement does not\n- example: the billing retry nobody can explain'}
        className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-[12.5px]
                   text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500
                   resize-none font-mono leading-relaxed"
      />

      <div className="flex items-center gap-2 mt-2">
        <button onClick={() => fileInput.current?.click()}
          className="flex items-center gap-1.5 text-[11.5px] text-slate-400 hover:text-indigo-300 transition">
          <Paperclip size={12} /> Attach a .txt
        </button>
        <input ref={fileInput} type="file" accept=".txt,.md,.markdown" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) readFile(f); e.target.value = ''; }} />
        <span className="ml-auto text-[11px] text-slate-600 tabular-nums">
          {(notes.match(/\S+/g) || []).length} words
        </span>
      </div>

      {error && <p className="text-[11.5px] text-red-400 mt-2 leading-relaxed">{error}</p>}

      {confirming && (
        <p className="text-[11.5px] text-amber-300 mt-2 leading-relaxed">
          This chapter already has writing in it, and drafting replaces it. Press again to go ahead.
        </p>
      )}

      <button onClick={run} disabled={busy || notes.trim().length < 40}
        className={`w-full mt-2.5 px-3 py-2 rounded-lg text-[12.5px] font-semibold transition
                    disabled:opacity-40 disabled:cursor-not-allowed ${
          confirming ? 'bg-amber-500 hover:bg-amber-400 text-slate-900'
                     : 'bg-indigo-600 hover:bg-indigo-500'
        }`}>
        {busy ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 size={13} className="animate-spin" /> Shaping your notes…
          </span>
        ) : confirming ? 'Replace this chapter' : 'Write this chapter'}
      </button>

      <p className="text-[10.5px] text-slate-500 mt-2 leading-relaxed">
        Included with this book — no credits.
      </p>
    </div>
  );
}
