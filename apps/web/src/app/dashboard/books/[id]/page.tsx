'use client';
import AppNav from '@/components/AppNav';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Sparkles, Globe, Lock, DollarSign, PenLine, ImageIcon } from 'lucide-react';
import Link from 'next/link';
import { getToken as getFreshToken } from '@/lib/auth';
import { API_URL } from '@/lib/config';
import BookCover from '@/components/covers/BookCover';
import CoverGenerator from '@/components/covers/CoverGenerator';



export default function BookDetailPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = params.id as string;
  const [book, setBook] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [publishing, setPublishing] = useState(false);
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [price, setPrice] = useState(0);
  const [isPublished, setIsPublished] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ub_token');
    if (!token) { router.push('/auth/login'); return; }
    fetchBook();
  }, [bookId]);

  const fetchBook = async () => {
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/books/${bookId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load book');
      const data = await res.json();
      setBook(data);
      setIsPublished(!!data.published?.isPublic);
      if (data.published?.price != null) setPrice(data.published.price);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const generateChapter = async (chapterId: string) => {
    setGenerating(chapterId);
    setError('');
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/books/${bookId}/chapters/${chapterId}/generate`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to generate chapter');
      await fetchBook();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(null);
    }
  };

  const handlePublish = async () => {
    setPublishing(true);
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/marketplace/books/${bookId}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        // The spinner steps by 0.99, which leaves float noise like 2.9699999 that
        // the API rejects ("at most 2 decimals"). Round before sending.
        body: JSON.stringify({ price: Math.round((Number(price) || 0) * 100) / 100 }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        const msg = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
        throw new Error(msg || 'Failed to publish book');
      }
      setIsPublished(true);
      setShowPublishModal(false);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPublishing(false);
    }
  };

  const handleUnpublish = async () => {
    if (!confirm('Unpublish this book from the marketplace?')) return;
    try {
      const token = await getFreshToken();
      await fetch(`${API_URL}/api/marketplace/books/${bookId}/unpublish`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      setIsPublished(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  // Front/back matter (title page, dedication…) lives in the same list but isn't
  // a chapter — it shouldn't get a Generate button or block publishing.
  const KIND_ORDER: Record<string, number> = { FRONT_MATTER: 0, CHAPTER: 1, BACK_MATTER: 2 };
  const chapters = [...(book?.chapters || [])]
    .filter((c: any) => (c.kind ?? 'CHAPTER') === 'CHAPTER')
    .sort((a: any, b: any) => (KIND_ORDER[a.kind] ?? 1) - (KIND_ORDER[b.kind] ?? 1) || a.number - b.number);
  const plain = (html: string) => html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
  const hasText = (c: any) => !!c.content && plain(c.content).length > 0;
  const allChaptersGenerated = chapters.length > 0 && chapters.every(hasText);

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading book...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <AppNav />

      {/* Publish Modal */}
      {showPublishModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 px-4">
          <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 max-w-md w-full">
            <h2 className="text-2xl font-bold mb-2">Publish to Marketplace</h2>
            <p className="text-slate-400 text-sm mb-6">Set a price for your book. Readers will pay to access all chapters. You earn 70% of each sale.</p>
            <div className="mb-6">
              <label className="block text-sm text-slate-400 mb-2">Book Price (USD)</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))}
                  min={0} step={0.99}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:border-blue-500" />
              </div>
              <p className="text-xs text-slate-500 mt-1">Set to 0 for free. Recommended: $2.99 - $9.99</p>
            </div>
            {price > 0 && (
              <div className="bg-slate-700 rounded-lg p-4 mb-6 text-sm">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Book price</span>
                  <span>${price.toFixed(2)}</span>
                </div>
                <div className="flex justify-between mb-1">
                  <span className="text-slate-400">Platform fee (30%)</span>
                  <span className="text-red-400">-${(price * 0.30).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold border-t border-slate-600 pt-1 mt-1">
                  <span>Your earnings</span>
                  <span className="text-green-400">${(price * 0.70).toFixed(2)}</span>
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={handlePublish} disabled={publishing}
                className="flex-1 py-3 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl font-semibold transition">
                {publishing ? 'Publishing...' : '🌍 Publish Now'}
              </button>
              <button onClick={() => setShowPublishModal(false)}
                className="px-6 py-3 border border-slate-600 rounded-xl text-slate-400 hover:text-white transition">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8 sm:py-12">
        {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-6">{error}</div>}

        {book && (
          <>
            <div className="mb-10 flex flex-col sm:flex-row gap-6">
              <a href="#cover" className="w-28 sm:w-36 shrink-0 block rounded-lg overflow-hidden ring-1 ring-white/10 hover:ring-blue-500 transition" title="Design the cover">
                <BookCover url={book.coverUrl} title={book.title} className="w-full" />
              </a>
              <div className="flex-1 min-w-0">
              <div className="mb-2">
                <h1 className={`text-3xl sm:text-4xl font-bold break-words ${book.title ? '' : 'text-slate-500 italic'}`}>{book.title || 'Untitled book'}</h1>
              </div>
              {book.subtitle && <p className="text-slate-400 text-lg mt-1">{book.subtitle}</p>}
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                {book.genre && <span className="text-slate-400 text-sm bg-slate-800 px-3 py-1 rounded-full">{book.genre}</span>}
                {book.tone && <span className="text-slate-400 text-sm bg-slate-800 px-3 py-1 rounded-full">{book.tone}</span>}
                {isPublished && <span className="text-green-400 text-sm bg-green-900/30 px-3 py-1 rounded-full flex items-center gap-1"><Globe size={12} /> Published</span>}
                {!isPublished && <span className="text-slate-500 text-sm bg-slate-800 px-3 py-1 rounded-full flex items-center gap-1"><Lock size={12} /> Draft</span>}
              </div>
              {book.synopsis && <p className="text-slate-300 mt-4 leading-relaxed">{book.synopsis}</p>}
              <div className="flex items-center gap-3 mt-6 flex-wrap">
                <Link href={`/dashboard/books/${bookId}/edit`}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">
                  <PenLine size={16} /> Open editor
                </Link>
                {isPublished ? (
                  <>
                    <Link href={`/books/${bookId}`}
                      className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-semibold transition">
                      <Globe size={16} /> View on marketplace
                    </Link>
                    <button onClick={handleUnpublish}
                      className="px-4 py-2 border border-slate-600 text-slate-300 hover:text-white rounded-lg text-sm transition">
                      Unpublish
                    </button>
                  </>
                ) : (
                  <button onClick={() => setShowPublishModal(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-500 rounded-lg text-sm font-semibold transition">
                    <Globe size={16} /> Publish to marketplace
                  </button>
                )}
              </div>
              </div>
            </div>

            <section id="cover" className="bg-slate-800/50 border border-slate-700 rounded-xl p-4 sm:p-6 mb-10 scroll-mt-24">
              <h2 className="text-xl font-bold mb-1 flex items-center gap-2"><ImageIcon size={20} className="text-blue-400" /> Book cover</h2>
              <p className="text-slate-400 text-sm mb-5">
                Pick a theme and adjust the text. The saved cover appears on your book page and in the marketplace.
              </p>
              <CoverGenerator
                bookId={bookId}
                initialTitle={book.title || ''}
                initialAuthor={book.user?.name || ''}
                initialGenre={book.genre || ''}
                currentCoverUrl={book.coverUrl}
                onCoverChange={(url) => setBook((b: any) => ({ ...b, coverUrl: url }))}
              />
            </section>

            {!allChaptersGenerated && (
              <div className="bg-yellow-900/20 border border-yellow-800 rounded-xl p-4 mb-6 text-sm text-yellow-300">
                ⚠ Generate all chapters before publishing to the marketplace.
              </div>
            )}

            <div className="space-y-4">
              <h2 className="text-2xl font-bold mb-4">Chapters ({chapters.length})</h2>
              {chapters.map((chapter: any) => (
                <div key={chapter.id} className="bg-slate-800/50 border border-slate-700 rounded-xl p-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-lg font-semibold">
                      Chapter {chapter.number}{chapter.title ? `: ${chapter.title}` : ''}
                    </h3>
                    {!hasText(chapter) && (
                      <button onClick={() => generateChapter(chapter.id)} disabled={generating === chapter.id}
                        className="flex items-center gap-1 px-3 py-1 bg-purple-700 hover:bg-purple-600 rounded-lg text-sm transition disabled:opacity-50">
                        <Sparkles size={14} />
                        {generating === chapter.id ? 'Writing...' : 'Generate'}
                      </button>
                    )}
                    {hasText(chapter) && <span className="text-xs text-green-400 bg-green-900/30 px-2 py-0.5 rounded-full">✓ Written</span>}
                  </div>
                  {chapter.summary && <p className="text-slate-500 text-sm mb-2 italic">{chapter.summary}</p>}
                  <p className="text-slate-400 text-sm">
                    {hasText(chapter) ? plain(chapter.content).substring(0, 300) + '…' : 'Empty — write it in the editor, or click Generate to draft it with AI.'}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}