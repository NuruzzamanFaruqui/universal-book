'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Download, FileText, BookOpen, File } from 'lucide-react';
import Link from 'next/link';

const API_URL = "https://universal-book-api-73444175926.us-central1.run.app";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function ExportPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = params.id as string;
  const [book, setBook] = useState<any>(null);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');

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
      setBook(await res.json());
    } catch (err: any) {
      setError(err.message);
    }
  };

  const exportAsTxt = async () => {
    setExporting('txt');
    setError('');
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/books/${bookId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      
      let content = `${data.title}\n`;
      if (data.subtitle) content += `${data.subtitle}\n`;
      content += `\n${data.synopsis || ''}\n\n`;
      content += '='.repeat(50) + '\n\n';
      
      data.chapters?.forEach((ch: any) => {
        content += `Chapter ${ch.number}: ${ch.title}\n`;
        content += '-'.repeat(40) + '\n';
        content += `${ch.content || 'Not generated yet'}\n\n`;
      });

      const blob = new Blob([content], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.title}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Export as TXT failed. Please try again.');
    } finally {
      setExporting('');
    }
  };

  const exportAsHtml = async () => {
    setExporting('html');
    setError('');
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/books/${bookId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();

      let html = `<!DOCTYPE html><html><head>
        <meta charset="UTF-8">
        <title>${data.title}</title>
        <style>
          body { font-family: Georgia, serif; max-width: 800px; margin: 0 auto; padding: 40px; line-height: 1.8; }
          h1 { font-size: 2.5em; margin-bottom: 10px; }
          h2 { font-size: 1.2em; color: #666; font-weight: normal; margin-bottom: 30px; }
          .synopsis { font-style: italic; color: #444; border-left: 3px solid #ccc; padding-left: 20px; margin-bottom: 40px; }
          h3 { font-size: 1.5em; margin-top: 50px; border-bottom: 1px solid #eee; padding-bottom: 10px; }
          p { margin-bottom: 15px; }
        </style>
      </head><body>`;
      html += `<h1>${data.title}</h1>`;
      if (data.subtitle) html += `<h2>${data.subtitle}</h2>`;
      if (data.synopsis) html += `<div class="synopsis"><p>${data.synopsis}</p></div>`;
      data.chapters?.forEach((ch: any) => {
        html += `<h3>Chapter ${ch.number}: ${ch.title}</h3>`;
        const paragraphs = (ch.content || 'Not generated yet').split('\n').filter((p: string) => p.trim());
        paragraphs.forEach((p: string) => { html += `<p>${p}</p>`; });
      });
      html += '</body></html>';

      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${data.title}.html`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError('Export as HTML failed. Please try again.');
    } finally {
      setExporting('');
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <nav className="flex items-center px-8 py-4 border-b border-slate-700">
        <Link href={`/dashboard/books/${bookId}`} className="flex items-center gap-2 text-slate-400 hover:text-white">
          <ArrowLeft size={18} /> Back to Book
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-8 py-12">
        <div className="text-center mb-10">
          <Download className="mx-auto text-blue-400 mb-4" size={48} />
          <h1 className="text-3xl font-bold mb-2">Export Book</h1>
          <p className="text-slate-400">Download your book in your preferred format</p>
          {book && <p className="text-blue-400 mt-2 font-semibold">"{book.title}"</p>}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-6">{error}</div>}

        <div className="space-y-4">
          <button onClick={exportAsTxt} disabled={exporting === 'txt'}
            className="w-full flex items-center justify-between p-6 bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl transition disabled:opacity-50">
            <div className="flex items-center gap-4">
              <FileText className="text-green-400" size={32} />
              <div className="text-left">
                <div className="font-bold text-lg">Export as TXT</div>
                <div className="text-slate-400 text-sm">Plain text, works everywhere</div>
              </div>
            </div>
            <Download size={20} className="text-slate-400" />
          </button>

          <button onClick={exportAsHtml} disabled={exporting === 'html'}
            className="w-full flex items-center justify-between p-6 bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl transition disabled:opacity-50">
            <div className="flex items-center gap-4">
              <BookOpen className="text-blue-400" size={32} />
              <div className="text-left">
                <div className="font-bold text-lg">Export as HTML</div>
                <div className="text-slate-400 text-sm">Beautiful formatted web page</div>
              </div>
            </div>
            <Download size={20} className="text-slate-400" />
          </button>

          <div className="w-full flex items-center justify-between p-6 bg-slate-800/50 border border-slate-700 rounded-xl opacity-50">
            <div className="flex items-center gap-4">
              <File className="text-red-400" size={32} />
              <div className="text-left">
                <div className="font-bold text-lg">Export as PDF</div>
                <div className="text-slate-400 text-sm">Coming soon</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
