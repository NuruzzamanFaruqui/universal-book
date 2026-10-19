'use client';

import { useEffect, useRef, useState } from 'react';
import { Download, ImageIcon, Loader2, Trash2, Check } from 'lucide-react';
import { COVER_THEMES, CoverThemeId, DEFAULT_THEME, getTheme } from '@/lib/covers/themes';
import { canvasToPng, drawCover } from '@/lib/covers/render';
import { CoversApi } from '@/lib/covers/api';

interface CoverGeneratorProps {
  bookId: string;
  initialTitle: string;
  initialAuthor: string;
  initialGenre: string;
  /** The book's current coverUrl, if any. */
  currentCoverUrl?: string | null;
  /** Called after the book's coverUrl changes (new URL, or null when removed). */
  onCoverChange?: (url: string | null) => void;
}

/**
 * Canvas-based cover designer for the dashboard book page.
 *
 * Every input change redraws the same <canvas> the user sees, and Download and
 * Save both export that canvas — so what is previewed is exactly what is saved.
 */
export default function CoverGenerator({
  bookId, initialTitle, initialAuthor, initialGenre, currentCoverUrl, onCoverChange,
}: CoverGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [title, setTitle] = useState(initialTitle);
  const [author, setAuthor] = useState(initialAuthor);
  const [genre, setGenre] = useState(initialGenre);
  const [themeId, setThemeId] = useState<CoverThemeId>(DEFAULT_THEME);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [message, setMessage] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);

  // Redraw on every change. Waiting for fonts means the first frame isn't laid
  // out with a fallback face and then visibly re-wrapped.
  useEffect(() => {
    let cancelled = false;
    const draw = () => {
      if (!cancelled && canvasRef.current) {
        drawCover(canvasRef.current, { title, author, genre }, getTheme(themeId));
      }
    };
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(draw);
    } else {
      draw();
    }
    return () => { cancelled = true; };
  }, [title, author, genre, themeId]);

  const fileName = () =>
    `${(title.trim() || 'cover').replace(/[^\w\- ]+/g, '').trim().replace(/\s+/g, '-').toLowerCase() || 'cover'}.png`;

  const handleDownload = async () => {
    if (!canvasRef.current) return;
    setMessage(null);
    try {
      const blob = await canvasToPng(canvasRef.current);
      const href = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = href;
      a.download = fileName();
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Give Safari a moment to start the download before revoking.
      setTimeout(() => URL.revokeObjectURL(href), 4000);
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message || 'Download failed' });
    }
  };

  const handleSave = async () => {
    if (!canvasRef.current) return;
    setSaving(true);
    setMessage(null);
    try {
      const blob = await canvasToPng(canvasRef.current);
      const url = await CoversApi.upload(bookId, blob);
      await CoversApi.setCoverUrl(bookId, url);
      onCoverChange?.(url);
      setMessage({ kind: 'ok', text: 'Cover saved. It now shows on your book page and in the marketplace.' });
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message || 'Could not save the cover' });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!confirm('Remove this book\'s cover? It will show the default placeholder again.')) return;
    setRemoving(true);
    setMessage(null);
    try {
      await CoversApi.setCoverUrl(bookId, null);
      onCoverChange?.(null);
      setMessage({ kind: 'ok', text: 'Cover removed.' });
    } catch (err: any) {
      setMessage({ kind: 'error', text: err.message || 'Could not remove the cover' });
    } finally {
      setRemoving(false);
    }
  };

  const inputClass =
    'w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-base sm:text-sm focus:outline-none focus:border-blue-500';

  return (
    <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,240px)_1fr] gap-6">
      {/* Live preview — rendered at 800×1200 and scaled down by CSS. */}
      <div className="mx-auto w-full max-w-[240px]">
        <canvas
          ref={canvasRef}
          width={800}
          height={1200}
          aria-label="Cover preview"
          className="w-full h-auto rounded-lg shadow-2xl shadow-black/50 ring-1 ring-white/10"
        />
      </div>

      <div className="space-y-4 min-w-0">
        <div>
          <label className="block text-sm text-slate-400 mb-1" htmlFor="cover-title">Title</label>
          <input id="cover-title" value={title} maxLength={150} onChange={(e) => setTitle(e.target.value)} className={inputClass} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-1" htmlFor="cover-author">Author</label>
            <input id="cover-author" value={author} maxLength={80} onChange={(e) => setAuthor(e.target.value)} className={inputClass} />
          </div>
          <div>
            <label className="block text-sm text-slate-400 mb-1" htmlFor="cover-genre">Genre</label>
            <input id="cover-genre" value={genre} maxLength={40} onChange={(e) => setGenre(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <span className="block text-sm text-slate-400 mb-2">Theme</span>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Cover theme">
            {COVER_THEMES.map((t) => (
              <button
                key={t.id}
                type="button"
                role="radio"
                aria-checked={themeId === t.id}
                onClick={() => setThemeId(t.id)}
                className={`flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-sm transition ${
                  themeId === t.id ? 'border-blue-400 bg-slate-700 text-white' : 'border-slate-600 text-slate-300 hover:border-slate-400'
                }`}
              >
                <span
                  className="w-6 h-6 rounded-full ring-1 ring-white/20"
                  style={{ background: `linear-gradient(135deg, ${t.background.join(', ')})`, boxShadow: `inset 0 -6px 0 ${t.accent}` }}
                />
                {t.name}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 pt-1">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || removing}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-semibold transition flex-1 sm:flex-none"
          >
            {saving ? <Loader2 size={16} className="animate-spin" /> : <ImageIcon size={16} />}
            {saving ? 'Saving…' : 'Save as book cover'}
          </button>
          <button
            type="button"
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition flex-1 sm:flex-none"
          >
            <Download size={16} /> Download PNG
          </button>
          {currentCoverUrl && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={saving || removing}
              className="flex items-center justify-center gap-2 px-4 py-2 border border-slate-600 text-slate-300 hover:text-white disabled:opacity-50 rounded-lg text-sm transition"
            >
              <Trash2 size={16} /> {removing ? 'Removing…' : 'Remove cover'}
            </button>
          )}
        </div>

        {message && (
          <p
            role="status"
            className={`text-sm flex items-start gap-2 ${message.kind === 'ok' ? 'text-green-400' : 'text-red-400'}`}
          >
            {message.kind === 'ok' && <Check size={16} className="mt-0.5 shrink-0" />}
            {message.text}
          </p>
        )}
        <p className="text-xs text-slate-500">
          Changes here only affect the cover image — your book&apos;s actual title and genre stay as they are.
        </p>
      </div>
    </div>
  );
}
