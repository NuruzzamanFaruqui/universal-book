'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, ArrowRight } from 'lucide-react';
import AppNav from '@/components/AppNav';

const API_URL = "https://api.universal-book.com";

const templates = [
  {
    id: 1, title: 'Self-Help Book', genre: 'Self-Help', tone: 'Inspirational',
    description: 'A structured guide to personal transformation with actionable steps.',
    chapters: 10, icon: '🌱', color: 'green',
    topic: 'Personal development and self-improvement guide with practical exercises',
  },
  {
    id: 2, title: 'Business Book', genre: 'Business', tone: 'Academic & Formal',
    description: 'Professional business insights and strategies for entrepreneurs.',
    chapters: 10, icon: '💼', color: 'blue',
    topic: 'Business strategy and entrepreneurship guide for modern professionals',
  },
  {
    id: 3, title: 'Fantasy Novel', genre: 'Fantasy', tone: 'Dramatic',
    description: 'An epic fantasy adventure with magic, heroes, and mythical worlds.',
    chapters: 15, icon: '🏰', color: 'purple',
    topic: 'Epic fantasy adventure with magic systems, heroes, and ancient prophecies',
  },
  {
    id: 4, title: 'Romance Novel', genre: 'Romance', tone: 'Engaging & Accessible',
    description: 'A heartfelt love story with compelling characters and emotional depth.',
    chapters: 12, icon: '💕', color: 'pink',
    topic: 'Contemporary romance between two unlikely people who fall in love',
  },
  {
    id: 5, title: 'Thriller Novel', genre: 'Thriller', tone: 'Dark & Gritty',
    description: 'A gripping suspense story that keeps readers on the edge of their seats.',
    chapters: 15, icon: '🔪', color: 'red',
    topic: 'Psychological thriller where detective uncovers a dangerous conspiracy',
  },
  {
    id: 6, title: 'Sci-Fi Novel', genre: 'Sci-Fi', tone: 'Engaging & Accessible',
    description: 'A futuristic adventure exploring technology, space, and humanity.',
    chapters: 15, icon: '🚀', color: 'cyan',
    topic: 'Science fiction story about humanity first contact with alien civilization',
  },
  {
    id: 7, title: 'Mystery Novel', genre: 'Mystery', tone: 'Engaging & Accessible',
    description: 'A clever whodunit with twists, clues, and an satisfying resolution.',
    chapters: 12, icon: '🔍', color: 'yellow',
    topic: 'Classic mystery novel where amateur detective solves an impossible crime',
  },
  {
    id: 8, title: 'Biography Template', genre: 'Biography', tone: 'Conversational',
    description: 'Tell your life story or write about an inspiring person.',
    chapters: 10, icon: '👤', color: 'orange',
    topic: 'Biography of an inspiring person who overcame challenges to achieve greatness',
  },
  {
    id: 9, title: 'Children\'s Book', genre: 'Literary Fiction', tone: 'Humorous',
    description: 'A fun, imaginative story for young readers with life lessons.',
    chapters: 5, icon: '🌈', color: 'indigo',
    topic: 'Fun children\'s adventure story with talking animals and important life lessons',
  },
];

const colorMap: any = {
  green: 'bg-green-900/30 border-green-700 text-green-400',
  blue: 'bg-blue-900/30 border-blue-700 text-blue-400',
  purple: 'bg-purple-900/30 border-purple-700 text-purple-400',
  pink: 'bg-pink-900/30 border-pink-700 text-pink-400',
  red: 'bg-red-900/30 border-red-700 text-red-400',
  cyan: 'bg-cyan-900/30 border-cyan-700 text-cyan-400',
  yellow: 'bg-yellow-900/30 border-yellow-700 text-yellow-400',
  orange: 'bg-orange-900/30 border-orange-700 text-orange-400',
  indigo: 'bg-indigo-900/30 border-indigo-700 text-indigo-400',
};

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function TemplatesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState<number | null>(null);
  const [error, setError] = useState('');

  const useTemplate = async (template: any) => {
    setLoading(template.id);
    setError('');
    try {
      const token = await getFreshToken();
      if (!token) { router.push('/auth/login'); return; }
      const res = await fetch(`${API_URL}/api/books`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          topic: template.topic,
          genre: template.genre,
          tone: template.tone,
          audience: 'General readers',
          chaptersCount: template.chapters,
          language: 'English',
        }),
      });
      if (!res.ok) throw new Error('Failed to create book from template');
      const book = await res.json();
      router.push(`/dashboard/books/${book.id}`);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <AppNav />
      <div className="max-w-6xl mx-auto px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2">Book Templates</h1>
            <p className="text-slate-400">Start with a professionally designed template and customize it to your vision.</p>
          </div>
          <Link href="/dashboard/new-book" className="flex items-center gap-2 px-5 py-2 border border-slate-600 hover:border-blue-500 rounded-lg text-sm transition">
            <BookOpen size={16} /> Custom Book
          </Link>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-6">{error}</div>}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {templates.map((template) => (
            <div key={template.id} className={`border rounded-xl p-6 transition hover:scale-102 ${colorMap[template.color]}`}>
              <div className="text-4xl mb-4">{template.icon}</div>
              <h3 className="text-xl font-bold mb-2">{template.title}</h3>
              <p className="text-slate-400 text-sm mb-4 leading-relaxed">{template.description}</p>
              <div className="flex items-center gap-3 mb-6 text-xs">
                <span className="bg-slate-800 px-2 py-1 rounded-full">{template.genre}</span>
                <span className="bg-slate-800 px-2 py-1 rounded-full">{template.chapters} chapters</span>
                <span className="bg-slate-800 px-2 py-1 rounded-full">{template.tone}</span>
              </div>
              <button
                onClick={() => useTemplate(template)}
                disabled={loading === template.id}
                className="w-full flex items-center justify-center gap-2 py-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 rounded-lg text-sm font-semibold transition">
                {loading === template.id ? 'Creating...' : (<>Use Template <ArrowRight size={14} /></>)}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
