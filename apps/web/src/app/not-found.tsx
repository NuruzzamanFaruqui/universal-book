import Link from 'next/link';
import { BookOpen, ArrowLeft } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center px-8">
      <div className="text-center">
        <div className="flex items-center justify-center gap-2 text-2xl font-bold mb-12">
          <BookOpen className="text-blue-400" size={32} />
          <span>Universal Book</span>
        </div>
        <div className="text-8xl font-extrabold text-blue-900 mb-4">404</div>
        <h1 className="text-3xl font-bold mb-4">Page Not Found</h1>
        <p className="text-slate-400 mb-8 max-w-md mx-auto">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/" className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition">
            <ArrowLeft size={18} /> Go Home
          </Link>
          <Link href="/dashboard" className="px-6 py-3 border border-slate-600 hover:border-blue-500 rounded-lg font-semibold transition">
            My Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
