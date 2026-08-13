'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { subscribeToChapter, leaveChapter } from '@/lib/realtime';
import { POLL } from '@/lib/config';

interface CollaborativeEditorProps {
  bookId: string;
  chapterId: string;
  initialContent?: string;
  onSave?: (content: string) => void;
  readOnly?: boolean;
  userName?: string;
  userId?: string;
}

export default function CollaborativeEditor({
  bookId, chapterId, initialContent = '', onSave, readOnly = false, userName = 'Anonymous', userId = '',
}: CollaborativeEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [wordCount, setWordCount] = useState(0);
  const isRemoteUpdate = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // A collaborator's version that arrived while this editor had focus. Held
  // rather than dropped, and applied on blur or when the writer asks for it.
  const pendingRemote = useRef<string | null>(null);
  const [hasIncoming, setHasIncoming] = useState(false);

  const applyRemote = useCallback((html: string) => {
    if (!editorRef.current) return;
    isRemoteUpdate.current = true;
    editorRef.current.innerHTML = html;
    updateWordCount();
    isRemoteUpdate.current = false;
    pendingRemote.current = null;
    setHasIncoming(false);
  }, []);

  // Keep the latest onSave reachable from the debounce timer without making the
  // timer's effect depend on a prop that changes identity every render.
  const onSaveRef = useRef(onSave);
  useEffect(() => { onSaveRef.current = onSave; }, [onSave]);

  useEffect(() => {
    if (editorRef.current && initialContent) {
      editorRef.current.innerHTML = initialContent;
      updateWordCount();
    }
  }, [initialContent]);

  // Poll for collaborator edits and the active-user list. The same request
  // registers this editor's presence.
  useEffect(() => {
    if (!bookId || !chapterId) return;

    const unsubscribe = subscribeToChapter(bookId, chapterId, (state) => {
      setActiveUsers(state.activeUsers.filter((u) => u.userId !== userId));

      // `content` is null when we're already current or made the last edit
      // ourselves, so this only fires for genuine remote changes.
      if (state.content === null || !editorRef.current) return true;
      if (editorRef.current.innerHTML === state.content) return true;

      // Never overwrite a document the user is typing into — that would drop
      // their caret and lose in-flight keystrokes. Hold the change instead and
      // return false so the poll keeps offering it; dropping it here would let
      // our next save overwrite the other person's work.
      if (document.activeElement === editorRef.current) {
        pendingRemote.current = state.content;
        setHasIncoming(true);
        return false;
      }

      applyRemote(state.content);
      return true;
    }, POLL.editor);

    return () => {
      unsubscribe();
      leaveChapter(bookId, chapterId);
    };
  }, [bookId, chapterId, userId]);

  // Apply whatever was held back as soon as the editor loses focus.
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const onBlur = () => {
      if (pendingRemote.current !== null) applyRemote(pendingRemote.current);
    };
    el.addEventListener('blur', onBlur);
    return () => el.removeEventListener('blur', onBlur);
  }, []);

  // Flush any pending edit when the chapter changes or the editor unmounts.
  useEffect(() => {
    return () => {
      if (saveTimer.current) {
        clearTimeout(saveTimer.current);
        if (editorRef.current) onSaveRef.current?.(editorRef.current.innerHTML);
      }
    };
  }, [chapterId]);

  const handleInput = () => {
    if (!editorRef.current || isRemoteUpdate.current) return;
    updateWordCount();

    // Debounced persist: a burst of typing coalesces into one request, which
    // both saves and publishes the change to collaborators.
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      saveTimer.current = null;
      if (!editorRef.current || !onSaveRef.current) return;
      setIsSaving(true);
      await onSaveRef.current(editorRef.current.innerHTML);
      setLastSaved(new Date());
      setIsSaving(false);
    }, 1200);
  };

  const updateWordCount = () => {
    if (editorRef.current) {
      const text = editorRef.current.innerText || '';
      const words = text.trim().split(/\s+/).filter(w => w.length > 0);
      setWordCount(words.length);
    }
  };

  const handleManualSave = useCallback(async () => {
    if (!editorRef.current || !onSave) return;
    setIsSaving(true);
    await onSave(editorRef.current.innerHTML);
    setLastSaved(new Date());
    setIsSaving(false);
  }, [onSave]);

  const execCommand = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    handleInput();
  };

  const isActive = (command: string) => {
    try { return document.queryCommandState(command); } catch { return false; }
  };

  const ToolbarBtn = ({ command, value, children, title }: any) => (
    <button
      onMouseDown={(e) => { e.preventDefault(); execCommand(command, value); }}
      title={title}
      className="px-2.5 py-1.5 rounded text-sm transition text-slate-300 hover:text-white hover:bg-slate-600">
      {children}
    </button>
  );

  const Divider = () => <div className="w-px h-5 bg-slate-600 mx-1" />;

  return (
    <div className="flex flex-col h-full rounded-xl overflow-hidden border border-slate-700">
      <style>{`
        .book-editor { min-height: 500px; padding: 2.5rem; background: white; color: #1e293b; font-family: 'Georgia', serif; font-size: 1.05rem; line-height: 1.8; outline: none; }
        .book-editor h1 { font-size: 2rem; font-weight: 800; color: #0f172a; margin: 1.5rem 0 1rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem; }
        .book-editor h2 { font-size: 1.5rem; font-weight: 700; color: #1e293b; margin: 1.5rem 0 0.75rem; }
        .book-editor h3 { font-size: 1.25rem; font-weight: 600; color: #334155; margin: 1.25rem 0 0.5rem; }
        .book-editor p { margin: 0.75rem 0; }
        .book-editor b, .book-editor strong { font-weight: 700; }
        .book-editor i, .book-editor em { font-style: italic; }
        .book-editor u { text-decoration: underline; }
        .book-editor ul { list-style: disc; padding-left: 1.5rem; margin: 0.75rem 0; }
        .book-editor ol { list-style: decimal; padding-left: 1.5rem; margin: 0.75rem 0; }
        .book-editor blockquote { border-left: 4px solid #3b82f6; padding: 0.5rem 1rem; margin: 1rem 0; background: #f0f7ff; color: #1e40af; font-style: italic; border-radius: 0 8px 8px 0; }
        .book-editor code { background: #f1f5f9; color: #e11d48; padding: 0.15rem 0.4rem; border-radius: 4px; font-family: monospace; font-size: 0.9em; }
        .book-editor pre { background: #1e293b; color: #e2e8f0; padding: 1rem; border-radius: 8px; margin: 1rem 0; }
        .book-editor hr { border: none; border-top: 2px solid #e2e8f0; margin: 1.5rem 0; }
        .book-editor:empty:before { content: 'Start writing your chapter...'; color: #94a3b8; }
      `}</style>

      {!readOnly && (
        <div className="flex items-center gap-0.5 flex-wrap p-2 bg-slate-800 border-b border-slate-700">
          <ToolbarBtn command="bold" title="Bold"><strong>B</strong></ToolbarBtn>
          <ToolbarBtn command="italic" title="Italic"><em>I</em></ToolbarBtn>
          <ToolbarBtn command="underline" title="Underline"><span className="underline">U</span></ToolbarBtn>
          <ToolbarBtn command="strikeThrough" title="Strikethrough"><span className="line-through">S</span></ToolbarBtn>

          <Divider />

          <ToolbarBtn command="formatBlock" value="h1" title="Heading 1">H1</ToolbarBtn>
          <ToolbarBtn command="formatBlock" value="h2" title="Heading 2">H2</ToolbarBtn>
          <ToolbarBtn command="formatBlock" value="h3" title="Heading 3">H3</ToolbarBtn>
          <ToolbarBtn command="formatBlock" value="p" title="Paragraph">¶</ToolbarBtn>

          <Divider />

          <ToolbarBtn command="justifyLeft" title="Align Left">⬅</ToolbarBtn>
          <ToolbarBtn command="justifyCenter" title="Center">↔</ToolbarBtn>
          <ToolbarBtn command="justifyRight" title="Align Right">➡</ToolbarBtn>

          <Divider />

          <ToolbarBtn command="insertUnorderedList" title="Bullet List">• ≡</ToolbarBtn>
          <ToolbarBtn command="insertOrderedList" title="Numbered List">1. ≡</ToolbarBtn>

          <Divider />

          <ToolbarBtn command="formatBlock" value="blockquote" title="Blockquote">❝</ToolbarBtn>
          <ToolbarBtn command="formatBlock" value="pre" title="Code Block">{'</>'}</ToolbarBtn>
          <button onMouseDown={(e) => { e.preventDefault(); execCommand('insertHorizontalRule'); }} title="Horizontal Rule"
            className="px-2.5 py-1.5 rounded text-sm text-slate-300 hover:text-white hover:bg-slate-600">─</button>

          <Divider />

          <ToolbarBtn command="undo" title="Undo">↩</ToolbarBtn>
          <ToolbarBtn command="redo" title="Redo">↪</ToolbarBtn>

          <div className="flex-1" />

          <div className="flex items-center gap-1 mr-2">
            {activeUsers.slice(0, 3).map((user: any, i) => (
              <div key={i} title={user.name}
                className="w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center text-xs font-bold border-2 border-slate-700">
                {user.name?.[0]?.toUpperCase() || '?'}
              </div>
            ))}
            {activeUsers.length > 0 && <span className="text-xs text-slate-400 ml-1">{activeUsers.length} online</span>}
          </div>

          <button onClick={handleManualSave} disabled={isSaving}
            className="px-4 py-1.5 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-lg text-sm font-semibold transition">
            {isSaving ? '💾 Saving...' : '💾 Save'}
          </button>
        </div>
      )}

      {hasIncoming && (
        <div className="flex items-center gap-3 px-4 py-2.5 bg-amber-500/10 border-b border-amber-500/30 text-sm">
          <span className="text-amber-300">
            Someone else edited this chapter while you were typing. Saving now replaces their version.
          </span>
          <button
            onClick={() => pendingRemote.current && applyRemote(pendingRemote.current)}
            className="ml-auto shrink-0 px-3 py-1 bg-amber-500/20 hover:bg-amber-500/30 text-amber-200 rounded-md text-xs font-semibold transition"
          >
            Load their version
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto bg-white">
        <div
          ref={editorRef}
          contentEditable={!readOnly}
          onInput={handleInput}
          className="book-editor h-full"
          suppressContentEditableWarning
        />
      </div>

      <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-t border-slate-700 text-xs text-slate-500">
        <span>{wordCount} words</span>
        <span>{lastSaved ? `Last saved: ${lastSaved.toLocaleTimeString()}` : 'Saves as you type'}</span>
      </div>
    </div>
  );
}
