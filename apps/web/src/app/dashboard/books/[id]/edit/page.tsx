'use client';
export const dynamic = 'force-dynamic';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft, BookOpen, Sparkles, Map, Loader2, PanelRightClose, PanelRightOpen, AlertCircle, Upload,
} from 'lucide-react';
import ManuscriptEditor from '@/components/editor/ManuscriptEditor';
import DraftWithAi from '@/components/editor/DraftWithAi';
import { getToken as getFreshToken } from '@/lib/auth';
import { API_URL } from '@/lib/config';
import { describeShape, ShapeReport } from '@/lib/writing-ai';

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
  const [panelOpen, setPanelOpen] = useState(true);

  const [showDraft, setShowDraft] = useState(false);
  const [shape, setShape] = useState<ShapeReport | null>(null);
  const [shapeBusy, setShapeBusy] = useState(false);
  const [shapeError, setShapeError] = useState('');

  useEffect(() => { fetchData(); /* eslint-disable-next-line */ }, [bookId]);

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
        if (data.chapters?.length) setSelectedChapter(data.chapters[0]);
      }
      if (userRes.ok) setUser(await userRes.json());
    } catch (e) { /* keep whatever is on screen */ }
    finally { setLoading(false); }
  };

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
    () => (book?.chapters || []).some((c: any) => wordsIn(c.content) > 0),
    [book],
  );

  const totalWords = useMemo(() => {
    if (!book?.chapters) return 0;
    return book.chapters.reduce((sum: number, c: any) =>
      sum + (c.id === selectedChapter?.id ? liveWords : wordsIn(c.content)), 0);
  }, [book, selectedChapter, liveWords]);

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
        <span className="font-semibold text-[15px] truncate">{book.title || 'Untitled book'}</span>
        {book.genre && (
          <span className="hidden sm:inline text-[11px] px-2 py-0.5 rounded-full border border-slate-600 text-slate-400 shrink-0">
            {book.genre}
          </span>
        )}
        <span className="ml-auto text-xs text-slate-400 tabular-nums shrink-0">
          {totalWords.toLocaleString()} words
        </span>
        <button onClick={() => setPanelOpen(p => !p)}
          className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-700 rounded-lg transition"
          title={panelOpen ? 'Hide assistant' : 'Show assistant'}>
          {panelOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
        </button>
      </header>

      <div className="flex flex-1 min-h-0">

        {/* outline */}
        <aside className="hidden lg:flex w-56 flex-col bg-slate-800 border-r border-slate-700 shrink-0">
          <div className="px-4 pt-3 pb-2 text-[10px] uppercase tracking-widest text-slate-500 font-mono">
            Manuscript
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            {book.chapters?.map((c: any) => {
              const on = c.id === selectedChapter?.id;
              const words = on ? liveWords : wordsIn(c.content);
              return (
                <button key={c.id} onClick={() => setSelectedChapter(c)}
                  className={`flex items-baseline gap-2 w-full text-left px-2.5 py-2 rounded-lg text-[13px] leading-snug transition ${
                    on ? 'bg-slate-700 text-white font-semibold' : 'text-slate-400 hover:text-white hover:bg-slate-700/50'
                  }`}>
                  <span className={`font-mono text-[10px] shrink-0 ${on ? 'text-blue-400' : 'text-slate-600'}`}>
                    {c.number}
                  </span>
                  <span className="truncate flex-1">{c.title || 'Untitled chapter'}</span>
                  <span className="font-mono text-[10px] text-slate-600 shrink-0">
                    {words ? (words > 999 ? `${(words / 1000).toFixed(1)}k` : words) : '—'}
                  </span>
                </button>
              );
            })}
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
              {book.chapters?.length || 0} chapters · books in this genre usually run 35–50k words.
            </p>
          </div>
        </aside>

        {/* the page */}
        <main className="flex-1 min-w-0 flex flex-col">
          {selectedChapter ? (
            <ManuscriptEditor
              key={selectedChapter.id}
              bookId={bookId}
              chapterId={selectedChapter.id}
              initialContent={selectedChapter.content || ''}
              bookTitle={book.title || 'Untitled book'}
              tone={book.tone}
              voiceSample={voiceSample}
              userId={user?.id || ''}
              onSave={handleSave}
              onStats={s => setLiveWords(s.words)}
            />
          ) : (
            <div className="flex-1 flex items-center justify-center text-slate-500 text-sm">
              This book has no chapters yet.
            </div>
          )}
        </main>

        {/* assistant */}
        {panelOpen && (
          <aside className="hidden xl:flex w-80 flex-col bg-slate-800 border-l border-slate-700 shrink-0">
            <div className="px-4 pt-3 pb-2 text-[10px] uppercase tracking-widest text-slate-500 font-mono flex items-center gap-1.5">
              <Sparkles size={11} className="text-indigo-400" /> Assistant
            </div>

            <div className="flex-1 overflow-y-auto px-3 pb-4 space-y-2">
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

            <div className="border-t border-slate-700/60 px-4 py-3">
              <p className="text-[10px] text-slate-500 leading-relaxed">
                Writing assistance is included with this book. Images and video cost credits.
              </p>
            </div>
          </aside>
        )}
      </div>
    </div>
  );
}
