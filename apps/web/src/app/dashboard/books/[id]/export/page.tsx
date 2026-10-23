'use client';
import AppNav from '@/components/AppNav';
export const dynamic = 'force-dynamic';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Download, FileText, BookOpen, File } from 'lucide-react';
import Link from 'next/link';
import { getToken as getFreshToken } from '@/lib/auth';
import { API_URL } from '@/lib/config';
import { exportBookPdf, withPdfDeadline } from '@/lib/pdf-export';



export default function ExportPage() {
  const router = useRouter();
  const params = useParams();
  const bookId = params.id as string;
  const [book, setBook] = useState<any>(null);
  const [exporting, setExporting] = useState('');
  const [error, setError] = useState('');
  const [pdfExporting, setPdfExporting] = useState(false);
  const [pdfStatus, setPdfStatus] = useState('');
  const [pdfWarnings, setPdfWarnings] = useState<string[]>([]);
  const pdfController = useRef<AbortController | null>(null);

  useEffect(() => () => { pdfController.current?.abort(); }, [bookId]);

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

  const exportAsPdf = async () => {
    if (pdfController.current || exporting) return;
    const controller = new AbortController();
    pdfController.current = controller;
    setPdfExporting(true);
    setPdfStatus('Loading your book…');
    setPdfWarnings([]);
    setError('');
    try {
      const token = await withPdfDeadline(() => getFreshToken(), 15000, controller.signal);
      if (!token) throw new Error('Please sign in again before exporting your PDF.');
      const data = await withPdfDeadline(async signal => {
        const res = await fetch(`${API_URL}/api/books/${bookId}`, {
          headers: { Authorization: `Bearer ${token}` }, signal,
        });
        if (res.status === 401) throw new Error('Your session expired. Please sign in again.');
        if (res.status === 403) throw new Error('You do not have permission to export this book.');
        if (!res.ok) throw new Error('The book could not be loaded. Please try again.');
        const book = await res.json();
        if (!book || !Array.isArray(book.chapters)) throw new Error('This book is unavailable or you no longer have access to it.');
        return book;
      }, 15000, controller.signal);
      await exportBookPdf(data, {
        signal: controller.signal,
        onProgress: message => { if (!controller.signal.aborted) setPdfStatus(message); },
        onWarning: message => { if (!controller.signal.aborted) setPdfWarnings(previous => previous.includes(message) ? previous : [...previous, message]); },
      });
    } catch (err: unknown) {
      if (controller.signal.aborted) setPdfStatus('PDF export cancelled.');
      else {
        setPdfStatus('');
        setError(err instanceof Error ? err.message : 'Export as PDF failed. Please try again.');
      }
    } finally {
      pdfController.current = null;
      setPdfExporting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <AppNav />

      <div className="max-w-2xl mx-auto px-8 py-12">
        <div className="text-center mb-10">
          <Download className="mx-auto text-blue-400 mb-4" size={48} />
          <h1 className="text-3xl font-bold mb-2">Export Book</h1>
          <p className="text-slate-400">Download your book in your preferred format</p>
          {book && <p className="text-blue-400 mt-2 font-semibold">"{book.title}"</p>}
        </div>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-6">{error}</div>}

        <div className="space-y-4">
          <button onClick={exportAsTxt} disabled={exporting === 'txt' || pdfExporting}
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

          <button onClick={exportAsHtml} disabled={exporting === 'html' || pdfExporting}
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

          <button onClick={exportAsPdf} disabled={pdfExporting || !!exporting}
            className="w-full flex items-center justify-between p-6 bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl transition disabled:opacity-50">
            <div className="flex items-center gap-4">
              <File className="text-red-400" size={32} />
              <div className="text-left">
                <div className="font-bold text-lg">Export as PDF</div>
                <div className="text-slate-400 text-sm">
                  {pdfExporting ? 'Building your PDF…' : 'PDF with your cover and contents'}
                </div>
              </div>
            </div>
            <Download size={20} className="text-slate-400" />
          </button>
          {pdfStatus && <p role="status" aria-live="polite" className="text-sm text-slate-300">{pdfStatus}</p>}
          {pdfExporting && (
            <button type="button" onClick={() => pdfController.current?.abort()}
              className="text-sm text-slate-300 underline hover:text-white">Cancel PDF export</button>
          )}
          {pdfWarnings.length > 0 && (
            <ul aria-label="PDF export warnings" className="list-disc pl-5 text-sm text-amber-300 space-y-1">
              {pdfWarnings.map(message => <li key={message}>{message}</li>)}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
