'use client';
export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, BookOpen, Sparkles, Map, Loader2, PanelRightClose, PanelRightOpen, AlertCircle, Upload,
  FileStack, Wand2, ScrollText, X, Plus, Trash2, ChevronUp, ChevronDown, FileText, PenLine,
  Pin, PinOff, Maximize2, Minimize2, MessageSquare, Wrench,
} from 'lucide-react';
import ManuscriptEditor from '@/components/editor/ManuscriptEditor';
import DraftWithAi from '@/components/editor/DraftWithAi';
import WriteFromNotes from '@/components/editor/WriteFromNotes';
import AssistantChat from '@/components/editor/AssistantChat';
import { useEditorLayout, usePanelResize } from '@/lib/editor-layout';
import { getToken as getFreshToken } from '@/lib/auth';
import { API_URL } from '@/lib/config';
import {
  describeShape, inferMetadata, reviewBook, generateMatter,
  addChapter, renameChapter, deleteChapter, reorderChapters, fetchContents, ContentsEntry,
  ShapeReport, ReviewReport, BookMetadata,
} from '@/lib/writing-ai';

/**
 * The rail, ordered by how often a writer reaches for each: the conversation
 * first, then the tools that make text, then the ones that judge it.
 */
const TABS = [
  { id: 'assistant', label: 'Assistant', icon: MessageSquare, hint: 'Ask about your book' },
  { id: 'write',     label: 'Tools',     icon: Wrench,        hint: 'Draft, notes, import, shape' },
  { id: 'review',    label: 'Review',    icon: ScrollText,    hint: 'Continuity, pacing, voice' },
] as const;

const wordsIn = (html: string | null | undefined) => {
  const plain = (html || '').replace(/<[^>]+>/g, ' ');
  return (plain.match(/\S+/g) || []).length;
};

export default function EditChapterPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;

  const [book, setBook] = useState<any>(null);
  const [selectedChapter, setSelectedChapter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [liveWords, setLiveWords] = useState(0);
  const {
    outlineMode, setOutlineMode, outlineCollapsed, outlineOverlaid,
    setPeeking, noteTyping,
    panelWidth, setPanelWidth, panelOpen, setPanelOpen, tab, setTab,
  } = useEditorLayout();
  const { onPointerDown } = usePanelResize(panelWidth, setPanelWidth);
  const [expanded, setExpanded] = useState(false);
  const [vw, setVw] = useState(1440);
  const [selectionText, setSelectionText] = useState('');
  const insertRef = useRef<((text: string) => void) | null>(null);
  const [showDraft, setShowDraft] = useState(false);
  const [shape, setShape] = useState<ShapeReport | null>(null);
  const [shapeBusy, setShapeBusy] = useState(false);
  const [shapeError, setShapeError] = useState('');

  const [review, setReview] = useState<ReviewReport | null>(null);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState('');
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const [meta, setMeta] = useState<BookMetadata | null>(null);
  const [metaBusy, setMetaBusy] = useState(false);
  const [matterBusy, setMatterBusy] = useState(false);
  const [titleDraft, setTitleDraft] = useState('');
  const [bookSubtitle, setBookSubtitle] = useState('');

  const [showNotes, setShowNotes] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState('');
  const [chapterBusy, setChapterBusy] = useState(false);
  const [chapTitle, setChapTitle] = useState('');
  const [chapSubtitle, setChapSubtitle] = useState('');
  const [contents, setContents] = useState<ContentsEntry[]>([]);

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [bookId]);

  useEffect(() => {
    const onResize = () => setVw(window.innerWidth);
    onResize();
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  /** Drops a reply from the assistant into the manuscript at the caret. */
  const insertIntoManuscript = useCallback((text: string) => {
    insertRef.current?.(text);
  }, []);

  const fetchData = async () => {
    try {
      const token = await getFreshToken();
      if (!token) { router.push('/auth/login'); return; }

      const [bookRes, userRes] = await Promise.all([
        fetch(`${API_URL}/api/books/${bookId}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API_URL}/api/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (bookRes.ok) {
        const data = await bookRes.json();
        setBook(data);
        setTitleDraft(data.title || '');
        setBookSubtitle(data.subtitle || '');
        if (data.chapters?.length) {
          setSelectedChapter((prev: any) =>
            prev
              ? data.chapters.find((c: any) => c.id === prev.id) || prev
              : data.chapters.find((c: any) => (c.kind || 'CHAPTER') === 'CHAPTER') || data.chapters[0],
          );
        }
      }
      if (userRes.ok) setUser(await userRes.json());
    } catch (e) { /* keep whatever is on screen */ }
    finally { setLoading(false); }
  };

  useEffect(() => {
    setChapTitle(selectedChapter?.title || '');
    setChapSubtitle(selectedChapter?.subtitle || '');
  }, [selectedChapter?.id, selectedChapter?.title, selectedChapter?.subtitle]);

  // The Contents page is a live view, so it is fetched when opened rather than
  // read from stored content.
  useEffect(() => {
    if (selectedChapter?.slug !== 'contents') return;
    fetchContents(bookId).then(setContents).catch(() => setContents([]));
  }, [bookId, selectedChapter?.slug, book?.chapters]);

  const saveChapterHeading = useCallback(async (field: 'title' | 'subtitle', value: string) => {
    if (!selectedChapter) return;
    const current = selectedChapter[field] || '';
    if (value.trim() === current) return;
    await renameChapter(bookId, selectedChapter.id, { [field]: value.trim() });
    setBook((b: any) => b && ({
      ...b,
      chapters: b.chapters.map((c: any) =>
        c.id === selectedChapter.id ? { ...c, [field]: value.trim() } : c),
    }));
    setSelectedChapter((c: any) => c && ({ ...c, [field]: value.trim() }));
  }, [bookId, selectedChapter]);

  const handleSave = useCallback(async (content: string) => {
    if (!selectedChapter) return;
    const token = await getFreshToken();
    await fetch(`${API_URL}/api/books/${bookId}/chapters/${selectedChapter.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content }),
    });
    // Keep the outline's word counts honest without refetching the book.
    setBook((b: any) => b && ({
      ...b,
      chapters: b.chapters.map((c: any) => c.id === selectedChapter.id ? { ...c, content } : c),
    }));
  }, [bookId, selectedChapter]);

  const saveTitle = async () => {
    const next = titleDraft.trim();
    if (next === (book?.title || '')) return;
    const token = await getFreshToken();
    await fetch(`${API_URL}/api/books/${bookId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: next }),
    });
    setBook((b: any) => b && { ...b, title: next });
  };

  const saveBookSubtitle = async () => {
    const next = bookSubtitle.trim();
    if (next === (book?.subtitle || '')) return;
    const token = await getFreshToken();
    await fetch(`${API_URL}/api/books/${bookId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ subtitle: next }),
    });
    setBook((b: any) => b && { ...b, subtitle: next });
  };

  const runInfer = async () => {
    setMetaBusy(true);
    setShapeError('');
    try {
      const m = await inferMetadata(bookId);
      setMeta(m);
      setBook((b: any) => b && { ...b, genre: b.genre || m.genre, audience: b.audience || m.audience });
    } catch (e: any) { setShapeError(e.message); }
    finally { setMetaBusy(false); }
  };

  const runReview = async () => {
    setReviewBusy(true);
    setReviewError('');
    try { setReview(await reviewBook(bookId)); }
    catch (e: any) { setReviewError(e.message); }
    finally { setReviewBusy(false); }
  };

  const runMatter = async () => {
    setMatterBusy(true);
    setShapeError('');
    try { await generateMatter(bookId); await fetchData(); }
    catch (e: any) { setShapeError(e.message); }
    finally { setMatterBusy(false); }
  };

  // ── chapters ──────────────────────────────────────────────────────────────

  const withChapters = async (fn: () => Promise<any>) => {
    setChapterBusy(true);
    setShapeError('');
    try { await fn(); await fetchData(); }
    catch (e: any) { setShapeError(e.message); }
    finally { setChapterBusy(false); }
  };

  const onAddChapter = () =>
    withChapters(async () => {
      const created = await addChapter(bookId, selectedChapter?.id);
      setSelectedChapter(created);
    });

  const onRename = async (chapterId: string) => {
    const title = renameDraft.trim();
    setRenaming(null);
    await withChapters(() => renameChapter(bookId, chapterId, { title }));
  };

  const onDelete = (chapterId: string, title: string) => {
    if (!confirm(`Delete "${title || 'this chapter'}"? Its writing goes with it.`)) return;
    withChapters(async () => {
      await deleteChapter(bookId, chapterId);
      if (selectedChapter?.id === chapterId) setSelectedChapter(null);
    });
  };

  const onMove = (chapterId: string, direction: -1 | 1) => {
    const ids = grouped.chapters.map((c: any) => c.id);
    const i = ids.indexOf(chapterId);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    withChapters(() => reorderChapters(bookId, ids));
  };

  const runShape = async () => {
    setShapeBusy(true);
    setShapeError('');
    try {
      setShape(await describeShape(bookId));
    } catch (e: any) {
      setShapeError(e.message);
    } finally {
      setShapeBusy(false);
    }
  };

  /** A sample of the author's own prose, for "In my voice". */
  const voiceSample = useMemo(() => {
    if (!book?.chapters) return undefined;
    const other = book.chapters.find((c: any) => c.id !== selectedChapter?.id && wordsIn(c.content) > 120);
    if (!other) return undefined;
    return (other.content || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 1500);
  }, [book, selectedChapter]);

  const hasWriting = useMemo(
    () => (book?.chapters || []).some((c: any) => (c.kind || 'CHAPTER') === 'CHAPTER' && wordsIn(c.content) > 0),
    [book],
  );

  const grouped = useMemo(() => {
    const all = book?.chapters || [];
    const of = (k: string) => all
      .filter((c: any) => (c.kind || 'CHAPTER') === k)
      .sort((a: any, b: any) => a.number - b.number);
    return { front: of('FRONT_MATTER'), chapters: of('CHAPTER'), back: of('BACK_MATTER') };
  }, [book]);

  const hasMatter = grouped.front.length > 0 || grouped.back.length > 0;
  const openFlags = (review?.continuity || []).filter(f => !dismissed.has(f.issue));

  const totalWords = useMemo(() =>
    grouped.chapters.reduce((sum: number, c: any) =>
      sum + (c.id === selectedChapter?.id ? liveWords : wordsIn(c.content)), 0),
  [grouped, selectedChapter, liveWords]);

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-slate-400 text-sm">Loading editor…</div>
    </div>
  );

  if (!book) return (
    <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center gap-4">
      <div className="text-slate-300">That book could not be opened.</div>
      <Link href="/dashboard" className="px-4 py-2 bg-blue-600 rounded-lg text-sm">Back to dashboard</Link>
    </div>
  );

  return (
    <div className="h-screen bg-slate-900 text-white flex flex-col overflow-hidden">

      {/* top bar */}
      <header className="flex items-center gap-3 px-4 h-13 py-2.5 bg-slate-800 border-b border-slate-700 shrink-0">
        <Link href={`/dashboard/books/${bookId}`}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition" title="Back to book">
          <ArrowLeft size={18} />
        </Link>
        <BookOpen size={18} className="text-blue-400 shrink-0" />
        <input
          value={titleDraft}
          onChange={e => setTitleDraft(e.target.value)}
          onBlur={saveTitle}
          onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
          placeholder="Untitled book"
          aria-label="Book title"
          className="font-semibold text-[15px] bg-transparent border border-transparent hover:border-slate-600
                     focus:border-blue-500 focus:bg-slate-900 rounded-md px-2 py-1 -ml-1 min-w-[8rem]
                     max-w-[22rem] flex-1 focus:outline-none placeholder-slate-600 transition-colors"
        />
        {book.genre ? (
          <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full
                           border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 shrink-0"
                title="Detected from what you have written — confirmed at publish, never before">
            <Sparkles size={9} /> {book.genre}
          </span>
        ) : hasWriting ? (
          <button onClick={runInfer} disabled={metaBusy}
            className="hidden sm:inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full
                       border border-slate-600 text-slate-400 hover:border-indigo-500 hover:text-indigo-300
                       shrink-0 transition disabled:opacity-50">
            {metaBusy ? <Loader2 size={9} className="animate-spin" /> : <Wand2 size={9} />}
            {metaBusy ? 'Reading…' : 'Detect genre'}
          </button>
        ) : null}
        <span className="ml-auto text-xs text-slate-400 tabular-nums shrink-0">
          {totalWords.toLocaleString()} words
        </span>
        <Link href={`/books/${bookId}`} target="_blank"
          className="hidden sm:block px-3 py-1.5 text-[12.5px] text-slate-300 hover:text-white
                     border border-slate-600 hover:border-slate-500 rounded-lg transition shrink-0">
          Preview
        </Link>
        <Link href={`/dashboard/books/${bookId}`}
          className="px-3 py-1.5 text-[12.5px] font-semibold bg-blue-600 hover:bg-blue-500
                     rounded-lg transition shrink-0">
          Publish
        </Link>
        <button onClick={() => setPanelOpen(p => !p)}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
          title={panelOpen ? 'Hide assistant' : 'Show assistant'}>
          {panelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
      </header>

      <div className="flex flex-1 min-h-0 relative">

        {/* A hair-trigger strip on the left edge: brushing it brings the outline
            back without having to aim at anything. */}
        {outlineCollapsed && (
          <div
            className="hidden lg:block absolute left-0 top-0 bottom-0 w-4 z-30"
            onMouseEnter={() => setPeeking(true)}
            aria-hidden
          />
        )}

        {/* Pinned, it pushes the page. Peeking, it floats over — so the text
            never reflows under the caret mid-sentence. */}
        <aside
          onMouseEnter={() => outlineMode === 'auto' && setPeeking(true)}
          onMouseLeave={() => outlineMode === 'auto' && setPeeking(false)}
          className={`hidden lg:flex w-60 flex-col bg-slate-800 border-r border-slate-700 shrink-0
                      transition-transform duration-200 ease-out
                      ${outlineOverlaid ? 'absolute left-0 top-0 bottom-0 z-40 shadow-2xl shadow-black/60' : ''}
                      ${outlineCollapsed ? 'absolute left-0 top-0 bottom-0 z-40 -translate-x-full' : ''}`}
        >
          <div className="px-4 pt-3 pb-2 flex items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono">Manuscript</span>
            <button
              onClick={() => setOutlineMode(outlineMode === 'auto' ? 'pinned' : 'auto')}
              title={outlineMode === 'auto'
                ? 'Hides itself while you write. Click to keep it open.'
                : 'Always open. Click to let it hide while you write.'}
              className={`ml-auto p-1 rounded-md transition ${
                outlineMode === 'pinned' ? 'text-indigo-400 bg-indigo-500/15'
                                         : 'text-slate-600 hover:text-slate-300'}`}
            >
              {outlineMode === 'pinned' ? <Pin size={12} /> : <PinOff size={12} />}
            </button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {(['front', 'chapters', 'back'] as const).map(section => {
              const rows = grouped[section];
              if (!rows.length) return null;
              const label = section === 'front' ? 'Front matter'
                : section === 'back' ? 'Back matter' : 'Chapters';
              return (
                <div key={section} className="mb-1">
                  <div className="flex items-center gap-1.5 px-2.5 pt-2 pb-1">
                    <span className="text-[10px] uppercase tracking-wider text-slate-500">{label}</span>
                    {section !== 'chapters' && (
                      <span className="text-[9px] px-1 py-px rounded bg-indigo-500/15 text-indigo-400
                                       border border-indigo-500/30">auto</span>
                    )}
                  </div>
                  {rows.map((c: any, idx: number) => {
                    const on = c.id === selectedChapter?.id;
                    const words = on ? liveWords : wordsIn(c.content);
                    const isChapter = section === 'chapters';

                    if (renaming === c.id) {
                      return (
                        <input
                          key={c.id}
                          autoFocus
                          value={renameDraft}
                          onChange={e => setRenameDraft(e.target.value)}
                          onBlur={() => onRename(c.id)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                            if (e.key === 'Escape') setRenaming(null);
                          }}
                          placeholder="Chapter title"
                          className="w-full bg-slate-950 border border-blue-500 rounded-lg px-2.5 py-2
                                     text-[13px] text-white focus:outline-none placeholder-slate-600"
                        />
                      );
                    }

                    return (
                      <div key={c.id}
                        className={`group flex items-center gap-1 rounded-lg transition ${
                          on ? 'bg-slate-700' : 'hover:bg-slate-700/50'
                        }`}>
                        <button onClick={() => setSelectedChapter(c)}
                          onDoubleClick={() => { if (isChapter) { setRenaming(c.id); setRenameDraft(c.title || ''); } }}
                          title={isChapter ? 'Double-click to rename' : undefined}
                          className={`flex items-baseline gap-2 flex-1 min-w-0 text-left px-2.5 py-2 text-[13px] leading-snug ${
                            on ? 'text-white font-semibold' : 'text-slate-400 group-hover:text-white'
                          }`}>
                          <span className={`font-mono text-[10px] shrink-0 ${on ? 'text-blue-400' : 'text-slate-600'}`}>
                            {isChapter ? c.number : '·'}
                          </span>
                          <span className={`truncate flex-1 ${
                          !isChapter && !wordsIn(c.content) ? 'opacity-55' : ''
                        }`}>{c.title || 'Untitled chapter'}</span>
                          {isChapter && (
                            <span className="font-mono text-[10px] text-slate-600 shrink-0">
                              {words ? (words > 999 ? `${(words / 1000).toFixed(1)}k` : words) : '—'}
                            </span>
                          )}
                        </button>

                        {!isChapter && (
                          <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100
                                          transition pr-1 shrink-0">
                            <button onClick={() => onDelete(c.id, c.title)} disabled={chapterBusy}
                              title="Remove this section"
                              className="p-0.5 text-slate-500 hover:text-red-400 disabled:opacity-20">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}

                        {isChapter && (
                          <div className="flex items-center opacity-0 group-hover:opacity-100 focus-within:opacity-100
                                          transition pr-1 shrink-0">
                            <button onClick={() => onMove(c.id, -1)} disabled={idx === 0 || chapterBusy}
                              title="Move up"
                              className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20 disabled:hover:text-slate-500">
                              <ChevronUp size={13} />
                            </button>
                            <button onClick={() => onMove(c.id, 1)} disabled={idx === rows.length - 1 || chapterBusy}
                              title="Move down"
                              className="p-0.5 text-slate-500 hover:text-white disabled:opacity-20 disabled:hover:text-slate-500">
                              <ChevronDown size={13} />
                            </button>
                            <button onClick={() => { setRenaming(c.id); setRenameDraft(c.title || ''); }}
                              title="Rename"
                              className="p-0.5 text-slate-500 hover:text-white">
                              <PenLine size={12} />
                            </button>
                            <button onClick={() => onDelete(c.id, c.title)} disabled={chapterBusy}
                              title="Delete chapter"
                              className="p-0.5 text-slate-500 hover:text-red-400 disabled:opacity-20">
                              <Trash2 size={12} />
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}

                  {section === 'chapters' && (
                    <button onClick={onAddChapter} disabled={chapterBusy}
                      className="flex items-center gap-2 w-full text-left px-2.5 py-2 rounded-lg text-[12.5px]
                                 text-slate-500 hover:text-blue-300 hover:bg-slate-700/40 transition disabled:opacity-50">
                      {chapterBusy ? <Loader2 size={13} className="animate-spin" /> : <Plus size={13} />}
                      Add chapter
                    </button>
                  )}
                </div>
              );
            })}

            {!hasMatter && (
              <button onClick={runMatter} disabled={matterBusy}
                className="flex items-center gap-2 w-full text-left px-2.5 py-2 mt-2 rounded-lg text-[12px]
                           text-slate-500 hover:text-indigo-300 hover:bg-slate-700/40 transition disabled:opacity-50">
                {matterBusy ? <Loader2 size={13} className="animate-spin" /> : <FileStack size={13} />}
                {matterBusy ? 'Adding…' : 'Add front & back matter'}
              </button>
            )}

            <p className="px-2.5 pt-3 text-[10.5px] text-slate-600 leading-relaxed">
              Faded sections are empty. Delete any your book does not need.
            </p>
          </div>

          <div className="border-t border-slate-700/60 px-4 py-3">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1.5">
              <span>Draft</span>
              <strong className="tabular-nums">{totalWords.toLocaleString()}</strong>
            </div>
            <div className="h-1.5 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full bg-gradient-to-r from-blue-500 to-indigo-400 rounded-full"
                style={{ width: `${Math.min(100, (totalWords / 40000) * 100)}%` }} />
            </div>
            <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
              {grouped.chapters.length} {grouped.chapters.length === 1 ? 'chapter' : 'chapters'}
              {book.genre ? ` · ${book.genre} books usually run 35–50k words.` : ' · most books run 35–50k words.'}
            </p>
          </div>
        </aside>

        {/* the page */}
        <main className="flex-1 min-w-0 flex flex-col">
          {selectedChapter?.slug === 'contents' ? (
            <div className="flex-1 overflow-y-auto bg-[#0A0F18] px-4 pt-6">
              <div className="w-full max-w-[72rem] mx-auto bg-[#FDFCF9] text-[#1b1b18] rounded-sm
                              shadow-[0_1px_3px_rgba(0,0,0,.5),0_18px_50px_rgba(0,0,0,.35)]
                              px-[clamp(2rem,5vw,5rem)] py-14 min-h-[calc(100vh-9rem)] font-serif">
                <h1 className="text-[1.95rem] font-bold tracking-tight mb-1">Contents</h1>
                <p className="text-[13px] text-[#8a8880] mb-8 font-sans">
                  Built from your chapters and sections. Always current — there is nothing to edit here.
                </p>
                {contents.length === 0 ? (
                  <p className="text-[#55544e] italic">
                    Your chapters will appear here as you write them.
                  </p>
                ) : (
                  <ol className="space-y-3 list-none p-0">
                    {contents.map(c => (
                      <li key={c.id}>
                        <button onClick={() => {
                            const target = book.chapters.find((x: any) => x.id === c.id);
                            if (target) setSelectedChapter(target);
                          }}
                          className="text-left w-full hover:underline decoration-[#c9c5b8] underline-offset-4">
                          <span className="font-semibold">{c.number}. {c.title}</span>
                          {c.subtitle && (
                            <span className="text-[#55544e] italic"> — {c.subtitle}</span>
                          )}
                        </button>
                        {c.sections.length > 0 && (
                          <ul className="mt-1.5 space-y-1 list-none p-0">
                            {c.sections.map((sec, i) => (
                              <li key={i} className="text-[.95rem] text-[#55544e]"
                                  style={{ paddingLeft: `${sec.level * 1.4}rem` }}>
                                {sec.label && (
                                  <span className="text-[#9b978c] font-semibold mr-2">{sec.label}</span>
                                )}
                                {sec.title}
                              </li>
                            ))}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
              <div className="h-24" />
            </div>
          ) : selectedChapter ? (
            <>
              <ManuscriptEditor
                key={selectedChapter.id}
                bookId={bookId}
                chapterId={selectedChapter.id}
                initialContent={selectedChapter.content || ''}
                bookTitle={book.title || 'Untitled book'}
                tone={book.tone}
                voiceSample={voiceSample}
                userId={user?.id || ''}
                chapterNumber={selectedChapter.number}
                sectionDepth={selectedChapter.kind === 'CHAPTER' ? (book.sectionDepth ?? 3) : 0}
                onSave={handleSave}
                onStats={s => setLiveWords(s.words)}
                onTyping={noteTyping}
                onSelectionChange={setSelectionText}
                onReady={api => { insertRef.current = api.insert; }}
                bodyPlaceholder={
                  selectedChapter.slug === 'title-page'
                    ? 'Publisher or edition line — optional'
                    : selectedChapter.kind === 'CHAPTER'
                      ? 'Start writing, or press / for help…'
                      : `Write your ${(selectedChapter.title || 'section').toLowerCase()} here…`
                }
                pageHeader={
                  selectedChapter.slug === 'title-page' ? (
                    /* An actual title page: what the reader will see, edited in place. */
                    <div className="text-center mb-16 mt-8">
                      <input
                        value={titleDraft}
                        onChange={e => setTitleDraft(e.target.value)}
                        onBlur={saveTitle}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        placeholder="Your book's title"
                        aria-label="Book title"
                        className="w-full text-center bg-transparent text-[2.1rem] leading-tight font-bold
                                   text-[#1b1b18] placeholder-[#c4c0b4] focus:outline-none
                                   border-b border-transparent focus:border-[#d8d4c8] pb-1"
                      />
                      <input
                        value={bookSubtitle}
                        onChange={e => setBookSubtitle(e.target.value)}
                        onBlur={saveBookSubtitle}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        placeholder="Subtitle — optional"
                        aria-label="Book subtitle"
                        className="w-full text-center bg-transparent text-[1.05rem] italic mt-3
                                   text-[#55544e] placeholder-[#c4c0b4] focus:outline-none
                                   border-b border-transparent focus:border-[#d8d4c8] pb-1"
                      />
                      <p className="mt-14 text-[1rem] text-[#1b1b18]">{user?.name || 'Your name'}</p>
                      <p className="mt-10 text-[11px] text-[#a8a49a] font-sans not-italic">
                        Type directly on the page. This is how the title page will look.
                      </p>
                    </div>
                  ) : selectedChapter.kind === 'CHAPTER' ? (
                    <div className="mb-9">
                      <div className="text-[11px] uppercase tracking-[.18em] text-[#a8a49a] font-sans mb-2">
                        Chapter {selectedChapter.number}
                      </div>
                      <input
                        value={chapTitle}
                        onChange={e => setChapTitle(e.target.value)}
                        onBlur={() => saveChapterHeading('title', chapTitle)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        placeholder="Chapter title"
                        aria-label="Chapter title"
                        className="w-full bg-transparent text-[1.95rem] leading-tight font-bold tracking-tight
                                   text-[#1b1b18] placeholder-[#c4c0b4] focus:outline-none
                                   border-b border-transparent focus:border-[#d8d4c8] pb-0.5"
                      />
                      <input
                        value={chapSubtitle}
                        onChange={e => setChapSubtitle(e.target.value)}
                        onBlur={() => saveChapterHeading('subtitle', chapSubtitle)}
                        onKeyDown={e => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
                        placeholder="Subtitle — optional"
                        aria-label="Chapter subtitle"
                        className="w-full bg-transparent text-[1.05rem] italic mt-1.5
                                   text-[#55544e] placeholder-[#c4c0b4] focus:outline-none
                                   border-b border-transparent focus:border-[#d8d4c8] pb-0.5"
                      />
                      <div className="mt-7 border-b border-[#e6e3db]" />
                    </div>
                  ) : (
                    <div className="mb-8">
                      <h1 className="text-[1.7rem] font-bold tracking-tight text-[#1b1b18]">
                        {selectedChapter.title}
                      </h1>
                      {selectedChapter.summary && !wordsIn(selectedChapter.content) && (
                        <p className="mt-2 text-[12.5px] text-[#a8a49a] font-sans leading-relaxed">
                          {selectedChapter.summary}
                        </p>
                      )}
                      <div className="mt-6 border-b border-[#e6e3db]" />
                    </div>
                  )
                }
              />
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              This book has no chapters yet.
            </div>
          )}
        </main>

        {/* assistant workspace */}
        {panelOpen && (
          <div
            className="hidden xl:flex shrink-0 relative"
            style={{ width: expanded ? Math.max(panelWidth, Math.round(vw * 0.5)) : panelWidth }}
          >
            <div
              onPointerDown={onPointerDown}
              onDoubleClick={() => setPanelWidth(520)}
              title="Drag to resize · double-click to reset"
              className="absolute left-0 top-0 bottom-0 w-1.5 -ml-0.5 z-20 cursor-col-resize
                         hover:bg-indigo-500/40 transition-colors"
            />

            <div className="flex-1 min-w-0 flex flex-col bg-slate-800 border-l border-slate-700">
              <div className="px-4 pt-3 pb-2 flex items-center gap-2 shrink-0">
                <span className="text-[10px] uppercase tracking-widest text-slate-500 font-mono flex items-center gap-1.5">
                  <Sparkles size={11} className="text-indigo-400" />
                  {TABS.find(t => t.id === tab)?.label ?? 'Assistant'}
                </span>
                {tab === 'review' && openFlags.length > 0 && (
                  <span className="text-[9px] px-1.5 py-px rounded-full bg-amber-500/15
                                   text-amber-400 border border-amber-500/30">
                    {openFlags.length} to look at
                  </span>
                )}
                <button
                  onClick={() => setExpanded(e => !e)}
                  title={expanded ? 'Shrink the panel' : 'Give the assistant half the screen'}
                  className="ml-auto p-1 text-slate-600 hover:text-slate-300 transition"
                >
                  {expanded ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
                </button>
              </div>

              {tab === 'assistant' ? (
                <AssistantChat
                  bookId={bookId}
                  chapterId={selectedChapter?.id}
                  chapterLabel={selectedChapter?.kind === 'CHAPTER'
                    ? `Chapter ${selectedChapter.number}` : selectedChapter?.title}
                  selection={selectionText}
                  onInsert={insertIntoManuscript}
                />
              ) : tab === 'review' ? (
                <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2 min-h-0">
              <button onClick={runReview} disabled={reviewBusy || !hasWriting}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[13px] text-slate-300 bg-slate-900/60
                           border border-slate-700/60 rounded-xl hover:border-indigo-500 hover:text-indigo-300
                           transition disabled:opacity-50 text-left">
                {reviewBusy ? <Loader2 size={15} className="animate-spin" /> : <ScrollText size={15} />}
                {reviewBusy ? 'Reading the manuscript…' : review ? 'Review again' : 'Review my manuscript'}
              </button>

              {!hasWriting && (
                <p className="text-[12px] text-slate-500 px-1 leading-relaxed">
                  Write a chapter and I&apos;ll check it for promises you didn&apos;t keep, terms that drift,
                  and places the voice changes.
                </p>
              )}

              {reviewError && (
                <div className="flex gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-[12px] text-red-300">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />{reviewError}
                </div>
              )}

              {review && (
                <>
                  {openFlags.length === 0 ? (
                    <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3.5">
                      <p className="text-[12.5px] text-emerald-300 leading-relaxed">
                        Nothing inconsistent found. Promises are kept and terminology holds.
                      </p>
                    </div>
                  ) : openFlags.map((f, i) => (
                    <div key={i}
                      className={`flex gap-2 items-start px-3 py-2.5 rounded-xl text-[12.5px] leading-relaxed border-l-2 ${
                        f.severity === 'high'
                          ? 'bg-amber-500/10 border-l-amber-500 text-amber-100/90'
                          : 'bg-slate-900/60 border-l-slate-600 text-slate-300'
                      }`}>
                      <AlertCircle size={13} className="shrink-0 mt-0.5 opacity-70" />
                      <span className="flex-1">
                        {f.chapter ? <strong className="font-semibold">Ch.{f.chapter} · </strong> : null}
                        {f.issue}
                      </span>
                      <button onClick={() => setDismissed(d => new Set(d).add(f.issue))}
                        title="Dismiss" className="shrink-0 opacity-50 hover:opacity-100 transition">
                        <X size={12} />
                      </button>
                    </div>
                  ))}

                  <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3.5">
                    <h4 className="text-[11px] uppercase tracking-wider text-slate-500 font-mono mb-1.5">Pacing</h4>
                    <p className="text-[12.5px] text-slate-300 leading-relaxed">
                      {review.pacing.chapters} chapters, averaging{' '}
                      <strong className="tabular-nums">{review.pacing.averageWords.toLocaleString()}</strong> words.
                    </p>
                    {review.pacing.outliers.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {review.pacing.outliers.map(o => (
                          <li key={o.number} className="text-[12px] text-amber-200/80 flex gap-2">
                            <span className="text-amber-500">·</span>
                            Ch.{o.number} is {o.words.toLocaleString()} words — well off the average.
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {review.voice && (
                    <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3.5">
                      <h4 className="text-[11px] uppercase tracking-wider text-slate-500 font-mono mb-1.5">Voice</h4>
                      <p className="text-[12.5px] text-slate-300 leading-relaxed">{review.voice}</p>
                    </div>
                  )}

                  {review.whereYouLeftOff && (
                    <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3.5">
                      <h4 className="text-[11px] uppercase tracking-wider text-slate-500 font-mono mb-1.5">
                        Where you left off
                      </h4>
                      <p className="text-[12.5px] text-slate-300 leading-relaxed">
                        {review.whereYouLeftOff.note}
                      </p>
                      <button
                        onClick={() => {
                          const target = grouped.chapters.find((c: any) => c.number === review.whereYouLeftOff!.chapter);
                          if (target) setSelectedChapter(target);
                        }}
                        className="mt-2 text-[12px] text-indigo-300 hover:text-indigo-200 transition">
                        Go to chapter {review.whereYouLeftOff.chapter} →
                      </button>
                    </div>
                  )}
                </>
              )}
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2 min-h-0">
              <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3">
                <p className="text-[12px] text-slate-400 leading-relaxed">
                  Select any passage for <strong className="text-slate-200">Tighten</strong>,{' '}
                  <strong className="text-slate-200">Expand</strong>,{' '}
                  <strong className="text-slate-200">Make concrete</strong> or{' '}
                  <strong className="text-slate-200">In my voice</strong>. Press{' '}
                  <code className="px-1 py-0.5 bg-slate-800 rounded text-[11px] font-mono">/</code>{' '}
                  on an empty line to keep writing.
                </p>
              </div>

              {showDraft ? (
                <DraftWithAi
                  bookId={bookId}
                  hasWriting={hasWriting}
                  onClose={() => setShowDraft(false)}
                  onDone={() => { setShowDraft(false); fetchData(); }}
                />
              ) : (
                <button onClick={() => setShowDraft(true)}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[13px] text-slate-300 bg-slate-900/60
                             border border-slate-700/60 rounded-xl hover:border-indigo-500 hover:text-indigo-300
                             transition text-left">
                  <Sparkles size={15} /> Draft the whole book with AI
                  <span className="ml-auto text-[11px] text-slate-500">$5</span>
                </button>
              )}

              {showNotes && selectedChapter ? (
                <WriteFromNotes
                  bookId={bookId}
                  chapterId={selectedChapter.id}
                  chapterTitle={selectedChapter.title}
                  hasContent={wordsIn(selectedChapter.content) > 0}
                  onClose={() => setShowNotes(false)}
                  onDone={() => { setShowNotes(false); fetchData(); }}
                />
              ) : (
                <button onClick={() => setShowNotes(true)} disabled={!selectedChapter}
                  className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[13px] text-slate-300 bg-slate-900/60
                             border border-slate-700/60 rounded-xl hover:border-indigo-500 hover:text-indigo-300
                             transition text-left disabled:opacity-50">
                  <FileText size={15} /> Write from my notes
                  <span className="ml-auto text-[11px] text-slate-500">included</span>
                </button>
              )}

              <Link href="/dashboard/import"
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[13px] text-slate-300 bg-slate-900/60
                           border border-slate-700/60 rounded-xl hover:border-indigo-500 hover:text-indigo-300
                           transition text-left">
                <Upload size={15} /> Import a manuscript
                <span className="ml-auto text-[11px] text-slate-500">free</span>
              </Link>

              <button onClick={runShape} disabled={shapeBusy}
                className="flex items-center gap-2.5 w-full px-3 py-2.5 text-[13px] text-slate-300 bg-slate-900/60
                           border border-slate-700/60 rounded-xl hover:border-indigo-500 hover:text-indigo-300
                           transition disabled:opacity-50 text-left">
                {shapeBusy ? <Loader2 size={15} className="animate-spin" /> : <Map size={15} />}
                {shapeBusy ? 'Reading your book…' : 'Show me the shape of this book'}
              </button>

              {shapeError && (
                <div className="flex gap-2 px-3 py-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-[12px] text-red-300">
                  <AlertCircle size={14} className="shrink-0 mt-0.5" />
                  {shapeError}
                </div>
              )}

              {shape && (
                <div className="bg-slate-900/60 border border-slate-700/60 rounded-xl p-3.5 space-y-3">
                  <div>
                    <h4 className="text-[11px] uppercase tracking-wider text-slate-500 font-mono mb-1.5">What this is</h4>
                    <p className="text-[12.5px] text-slate-300 leading-relaxed">{shape.summary}</p>
                  </div>

                  {shape.gaps?.length > 0 && (
                    <div>
                      <h4 className="text-[11px] uppercase tracking-wider text-slate-500 font-mono mb-1.5">Gaps</h4>
                      <ul className="space-y-1.5">
                        {shape.gaps.map((g, i) => (
                          <li key={i} className="text-[12.5px] text-amber-200/90 leading-relaxed flex gap-2">
                            <span className="text-amber-500 shrink-0">·</span>{g}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {shape.suggestedNext && (
                    <div className="pt-2 border-t border-slate-700/60">
                      <h4 className="text-[11px] uppercase tracking-wider text-slate-500 font-mono mb-1.5">Suggested next</h4>
                      <p className="text-[13px] text-indigo-300 font-semibold">{shape.suggestedNext.title}</p>
                      <p className="text-[12px] text-slate-400 mt-1 leading-relaxed">{shape.suggestedNext.why}</p>
                    </div>
                  )}
                </div>
              )}
                </div>
              )}

              <div className="border-t border-slate-700/60 px-4 py-2.5 shrink-0">
                <p className="text-[10px] text-slate-500 leading-relaxed">
                  Writing assistance is included with this book. Images and video cost credits.
                </p>
              </div>
            </div>

            {/* A rail rather than a row of tabs — this scales past six, a row does not. */}
            <nav className="w-12 shrink-0 bg-slate-900 border-l border-slate-700 flex flex-col items-center py-3 gap-1">
              {TABS.map(t => {
                const Icon = t.icon;
                const on = tab === t.id;
                return (
                  <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    title={`${t.label} — ${t.hint}`}
                    aria-label={t.label}
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition ${
                      on ? 'bg-indigo-500/20 text-indigo-300'
                         : 'text-slate-500 hover:text-slate-200 hover:bg-slate-800'}`}
                  >
                    <Icon size={17} />
                  </button>
                );
              })}
            </nav>
          </div>
        )}
      </div>
    </div>
  );
}
