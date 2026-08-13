'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Upload, Loader } from 'lucide-react';
import { getToken as getFreshToken } from '@/lib/auth';
import { API_URL } from '@/lib/config';

const GENRES = ['Fantasy','Sci-Fi','Romance','Thriller','Self-Help','Business','Mystery','Horror','Biography','Literary Fiction','History','Science','Philosophy','Psychology','Education','Technology','Health','Travel','Cooking','Poetry'];
const AUDIENCES = ['General readers','Young Adults','Children','Academics','Professionals','Entrepreneurs','Students','Researchers'];

/**
 * Reached from inside the editor rather than as a step in front of it — an
 * author who already has a manuscript comes here; everyone else just writes.
 */
export default function ImportBookPage() {
  const router = useRouter();
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <Link href="/dashboard"
          className="inline-flex items-center gap-2 text-slate-400 hover:text-white text-sm mb-6 transition">
          <ArrowLeft size={16} /> Back to my books
        </Link>
        <ImportFlow onBack={() => router.push('/dashboard')} router={router} />
      </div>
    </div>
  );
}

function ImportFlow({ onBack, router }: { onBack: () => void; router: any }) {
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('Self-Help');
  const [audience, setAudience] = useState('General readers');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);

  const handleFile = (f: File) => {
    const allowed = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf', 'text/plain'];
    if (!allowed.includes(f.type) && !f.name.endsWith('.txt') && !f.name.endsWith('.docx') && !f.name.endsWith('.pdf')) {
      setError('Please upload a .docx, .pdf, or .txt file');
      return;
    }
    setFile(f);
    if (!title) setTitle(f.name.replace(/\.[^.]+$/, '').replace(/_/g, ' '));
    setError('');
  };

  const handleImport = async () => {
    if (!file || !title.trim()) return;
    setLoading(true);
    setError('');
    try {
      const token = await getFreshToken();
      const text = await file.text();
      const res = await fetch(`${API_URL}/api/books/import`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ title, genre, audience, content: text, fileName: file.name }),
      });
      if (!res.ok) throw new Error('Failed to import book');
      const book = await res.json();
      router.push(`/dashboard/books/${book.id}/edit`);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-2xl mx-auto px-8 py-10">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition">
        <ArrowLeft size={18} /> Choose different method
      </button>
      <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
        <h2 className="text-2xl font-bold mb-2">📤 Import Your Book</h2>
        <p className="text-slate-400 mb-6">Upload your existing manuscript and publish it on Universal Book</p>
        {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-4 text-sm">{error}</div>}

        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
          className={`border-2 border-dashed rounded-xl p-8 text-center mb-6 transition cursor-pointer ${
            dragOver ? 'border-green-500 bg-green-900/20' :
            file ? 'border-green-600 bg-green-900/10' : 'border-slate-600 hover:border-green-500'
          }`}
          onClick={() => document.getElementById('fileInput')?.click()}>
          <input id="fileInput" type="file" accept=".docx,.pdf,.txt" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
          {file ? (
            <div>
              <div className="text-4xl mb-2">📄</div>
              <div className="font-bold text-green-400">{file.name}</div>
              <div className="text-slate-400 text-sm mt-1">{(file.size / 1024).toFixed(1)} KB</div>
              <button onClick={e => { e.stopPropagation(); setFile(null); }} className="mt-2 text-red-400 text-xs hover:text-red-300">Remove</button>
            </div>
          ) : (
            <div>
              <Upload className="mx-auto text-slate-500 mb-3" size={40} />
              <div className="font-semibold mb-1">Drop your file here or click to browse</div>
              <div className="text-slate-400 text-sm">Supports .docx, .pdf, .txt files</div>
            </div>
          )}
        </div>

        <div className="space-y-4 mb-6">
          <div>
            <label className="block text-sm text-slate-400 mb-2">Book Title *</label>
            <input value={title} onChange={e => setTitle(e.target.value)}
              placeholder="Enter your book title"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Genre</label>
              <select value={genre} onChange={e => setGenre(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500">
                {GENRES.map(g => <option key={g}>{g}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Target Audience</label>
              <select value={audience} onChange={e => setAudience(e.target.value)}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-green-500">
                {AUDIENCES.map(a => <option key={a}>{a}</option>)}
              </select>
            </div>
          </div>
        </div>

        <button onClick={handleImport} disabled={!file || !title.trim() || loading}
          className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:opacity-50 rounded-xl font-bold transition flex items-center justify-center gap-2">
          {loading ? <><Loader className="animate-spin" size={18} /> Importing...</> : <>📤 Import & Publish</>}
        </button>
      </div>
    </div>
  );
}
