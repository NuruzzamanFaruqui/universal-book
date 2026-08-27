'use client';

import { useEffect, useRef, useState } from 'react';
import { CornerDownLeft, Loader2, Mic, Sparkles, Trash2, CornerUpLeft } from 'lucide-react';
import {
  ChatContext, ChatMessage, clearChat, fetchChat, sendChat,
} from '@/lib/writing-ai';
import { DictationHandle, isSupported as dictationSupported, startDictation } from '@/lib/dictation';

interface Props {
  bookId: string;
  chapterId?: string;
  chapterLabel?: string;
  /** Text currently selected in the editor, if any. */
  selection?: string;
  /** Drops a reply straight into the manuscript at the caret. */
  onInsert?: (text: string) => void;
}

const CONTEXTS: { id: ChatContext; label: string; hint: string }[] = [
  { id: 'book',      label: 'Whole book',    hint: 'Everything written so far' },
  { id: 'chapter',   label: 'This chapter',  hint: 'Only the chapter you have open' },
  { id: 'selection', label: 'Selection',     hint: 'Only the passage you have highlighted' },
];

/**
 * A conversation about the book, not a chatbot bolted to the side.
 *
 * Two things make the difference: the author chooses what the model can see, so
 * a question about one paragraph is not answered from 40,000 words; and any
 * reply can be dropped into the manuscript, so the answer becomes writing.
 */
export default function AssistantChat({
  bookId, chapterId, chapterLabel, selection, onInsert,
}: Props) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [context, setContext] = useState<ChatContext>('book');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [dictating, setDictating] = useState(false);
  const dictation = useRef<DictationHandle | null>(null);
  const canDictate = useRef(false);
  useEffect(() => { canDictate.current = dictationSupported(); }, []);

  const endRef = useRef<HTMLDivElement>(null);
  const boxRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetchChat(bookId)
      .then(setMessages)
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [bookId]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, busy]);

  // A highlighted passage is almost always what the question is about.
  useEffect(() => {
    if (selection && selection.trim().length > 20) setContext('selection');
  }, [selection]);

  useEffect(() => () => { dictation.current?.stop(); }, []);

  const grow = () => {
    const el = boxRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = Math.max(150, Math.min(el.scrollHeight, 420)) + 'px';
  };

  const send = async () => {
    const message = draft.trim();
    if (!message || busy) return;

    setDraft('');
    setError('');
    requestAnimationFrame(grow);

    // Shown immediately; replaced by the server's copy when the turn lands.
    const optimistic: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'USER',
      content: message,
      createdAt: new Date().toISOString(),
    };
    setMessages(m => [...m, optimistic]);
    setBusy(true);

    try {
      const reply = await sendChat(bookId, {
        message,
        contextKind: context,
        chapterId: context === 'chapter' ? chapterId : undefined,
        selection: context === 'selection' ? selection : undefined,
      });
      setMessages(m => [...m, reply]);
    } catch (e: any) {
      setError(e.message);
      // Put the question back so nothing is lost to a failed turn.
      setMessages(m => m.filter(x => x.id !== optimistic.id));
      setDraft(message);
    } finally {
      setBusy(false);
    }
  };

  const toggleDictation = () => {
    if (dictation.current) {
      dictation.current.stop();
      dictation.current = null;
      setDictating(false);
      return;
    }
    const handle = startDictation({
      onFinal: (text) => {
        setDraft(d => (d ? `${d} ${text}` : text));
        requestAnimationFrame(grow);
      },
      onError: (m) => { setError(m); setDictating(false); },
      onEnd: () => { setDictating(false); dictation.current = null; },
    });
    dictation.current = handle;
    setDictating(!!handle);
  };

  const wipe = async () => {
    if (!confirm('Clear this conversation? The book itself is untouched.')) return;
    await clearChat(bookId).catch(() => {});
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* transcript */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4 min-h-0 shrink">
        {loading ? (
          <p className="text-[12.5px] text-slate-500">Loading your conversation…</p>
        ) : messages.length === 0 ? (
          <div className="text-[13px] text-slate-400 leading-relaxed space-y-3 pt-2">
            <p className="flex items-center gap-2 text-slate-300 font-medium">
              <Sparkles size={14} className="text-indigo-400" /> Ask me about your book
            </p>
            <p>I can see what you have written. Try:</p>
            <ul className="space-y-1.5 text-slate-500">
              <li>“Is my argument in chapter 2 convincing?”</li>
              <li>“What am I missing before this is finished?”</li>
              <li>“Rewrite this section for a reader who is new to it.”</li>
              <li>“Give me three ways to open chapter 1.”</li>
            </ul>
          </div>
        ) : messages.map(m => (
          <div key={m.id} className={m.role === 'USER' ? 'pl-6' : ''}>
            <div className={`text-[10px] uppercase tracking-widest mb-1.5 font-mono ${
              m.role === 'USER' ? 'text-slate-600 text-right' : 'text-indigo-400'
            }`}>
              {m.role === 'USER' ? 'You' : 'Assistant'}
            </div>
            <div className={`text-[13.5px] leading-relaxed whitespace-pre-wrap rounded-xl px-3.5 py-2.5 ${
              m.role === 'USER'
                ? 'bg-slate-700/60 text-slate-200'
                : 'bg-slate-900/60 border border-slate-700/60 text-slate-300'
            }`}>
              {m.content}
            </div>
            {m.role === 'ASSISTANT' && onInsert && (
              <button
                onClick={() => onInsert(m.content)}
                className="mt-1.5 flex items-center gap-1.5 text-[11.5px] text-slate-500
                           hover:text-indigo-300 transition"
              >
                <CornerUpLeft size={11} /> Insert into manuscript
              </button>
            )}
          </div>
        ))}

        {busy && (
          <div className="flex items-center gap-2 text-[12.5px] text-slate-500">
            <Loader2 size={13} className="animate-spin text-indigo-400" /> Reading your book…
          </div>
        )}
        <div ref={endRef} />
      </div>

      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-red-500/10 border border-red-500/30 rounded-lg
                        text-[12px] text-red-300">{error}</div>
      )}

      {/* composer */}
      <div className="border-t border-slate-700/60 p-3 space-y-2 shrink-0">
        <div className="flex items-center gap-1 flex-wrap">
          {CONTEXTS.map(c => {
            const unavailable =
              (c.id === 'selection' && !selection?.trim()) ||
              (c.id === 'chapter' && !chapterId);
            return (
              <button
                key={c.id}
                onClick={() => !unavailable && setContext(c.id)}
                disabled={unavailable}
                title={unavailable ? 'Nothing selected' : c.hint}
                className={`px-2 py-1 rounded-md text-[11px] transition ${
                  context === c.id
                    ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40'
                    : 'text-slate-500 hover:text-slate-300 border border-transparent'
                } disabled:opacity-30 disabled:cursor-not-allowed`}
              >
                {c.id === 'chapter' && chapterLabel ? chapterLabel : c.label}
              </button>
            );
          })}
          {messages.length > 0 && (
            <button onClick={wipe} title="Clear conversation"
              className="ml-auto p-1 text-slate-600 hover:text-red-400 transition">
              <Trash2 size={12} />
            </button>
          )}
        </div>

        <div className="flex items-end gap-2 bg-slate-900/70 border border-slate-700 rounded-xl px-3 py-2.5
                        focus-within:border-indigo-500 transition-colors">
          <textarea
            ref={boxRef}
            value={draft}
            onChange={e => { setDraft(e.target.value); grow(); }}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
            }}
            rows={6}
            placeholder="Ask about your book, or ask for writing…"
            aria-label="Message the assistant"
            className="flex-1 bg-transparent resize-none text-[14px] text-slate-200
                       placeholder-slate-600 focus:outline-none leading-relaxed
                       min-h-[150px] max-h-[420px]"
          />
          <div className="flex items-center gap-0.5 shrink-0 pb-0.5">
            {canDictate.current && (
              <button onClick={toggleDictation} title={dictating ? 'Stop dictating' : 'Dictate'}
                className={`p-1.5 rounded-md transition ${
                  dictating ? 'text-red-400 animate-pulse' : 'text-slate-500 hover:text-indigo-300'
                }`}>
                <Mic size={15} />
              </button>
            )}
            <button onClick={send} disabled={!draft.trim() || busy} title="Send — Enter"
              className="p-1.5 rounded-md text-slate-500 hover:text-indigo-300 disabled:opacity-30
                         disabled:hover:text-slate-500 transition">
              <CornerDownLeft size={15} />
            </button>
          </div>
        </div>
        <p className="text-[10px] text-slate-600 px-0.5">
          Enter sends · Shift + Enter for a new line · included with this book
        </p>
      </div>
    </div>
  );
}
