'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, BookOpen, Save } from 'lucide-react';
import CollaborativeEditor from '@/components/CollaborativeEditor';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function EditChapterPage() {
  const params = useParams();
  const router = useRouter();
  const bookId = params.id as string;
  const [book, setBook] = useState<any>(null);
  const [selectedChapter, setSelectedChapter] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ub_token');
    if (!token) { router.push('/auth/login'); return; }
    fetchData();
  }, [bookId]);

  const fetchData = async () => {
    try {
      const token = await getFreshToken();
      const [bookRes, userRes] = await Promise.all([
        fetch(`${API_URL}/api/books/${bookId}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/users/me`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (bookRes.ok) {
        const bookData = await bookRes.json();
        setBook(bookData);
        if (bookData.chapters?.length > 0) setSelectedChapter(bookData.chapters[0]);
      }
      if (userRes.ok) setUser(await userRes.json());
    } catch (e) {}
    finally { setLoading(false); }
  };

  const handleSave = async (content: string) => {
    if (!selectedChapter) return;
    try {
      const token = await getFreshToken();
      await fetch(`${API_URL}/api/books/${bookId}/chapters/${selectedChapter.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ content }),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (e) {}
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading editor...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-slate-700 bg-slate-900">
        <div className="flex items-center gap-4">
          <Link href={`/dashboard/books/${bookId}`} className="flex items-center gap-2 text-slate-400 hover:text-white transition">
            <ArrowLeft size={16} /> Back
          </Link>
          <div className="flex items-center gap-2">
            <BookOpen className="text-blue-400" size={20} />
            <span className="font-semibold">{book?.title}</span>
          </div>
        </div>
        {saved && (
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <Save size={14} /> Saved!
          </div>
        )}
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Chapter List Sidebar */}
        <div className="w-56 bg-slate-800 border-r border-slate-700 flex flex-col overflow-y-auto">
          <div className="p-3 border-b border-slate-700">
            <div className="text-xs text-slate-400 uppercase font-semibold">Chapters</div>
          </div>
          <div className="flex-1 overflow-y-auto">
            {book?.chapters?.map((chapter: any) => (
              <button key={chapter.id} onClick={() => setSelectedChapter(chapter)}
                className={`w-full text-left px-3 py-3 text-sm border-b border-slate-700 transition ${
                  selectedChapter?.id === chapter.id
                    ? 'bg-blue-900/50 text-blue-300 border-l-2 border-l-blue-500'
                    : 'text-slate-400 hover:text-white hover:bg-slate-700'
                }`}>
                <div className="font-medium truncate">Ch. {chapter.number}</div>
                <div className="text-xs truncate opacity-70">{chapter.title}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Editor */}
        <div className="flex-1 flex flex-col overflow-hidden p-4">
          {selectedChapter ? (
            <>
              <div className="mb-3">
                <h2 className="text-lg font-bold">Chapter {selectedChapter.number}: {selectedChapter.title}</h2>
                {selectedChapter.summary && (
                  <p className="text-slate-400 text-sm mt-1">{selectedChapter.summary}</p>
                )}
              </div>
              <div className="flex-1 overflow-hidden">
                <CollaborativeEditor
                  bookId={bookId}
                  chapterId={selectedChapter.id}
                  initialContent={selectedChapter.content || ''}
                  onSave={handleSave}
                  userName={user?.name || 'Writer'}
                  userId={user?.id || ''}
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center flex-1 text-slate-400">
              Select a chapter to start editing
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
