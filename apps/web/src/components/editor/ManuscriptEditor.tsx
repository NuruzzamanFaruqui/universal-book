'use client';

import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor, Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import { Loader2, Mic, Sparkles, Undo2 } from 'lucide-react';
import { subscribeToChapter, leaveChapter } from '@/lib/realtime';
import { POLL } from '@/lib/config';
import { assist, AssistAction, ASSIST_LABELS } from '@/lib/writing-ai';
import { DictationHandle, isSupported as dictationSupported, startDictation } from '@/lib/dictation';

interface Props {
  bookId: string;
  chapterId: string;
  /** Prefix for section numbers — 3 gives 3.1, 3.1.1. */
  chapterNumber?: number;
  /** 0 hides numbering entirely, as fiction should. */
  sectionDepth?: number;
  initialContent?: string;
  bookTitle?: string;
  tone?: string;
  /** A sample of the author's own prose, used by "In my voice". */
  voiceSample?: string;
  /** Rendered inside the page itself, above the body — the chapter or section
   *  heading, laid out as it will print rather than in a strip above it. */
  pageHeader?: ReactNode;
  /** What the empty body invites — differs for a title page and a chapter. */
  bodyPlaceholder?: string;
  onSave?: (html: string) => Promise<void> | void;
  onStats?: (stats: { words: number; chars: number }) => void;
  /** Fires on the first keystroke, so the outline can get out of the way. */
  onTyping?: () => void;
  /** Reports the highlighted text, so the assistant can be asked about it. */
  onSelectionChange?: (text: string) => void;
  /** Hands back a function that inserts text at the caret. */
  onReady?: (api: { insert: (text: string) => void }) => void;
  readOnly?: boolean;
  userId?: string;
}

const SAVE_DEBOUNCE_MS = 1200;

/** Coordinates for the floating toolbars, in viewport space. */
interface Anchor { top: number; left: number; bottom: number }

export default function ManuscriptEditor({
  bookId, chapterId, initialContent = '', bookTitle, tone, voiceSample,
  chapterNumber = 1, sectionDepth = 3, pageHeader, bodyPlaceholder,
  onSave, onStats, onTyping, onSelectionChange, onReady, readOnly = false, userId = '',
}: Props) {
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeUsers, setActiveUsers] = useState<{ userId: string; name: string }[]>([]);
  const [busy, setBusy] = useState<AssistAction | null>(null);
  const [error, setError] = useState('');

  const [selAnchor, setSelAnchor] = useState<Anchor | null>(null);
  const [slashAnchor, setSlashAnchor] = useState<Anchor | null>(null);

  // A collaborator's version that arrived while this editor had focus. Held
  // rather than dropped — discarding it would let the next save overwrite
  // their work with no trace.
  const pendingRemote = useRef<string | null>(null);
  const [hasIncoming, setHasIncoming] = useState(false);

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  const [dictating, setDictating] = useState(false);
  const [interim, setInterim] = useState('');
  const dictation = useRef<DictationHandle | null>(null);
  const canDictate = useRef(false);
  useEffect(() => { canDictate.current = dictationSupported(); }, []);

  const onTypingRef = useRef(onTyping);
  useEffect(() => { onTypingRef.current = onTyping; }, [onTyping]);

  const isRemote = useRef(false);
  /** Set immediately after an AI replacement, so one undo restores the original. */
  const undoable = useRef(false);

  const editor = useEditor({
    // Tiptap 3 renders synchronously by default, which trips App Router
    // hydration. This is the flag that makes it work under Next.js 14.
    immediatelyRender: false,
    editable: !readOnly,
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3, 4] } }),
      Underline,
      Placeholder.configure({
        placeholder: ({ node }) =>
          node.type.name === 'heading'
            ? 'Section heading…'
            : (bodyPlaceholder || 'Start writing, or press / for help…'),
      }),
    ],
    content: initialContent || '<p></p>',
    editorProps: {
      attributes: { class: 'manuscript-body', spellcheck: 'true' },
    },
    onUpdate: ({ editor }) => {
      if (isRemote.current) return;
      undoable.current = false;
      onTypingRef.current?.();
      scheduleSave(editor);
      report(editor);
    },
    onSelectionUpdate: ({ editor }) => positionBubble(editor),
  });

  // Expose an insert so the assistant's replies can land in the manuscript.
  useEffect(() => {
    if (!editor || !onReady) return;
    onReady({
      insert: (text: string) => {
        const html = text
          .split(/\n{2,}/)
          .map(par => `<p>${par.replace(/\n/g, ' ').trim()}</p>`)
          .join('');
        editor.chain().focus().insertContent(html).run();
        scheduleSave(editor);
        report(editor);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  const report = useCallback((ed: Editor) => {
    const text = ed.getText();
    onStats?.({ words: (text.match(/\S+/g) || []).length, chars: text.length });
  }, [onStats]);

  // ── saving ────────────────────────────────────────────────────────────────

  const scheduleSave = useCallback((ed: Editor) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null;
      if (!onSaveRef.current) return;
      setSaving(true);
      try {
        await onSaveRef.current(ed.getHTML());
        setLastSaved(new Date());
      } finally {
        setSaving(false);
      }
    }, SAVE_DEBOUNCE_MS);
  }, []);

  // Flush anything pending when the chapter changes or the editor unmounts.
  useEffect(() => () => {
    if (saveTimer.current && editor) {
      clearTimeout(saveTimer.current);
      onSaveRef.current?.(editor.getHTML());
    }
  }, [chapterId, editor]);

  // Load a different chapter without treating it as an edit.
  useEffect(() => {
    if (!editor) return;
    isRemote.current = true;
    editor.commands.setContent(initialContent || '<p></p>', { emitUpdate: false });
    isRemote.current = false;
    pendingRemote.current = null;
    setHasIncoming(false);
    report(editor);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chapterId, editor]);

  // ── collaborators ─────────────────────────────────────────────────────────

  const applyRemote = useCallback((html: string) => {
    if (!editor) return;
    isRemote.current = true;
    editor.commands.setContent(html, { emitUpdate: false });
    isRemote.current = false;
    pendingRemote.current = null;
    setHasIncoming(false);
    report(editor);
  }, [editor, report]);

  useEffect(() => {
    if (!editor || !bookId || !chapterId) return;

    const stop = subscribeToChapter(bookId, chapterId, (state) => {
      setActiveUsers(state.activeUsers.filter(u => u.userId !== userId));

      if (state.content === null) return true;
      if (state.content === editor.getHTML()) return true;

      // Never overwrite a document being typed into. Returning false keeps the
      // poll offering this content instead of moving past it.
      if (editor.isFocused) {
        pendingRemote.current = state.content;
        setHasIncoming(true);
        return false;
      }
      applyRemote(state.content);
      return true;
    }, POLL.editor);

    return () => { stop(); leaveChapter(bookId, chapterId); };
  }, [editor, bookId, chapterId, userId, applyRemote]);

  // Apply anything held back as soon as focus leaves.
  useEffect(() => {
    if (!editor) return;
    const onBlur = () => { if (pendingRemote.current) applyRemote(pendingRemote.current); };
    editor.on('blur', onBlur);
    return () => { editor.off('blur', onBlur); };
  }, [editor, applyRemote]);

  // ── floating toolbars ─────────────────────────────────────────────────────

  function anchorFromSelection(): Anchor | null {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) return null;
    const r = sel.getRangeAt(0).getBoundingClientRect();
    if (!r.top && !r.left) return null;
    return { top: r.top, left: r.left + r.width / 2, bottom: r.bottom };
  }

  const positionBubble = useCallback((ed: Editor) => {
    const { from, to } = ed.state.selection;
    if (from === to || readOnly) {
      setSelAnchor(null);
      onSelectionChange?.('');
      return;
    }
    onSelectionChange?.(ed.state.doc.textBetween(from, to, ' '));
    setSelAnchor(anchorFromSelection());
  }, [readOnly, onSelectionChange]);

  useEffect(() => {
    const close = () => { setSelAnchor(null); setSlashAnchor(null); };
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => {
      window.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
    };
  }, []);

  // "/" on an empty line opens the command menu.
  useEffect(() => {
    if (!editor) return;
    const el = editor.view.dom;
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.key === '/') {
        const { $from } = editor.state.selection;
        if ($from.parent.textContent.trim() === '/') setSlashAnchor(anchorFromSelection());
      } else if (e.key === 'Escape') {
        setSlashAnchor(null);
      }
    };
    el.addEventListener('keyup', onKeyUp);
    return () => el.removeEventListener('keyup', onKeyUp);
  }, [editor]);

  // ── AI on a selection ─────────────────────────────────────────────────────

  const runAssist = useCallback(async (action: AssistAction) => {
    if (!editor) return;
    const { from, to } = editor.state.selection;
    const text = editor.state.doc.textBetween(from, to, ' ');
    if (!text.trim()) return;

    setBusy(action);
    setError('');
    setSelAnchor(null);
    try {
      const replacement = await assist(action, text, { bookTitle, tone, voiceSample });
      editor.chain().focus().insertContentAt({ from, to }, replacement).run();
      undoable.current = true;
      scheduleSave(editor);
      report(editor);
    } catch (e: any) {
      setError(e.message);
      setTimeout(() => setError(''), 6000);
    } finally {
      setBusy(null);
    }
  }, [editor, bookTitle, tone, voiceSample, scheduleSave, report]);

  const runContinue = useCallback(async () => {
    if (!editor) return;
    // Strip the "/" that opened the menu.
    const { $from } = editor.state.selection;
    if ($from.parent.textContent.trim() === '/') {
      editor.chain().focus()
        .deleteRange({ from: $from.start(), to: $from.start() + $from.parent.textContent.length })
        .run();
    }
    setSlashAnchor(null);

    const before = editor.state.doc.textBetween(
      Math.max(0, editor.state.selection.from - 1200), editor.state.selection.from, ' ',
    );
    if (!before.trim()) { setError('Write a line or two first, then I have something to continue from.'); return; }

    setBusy('continue');
    setError('');
    try {
      const text = await assist('continue', before, { bookTitle, tone, voiceSample });
      editor.chain().focus().insertContent(' ' + text).run();
      undoable.current = true;
      scheduleSave(editor);
      report(editor);
    } catch (e: any) {
      setError(e.message);
      setTimeout(() => setError(''), 6000);
    } finally {
      setBusy(null);
    }
  }, [editor, bookTitle, tone, voiceSample, scheduleSave, report]);

  const toggleDictation = useCallback(() => {
    if (dictation.current) {
      dictation.current.stop();
      dictation.current = null;
      setDictating(false);
      setInterim('');
      return;
    }
    if (!editor) return;

    const handle = startDictation({
      onInterim: setInterim,
      onFinal: (text) => {
        setInterim('');
        // Sentence case and a trailing space, so speech reads as prose.
        const cleaned = text.charAt(0).toUpperCase() + text.slice(1);
        const punctuated = /[.!?]$/.test(cleaned) ? cleaned : cleaned + '.';
        editor.chain().focus().insertContent(punctuated + ' ').run();
        scheduleSave(editor);
        report(editor);
      },
      onError: (m) => { setError(m); setTimeout(() => setError(''), 6000); setDictating(false); },
      onEnd: () => { setDictating(false); setInterim(''); dictation.current = null; },
    });
    dictation.current = handle;
    setDictating(!!handle);
  }, [editor, scheduleSave, report]);

  // Never leave the microphone running after the editor goes away.
  useEffect(() => () => { dictation.current?.stop(); }, []);

  if (!editor) {
    return (
      <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
        Loading editor…
      </div>
    );
  }

  const numbered = sectionDepth > 0;

  const btn = (label: string, active: boolean, fn: () => void, title?: string) => (
    <button
      key={label}
      onMouseDown={e => { e.preventDefault(); fn(); }}
      title={title || label}
      className={`px-2.5 py-1.5 rounded text-sm transition ${
        active ? 'bg-slate-600 text-white' : 'text-slate-300 hover:text-white hover:bg-slate-700'
      }`}
    >{label}</button>
  );

  return (
    <div className="flex flex-col h-full min-h-0 relative">
      <style>{`
        .manuscript-body {
          outline: none;
          font-family: 'Iowan Old Style', 'Palatino Linotype', Palatino, Georgia, serif;
          font-size: 1.06rem;
          line-height: 1.78;
          color: #1b1b18;
        }
        .manuscript-body > * + * { margin-top: 1.1rem; }
        .manuscript-body h2 { font-size: 1.4rem; line-height: 1.25; font-weight: 650; margin-top: 2rem; }
        .manuscript-body h3 { font-size: 1.15rem; font-weight: 650; margin-top: 1.6rem; }
        .manuscript-body h4 { font-size: 1.02rem; font-weight: 650; margin-top: 1.35rem; }

        /* Numbering is CSS counters, never stored — move a chapter or add a
           section and every number below is right with nothing to migrate. */
        .numbered .manuscript-body h2 { counter-increment: s2; counter-reset: s3 s4; }
        .numbered .manuscript-body h3 { counter-increment: s3; counter-reset: s4; }
        .numbered .manuscript-body h4 { counter-increment: s4; }
        .numbered .manuscript-body h2::before { content: counter(ch) "." counter(s2) "  "; color: #9b978c; font-weight: 600; }
        .numbered .manuscript-body h3::before { content: counter(ch) "." counter(s2) "." counter(s3) "  "; color: #9b978c; font-weight: 600; }
        .numbered .manuscript-body h4::before { content: counter(ch) "." counter(s2) "." counter(s3) "." counter(s4) "  "; color: #9b978c; font-weight: 600; }
        .manuscript-body ul { list-style: disc; padding-left: 1.4rem; }
        .manuscript-body ol { list-style: decimal; padding-left: 1.4rem; }
        .manuscript-body li > p { margin: 0; }
        .manuscript-body blockquote { border-left: 3px solid #e6e3db; padding-left: 1.1rem; color: #55544e; font-style: italic; }
        .manuscript-body pre { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 8px; font-size: .85rem; font-family: ui-monospace, monospace; overflow-x: auto; }
        .manuscript-body code { background: #f1f5f9; color: #b91c4a; padding: .12rem .35rem; border-radius: 4px; font-size: .88em; font-family: ui-monospace, monospace; }
        .manuscript-body pre code { background: none; color: inherit; padding: 0; }
        .manuscript-body hr { border: none; border-top: 2px solid #e6e3db; margin: 2rem 0; }
        .manuscript-body p.is-editor-empty:first-child::before,
        .manuscript-body h1.is-editor-empty::before {
          content: attr(data-placeholder); float: left; height: 0;
          color: #a8a49a; pointer-events: none;
        }
      `}</style>

      {/* toolbar */}
      {!readOnly && (
        <div className="flex items-center gap-0.5 flex-wrap px-3 py-2 bg-slate-800 border-b border-slate-700 shrink-0">
          {btn('B', editor.isActive('bold'), () => editor.chain().focus().toggleBold().run(), 'Bold')}
          {btn('I', editor.isActive('italic'), () => editor.chain().focus().toggleItalic().run(), 'Italic')}
          {btn('U', editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Underline')}
          <div className="w-px h-5 bg-slate-600 mx-1.5" />
          {btn('Text', editor.isActive('paragraph'), () => editor.chain().focus().setParagraph().run(), 'Ordinary paragraph')}
          {btn(numbered ? 'Section 1.1' : 'Section', editor.isActive('heading', { level: 2 }),
            () => editor.chain().focus().toggleHeading({ level: 2 }).run(),
            numbered ? 'A numbered section — 1.1' : 'A section heading')}
          {sectionDepth >= 2 && btn(numbered ? 'Sub 1.1.1' : 'Subsection', editor.isActive('heading', { level: 3 }),
            () => editor.chain().focus().toggleHeading({ level: 3 }).run(),
            numbered ? 'A subsection — 1.1.1' : 'A subsection heading')}
          {sectionDepth >= 3 && btn(numbered ? 'Sub 1.1.1.1' : 'Sub-sub', editor.isActive('heading', { level: 4 }),
            () => editor.chain().focus().toggleHeading({ level: 4 }).run(),
            numbered ? 'A sub-subsection — 1.1.1.1' : 'A sub-subsection heading')}
          <div className="w-px h-5 bg-slate-600 mx-1.5" />
          {btn('•', editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet list')}
          {btn('1.', editor.isActive('orderedList'), () => editor.chain().focus().toggleOrderedList().run(), 'Numbered list')}
          {btn('❝', editor.isActive('blockquote'), () => editor.chain().focus().toggleBlockquote().run(), 'Quote')}
          {btn('</>', editor.isActive('codeBlock'), () => editor.chain().focus().toggleCodeBlock().run(), 'Code block')}
          <div className="w-px h-5 bg-slate-600 mx-1.5" />
          {btn('↩', false, () => editor.chain().focus().undo().run(), 'Undo')}
          {btn('↪', false, () => editor.chain().focus().redo().run(), 'Redo')}

          {canDictate.current && (
            <>
              <div className="w-px h-5 bg-slate-600 mx-1.5" />
              <button
                onClick={toggleDictation}
                title={dictating ? 'Stop dictating' : 'Dictate — talk and it becomes prose'}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded text-sm transition ${
                  dictating ? 'bg-red-500/20 text-red-300' : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Mic size={14} className={dictating ? 'animate-pulse' : ''} />
                {dictating ? 'Listening' : 'Dictate'}
              </button>
            </>
          )}

          <div className="flex-1" />

          {activeUsers.length > 0 && (
            <div className="flex items-center gap-1 mr-2">
              {activeUsers.slice(0, 3).map(u => (
                <div key={u.userId} title={u.name}
                  className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-[10px] font-bold border-2 border-slate-700">
                  {u.name?.[0]?.toUpperCase() || '?'}
                </div>
              ))}
              <span className="text-[11px] text-slate-400 ml-1">editing</span>
            </div>
          )}

          <span className="text-xs text-slate-400 tabular-nums">
            {saving ? 'Saving…' : lastSaved ? `Saved ${lastSaved.toLocaleTimeString()}` : 'Saves as you type'}
          </span>
        </div>
      )}

      {hasIncoming && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-sm shrink-0">
          <span className="text-amber-300">
            Someone else edited this chapter while you were typing. Saving now replaces their version.
          </span>
          <button
            onClick={() => pendingRemote.current && applyRemote(pendingRemote.current)}
            className="ml-auto shrink-0 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-md text-xs font-semibold transition"
          >Load their version</button>
        </div>
      )}

      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-b border-red-500/30 text-sm text-red-300 shrink-0">
          {error}
        </div>
      )}

      {/* the page */}
      <div className="flex-1 overflow-y-auto bg-[#0A0F18] px-4 pt-6">
        <div className="w-full max-w-[72rem] mx-auto bg-[#FDFCF9] rounded-sm shadow-[0_1px_3px_rgba(0,0,0,.5),0_18px_50px_rgba(0,0,0,.35)] px-[clamp(2rem,5vw,5rem)] py-14 min-h-[calc(100vh-9rem)]">
          {pageHeader}
          <div
            className={numbered ? 'numbered' : undefined}
            style={numbered ? ({ counterReset: `ch ${chapterNumber} s2 0 s3 0 s4 0` } as any) : undefined}
          >
            <EditorContent editor={editor} />
          </div>
        </div>
        <div className="h-24" />
      </div>

      {dictating && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 max-w-lg
                        bg-[#101725] border border-red-500/40 rounded-full px-4 py-2 shadow-2xl">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="text-[13px] text-slate-300 truncate">
            {interim || 'Listening — just talk.'}
          </span>
          <button onClick={toggleDictation}
            className="ml-1 shrink-0 text-[12px] text-slate-400 hover:text-white transition">Stop</button>
        </div>
      )}

      {/* selection toolbar */}
      {selAnchor && !busy && (
        <div
          className="fixed z-50 flex items-center gap-0.5 bg-[#101725] border border-slate-700 rounded-lg p-1 shadow-2xl"
          style={{
            top: Math.max(8, selAnchor.top - 46),
            left: Math.min(Math.max(8, selAnchor.left - 190), window.innerWidth - 388),
          }}
        >
          <Sparkles size={13} className="text-indigo-400 ml-1.5 mr-0.5 shrink-0" />
          {ASSIST_LABELS.map(a => (
            <button
              key={a.action}
              title={a.hint}
              onMouseDown={e => { e.preventDefault(); runAssist(a.action); }}
              className="px-2 py-1.5 text-[13px] text-slate-300 hover:text-indigo-300 hover:bg-indigo-500/15 rounded-md transition whitespace-nowrap"
            >{a.label}</button>
          ))}
        </div>
      )}

      {/* slash menu */}
      {slashAnchor && (
        <div
          className="fixed z-50 w-60 bg-[#101725] border border-slate-700 rounded-xl p-1.5 shadow-2xl"
          style={{
            top: Math.min(slashAnchor.bottom + 8, window.innerHeight - 220),
            left: Math.min(slashAnchor.left, window.innerWidth - 260),
          }}
        >
          <div className="px-2 py-1 text-[10px] uppercase tracking-widest text-slate-500 font-mono">Write with AI</div>
          <button onMouseDown={e => { e.preventDefault(); runContinue(); }}
            className="flex items-center gap-2 w-full px-2 py-2 text-[13px] text-slate-300 hover:text-indigo-300 hover:bg-indigo-500/15 rounded-md transition text-left">
            ✍️ Continue writing
          </button>
          <div className="px-2 py-1 mt-1 text-[10px] uppercase tracking-widest text-slate-500 font-mono">Insert</div>
          {[
            { label: `§  Section${numbered ? '  1.1' : ''}`, fn: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
            { label: `§  Subsection${numbered ? '  1.1.1' : ''}`, fn: () => editor.chain().focus().toggleHeading({ level: 3 }).run() },
            { label: '❝  Quote', fn: () => editor.chain().focus().toggleBlockquote().run() },
            { label: '—  Divider', fn: () => editor.chain().focus().setHorizontalRule().run() },
          ].map(i => (
            <button key={i.label}
              onMouseDown={e => {
                e.preventDefault();
                const { $from } = editor.state.selection;
                if ($from.parent.textContent.trim() === '/') {
                  editor.chain().focus()
                    .deleteRange({ from: $from.start(), to: $from.start() + $from.parent.textContent.length })
                    .run();
                }
                i.fn();
                setSlashAnchor(null);
              }}
              className="flex items-center gap-2 w-full px-2 py-2 text-[13px] text-slate-300 hover:text-white hover:bg-slate-700 rounded-md transition text-left">
              {i.label}
            </button>
          ))}
        </div>
      )}

      {/* working state */}
      {busy && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2.5 bg-[#101725] border border-indigo-500/40 rounded-full px-4 py-2 shadow-2xl">
          <Loader2 size={14} className="animate-spin text-indigo-400" />
          <span className="text-[13px] text-slate-300">
            {busy === 'continue' ? 'Writing…' : 'Rewriting…'}
          </span>
        </div>
      )}

      {undoable.current && !busy && (
        <button
          onClick={() => { editor.chain().focus().undo().run(); undoable.current = false; }}
          className="fixed bottom-6 right-6 z-40 flex items-center gap-1.5 bg-[#101725] border border-slate-700 rounded-full px-3.5 py-2 text-[12px] text-slate-300 hover:text-white shadow-xl transition"
        >
          <Undo2 size={13} /> Undo AI change
        </button>
      )}
    </div>
  );
}
