'use client';
import AppNav from '@/components/AppNav';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { BookOpen, ArrowLeft, ArrowRight, Sparkles, PenSquare, Upload, Check, Loader, Wallet, AlertCircle } from 'lucide-react';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

const GENRES = ['Fantasy','Sci-Fi','Romance','Thriller','Self-Help','Business','Mystery','Horror','Biography','Literary Fiction','History','Science','Philosophy','Psychology','Education','Technology','Health','Travel','Cooking','Poetry'];
const TONES = ['Academic & Formal','Conversational','Inspirational','Dramatic','Humorous','Dark & Gritty','Engaging & Accessible','Technical','Narrative','Poetic'];
const AUDIENCES = ['General readers','Young Adults','Children','Academics','Professionals','Entrepreneurs','Students','Researchers'];

type CreationMode = 'ai' | 'self' | 'import' | null;

export default function NewBookPage() {
  const router = useRouter();
  const [mode, setMode] = useState<CreationMode>(null);
  const [creditCheck, setCreditCheck] = useState<{ canCreate: boolean; balance: number; cost: number } | null>(null);
  const [checkingCredits, setCheckingCredits] = useState(true);

  useEffect(() => {
    checkCredits();
  }, []);

  const checkCredits = async () => {
    try {
      const token = await getFreshToken();
      if (!token) { router.push('/auth/login'); return; }
      const res = await fetch(`${API_URL}/api/books/can-create-ai-book`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) setCreditCheck(await res.json());
    } catch (e) {}
    setCheckingCredits(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <AppNav />

      {!mode && <ModeSelector onSelect={setMode} creditCheck={creditCheck} checkingCredits={checkingCredits} />}
      {mode === 'ai' && <AIAuthorFlow onBack={() => setMode(null)} router={router} />}
      {mode === 'self' && <SelfAuthorFlow onBack={() => setMode(null)} router={router} />}
      {mode === 'import' && <ImportFlow onBack={() => setMode(null)} router={router} />}
    </div>
  );
}

// ============ MODE SELECTOR ============
function ModeSelector({
  onSelect,
  creditCheck,
  checkingCredits,
}: {
  onSelect: (mode: CreationMode) => void;
  creditCheck: { canCreate: boolean; balance: number; cost: number } | null;
  checkingCredits: boolean;
}) {
  return (
    <div className="max-w-5xl mx-auto px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold mb-4">How would you like to create your book?</h1>
        <p className="text-slate-400 text-lg">Choose the method that works best for you</p>
      </div>

      {/* Credit balance banner for AI mode */}
      {!checkingCredits && creditCheck && (
        <div className={`flex items-center justify-between gap-4 rounded-xl border p-4 mb-8 ${
          creditCheck.canCreate
            ? 'bg-emerald-900/20 border-emerald-700'
            : 'bg-red-900/20 border-red-700'
        }`}>
          <div className="flex items-center gap-3">
            {creditCheck.canCreate
              ? <Wallet className="text-emerald-400" size={22} />
              : <AlertCircle className="text-red-400" size={22} />
            }
            <div>
              <p className={`font-semibold ${creditCheck.canCreate ? 'text-emerald-400' : 'text-red-400'}`}>
                {creditCheck.canCreate
                  ? `You have $${creditCheck.balance.toFixed(2)} credits — AI book generation costs $${creditCheck.cost}`
                  : `Insufficient credits — AI book generation costs $${creditCheck.cost}, you have $${creditCheck.balance.toFixed(2)}`
                }
              </p>
              {!creditCheck.canCreate && (
                <p className="text-slate-400 text-sm">Top up your credits to use AI Author mode</p>
              )}
            </div>
          </div>
          <Link
            href="/account/topup"
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap"
          >
            {creditCheck.canCreate ? 'Add More' : 'Top Up Now'}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          {
            mode: 'ai' as CreationMode,
            icon: <Sparkles size={40} className="text-purple-400" />,
            title: '🤖 AI Author',
            subtitle: 'Write with Artificial Intelligence',
            description: 'Let Claude AI write your complete book from scratch. Choose your topic, genre, and style — AI handles the rest.',
            features: ['AI-generated titles & outlines', 'Chapter-by-chapter writing', 'Professional formatting', 'Best for: Quick books, research, non-fiction'],
            color: 'border-purple-700 hover:border-purple-500 bg-purple-900/10',
            btnColor: creditCheck?.canCreate === false ? 'bg-slate-600 cursor-not-allowed' : 'bg-purple-600 hover:bg-purple-500',
            disabled: creditCheck?.canCreate === false,
            badge: `$${creditCheck?.cost ?? 5} credits`,
          },
          {
            mode: 'self' as CreationMode,
            icon: <PenSquare size={40} className="text-blue-400" />,
            title: '✍️ Self Author',
            subtitle: 'Write it yourself',
            description: 'Use our professional rich-text editor to write your book with full creative control. Optional AI assistance per chapter.',
            features: ['Professional book editor', 'Real-time collaboration', 'Optional AI assistance', 'Best for: Experienced writers'],
            color: 'border-blue-700 hover:border-blue-500 bg-blue-900/10',
            btnColor: 'bg-blue-600 hover:bg-blue-500',
            disabled: false,
            badge: 'Free',
          },
          {
            mode: 'import' as CreationMode,
            icon: <Upload size={40} className="text-green-400" />,
            title: '📤 Import Book',
            subtitle: 'Upload your existing manuscript',
            description: 'Already written your book? Upload your manuscript (.docx, .txt, .pdf) and publish it directly to our marketplace.',
            features: ['Upload .docx, .txt, .pdf', 'Auto-detect chapters', 'Edit after import', 'Best for: Existing manuscripts'],
            color: 'border-green-700 hover:border-green-500 bg-green-900/10',
            btnColor: 'bg-green-600 hover:bg-green-500',
            disabled: false,
            badge: 'Free',
          },
        ].map(option => (
          <div
            key={option.mode}
            className={`border-2 rounded-2xl p-6 transition ${option.disabled ? 'opacity-60' : 'cursor-pointer'} ${option.color}`}
            onClick={() => !option.disabled && onSelect(option.mode)}
          >
            <div className="flex justify-center mb-4">{option.icon}</div>
            <div className="flex items-center justify-center gap-2 mb-1">
              <h2 className="text-xl font-bold text-center">{option.title}</h2>
              <span className={`text-xs px-2 py-0.5 rounded-full ${
                option.badge === 'Free' ? 'bg-green-900/50 text-green-400' : 'bg-purple-900/50 text-purple-400'
              }`}>{option.badge}</span>
            </div>
            <p className="text-slate-400 text-sm text-center mb-4">{option.subtitle}</p>
            <p className="text-slate-300 text-sm mb-5 leading-relaxed">{option.description}</p>
            <ul className="space-y-2 mb-6">
              {option.features.map((f, i) => (
                <li key={i} className="flex items-start gap-2 text-xs text-slate-400">
                  <Check size={12} className="text-green-400 mt-0.5 flex-shrink-0" /> {f}
                </li>
              ))}
            </ul>
            <button
              disabled={option.disabled}
              className={`w-full py-3 rounded-xl font-bold text-white transition ${option.btnColor}`}
            >
              {option.disabled ? '⚠️ Insufficient Credits' : 'Get Started →'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ============ AI AUTHOR FLOW ============
function AIAuthorFlow({ onBack, router }: { onBack: () => void; router: any }) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Step 1 data
  const [topic, setTopic] = useState('');
  const [description, setDescription] = useState('');
  const [genre, setGenre] = useState('Self-Help');
  const [tone, setTone] = useState('Engaging & Accessible');
  const [audience, setAudience] = useState('General readers');
  const [chaptersCount, setChaptersCount] = useState(5);
  const [language, setLanguage] = useState('English');

  // Step 2 data
  const [titleOptions, setTitleOptions] = useState<any[]>([]);
  const [selectedTitle, setSelectedTitle] = useState('');
  const [customTitle, setCustomTitle] = useState('');

  // Step 3 data
  const [outlineOptions, setOutlineOptions] = useState<any[]>([]);
  const [selectedOutline, setSelectedOutline] = useState(0);

  // Step 4 data
  const [synopsisOptions, setSynopsisOptions] = useState<string[]>([]);
  const [selectedSynopsis, setSelectedSynopsis] = useState(0);

  // Step 5 data
  const [bookId, setBookId] = useState('');
  const [generatingChapter, setGeneratingChapter] = useState(0);
  const [completedChapters, setCompletedChapters] = useState<number[]>([]);

  const generateTitles = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/books/generate-titles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ topic, description, genre, tone }),
      });
      if (!res.ok) throw new Error('Failed to generate titles');
      const data = await res.json();
      setTitleOptions(data.titles);
      setSelectedTitle(data.titles[0]?.title || '');
      setStep(2);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const generateOutlines = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getFreshToken();
      const finalTitle = customTitle || selectedTitle;
      const res = await fetch(`${API_URL}/api/books/generate-outlines`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ topic, description, genre, tone, audience, title: finalTitle, chaptersCount }),
      });
      if (!res.ok) throw new Error('Failed to generate outlines');
      const data = await res.json();
      setOutlineOptions(data.outlines);
      setStep(3);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const generateSynopsis = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getFreshToken();
      const finalTitle = customTitle || selectedTitle;
      const outline = outlineOptions[selectedOutline];
      const res = await fetch(`${API_URL}/api/books/generate-synopsis`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ topic, title: finalTitle, genre, tone, audience, outline }),
      });
      if (!res.ok) throw new Error('Failed to generate synopsis');
      const data = await res.json();
      setSynopsisOptions(data.synopses);
      setStep(4);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const createBookAndGenerate = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getFreshToken();
      const finalTitle = customTitle || selectedTitle;
      const outline = outlineOptions[selectedOutline];
      const synopsis = synopsisOptions[selectedSynopsis];

      const res = await fetch(`${API_URL}/api/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          topic, genre, tone, audience, chaptersCount, language,
          title: finalTitle, synopsis, outline,
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create book');
      }
      const book = await res.json();
      setBookId(book.id);
      setStep(5);
      setLoading(false);
      await autoGenerateChapters(book.id, book.chapters);
    } catch (err: any) { setError(err.message); setLoading(false); }
  };

  const autoGenerateChapters = async (bId: string, chapters: any[]) => {
    const token = await getFreshToken();
    for (let i = 0; i < chapters.length; i++) {
      setGeneratingChapter(i + 1);
      try {
        await fetch(`${API_URL}/api/books/${bId}/chapters/${chapters[i].id}/generate`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
        setCompletedChapters(prev => [...prev, i + 1]);
      } catch (e) {}
    }
    router.push(`/dashboard/books/${bId}`);
  };

  const steps = ['Book Info', 'Choose Title', 'Choose Outline', 'Synopsis', 'Generating'];

  return (
    <div className="max-w-4xl mx-auto px-8 py-10">
      {/* Progress Steps */}
      <div className="flex items-center justify-center mb-10 overflow-x-auto">
        {steps.map((s, i) => (
          <div key={i} className="flex items-center">
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-semibold whitespace-nowrap ${
              step === i + 1 ? 'bg-purple-600 text-white' :
              step > i + 1 ? 'bg-green-600 text-white' :
              'bg-slate-700 text-slate-400'
            }`}>
              {step > i + 1 ? <Check size={14} /> : <span>{i + 1}</span>}
              {s}
            </div>
            {i < steps.length - 1 && <div className="w-8 h-px bg-slate-700 mx-1" />}
          </div>
        ))}
      </div>

      {/* Credit charge notice */}
      {step === 4 && (
        <div className="flex items-center gap-3 bg-purple-900/20 border border-purple-700 rounded-xl p-4 mb-6">
          <Wallet className="text-purple-400 shrink-0" size={20} />
          <p className="text-purple-300 text-sm">
            <strong>$5.00 credits</strong> will be deducted from your balance when you click "Start Writing My Book"
          </p>
        </div>
      )}

      {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-6 text-sm">{error}</div>}

      {/* Step 1: Book Info */}
      {step === 1 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-6">📝 Tell us about your book</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Book Topic *</label>
              <input value={topic} onChange={e => setTopic(e.target.value)}
                placeholder="e.g. The psychology of productivity and deep work"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Overall Description (optional)</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="Describe what you want this book to cover, key points, your angle..."
                rows={3}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Genre</label>
                <select value={genre} onChange={e => setGenre(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                  {GENRES.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Writing Tone</label>
                <select value={tone} onChange={e => setTone(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                  {TONES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Target Audience</label>
                <select value={audience} onChange={e => setAudience(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                  {AUDIENCES.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500">
                  {['English','Spanish','French','German','Portuguese','Arabic','Hindi','Chinese','Japanese'].map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Number of Chapters: <span className="text-purple-400 font-bold">{chaptersCount}</span></label>
              <input type="range" min={1} max={30} value={chaptersCount} onChange={e => setChaptersCount(Number(e.target.value))}
                className="w-full accent-purple-500" />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1 chapter</span><span>15 chapters</span><span>30 chapters</span>
              </div>
            </div>
            <button onClick={generateTitles} disabled={!topic.trim() || loading}
              className="w-full py-4 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl font-bold text-lg transition flex items-center justify-center gap-2">
              {loading ? <><Loader className="animate-spin" size={20} /> Generating titles...</> : <>Generate Title Options <ArrowRight size={20} /></>}
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Choose Title */}
      {step === 2 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-2">🎯 Choose Your Book Title</h2>
          <p className="text-slate-400 mb-6">Select one of these AI-generated titles or write your own</p>
          <div className="space-y-3 mb-6">
            {titleOptions.map((t: any, i) => (
              <div key={i} onClick={() => { setSelectedTitle(t.title); setCustomTitle(''); }}
                className={`p-4 rounded-xl border-2 cursor-pointer transition ${
                  selectedTitle === t.title && !customTitle ? 'border-purple-500 bg-purple-900/20' : 'border-slate-600 hover:border-purple-500'
                }`}>
                <div className="font-bold text-lg">{t.title}</div>
                {t.subtitle && <div className="text-slate-400 text-sm mt-1">{t.subtitle}</div>}
                {t.reason && <div className="text-slate-500 text-xs mt-2 italic">{t.reason}</div>}
              </div>
            ))}
          </div>
          <div className="mb-6">
            <label className="block text-sm text-slate-400 mb-2">Or write your own title:</label>
            <input value={customTitle} onChange={e => { setCustomTitle(e.target.value); setSelectedTitle(''); }}
              placeholder="Your custom title..."
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-purple-500" />
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-6 py-3 border border-slate-600 rounded-xl text-slate-400 hover:text-white transition">← Back</button>
            <button onClick={generateOutlines} disabled={(!selectedTitle && !customTitle) || loading}
              className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl font-bold transition flex items-center justify-center gap-2">
              {loading ? <><Loader className="animate-spin" size={18} /> Generating outlines...</> : <>Generate Outlines <ArrowRight size={18} /></>}
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Choose Outline */}
      {step === 3 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-2">📋 Choose Your Book Outline</h2>
          <p className="text-slate-400 mb-6">Select the structure that best fits your vision</p>
          <div className="space-y-4 mb-6">
            {outlineOptions.map((outline: any, i) => (
              <div key={i} onClick={() => setSelectedOutline(i)}
                className={`p-5 rounded-xl border-2 cursor-pointer transition ${
                  selectedOutline === i ? 'border-purple-500 bg-purple-900/20' : 'border-slate-600 hover:border-purple-500'
                }`}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ${selectedOutline === i ? 'border-purple-500 bg-purple-500' : 'border-slate-500'}`}>
                    {selectedOutline === i && <Check size={12} />}
                  </div>
                  <span className="font-bold">Outline {i + 1}: {outline.approach}</span>
                </div>
                <div className="space-y-2 ml-8">
                  {outline.chapters?.map((ch: any, j: number) => (
                    <div key={j} className="text-sm">
                      <div className="text-white font-medium">Chapter {j + 1}: {ch.title}</div>
                      {ch.sections && ch.sections.length > 0 && (
                        <div className="ml-4 mt-1 space-y-0.5">
                          {ch.sections.map((s: string, k: number) => (
                            <div key={k} className="text-slate-400 text-xs">• {s}</div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(2)} className="px-6 py-3 border border-slate-600 rounded-xl text-slate-400 hover:text-white transition">← Back</button>
            <button onClick={generateSynopsis} disabled={loading}
              className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl font-bold transition flex items-center justify-center gap-2">
              {loading ? <><Loader className="animate-spin" size={18} /> Generating synopsis...</> : <>Generate Synopsis <ArrowRight size={18} /></>}
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Synopsis */}
      {step === 4 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-2">📖 Choose Your Synopsis</h2>
          <p className="text-slate-400 mb-6">This will appear on your book's public page to attract readers</p>
          <div className="space-y-4 mb-6">
            {synopsisOptions.map((synopsis: string, i) => (
              <div key={i} onClick={() => setSelectedSynopsis(i)}
                className={`p-5 rounded-xl border-2 cursor-pointer transition ${
                  selectedSynopsis === i ? 'border-purple-500 bg-purple-900/20' : 'border-slate-600 hover:border-purple-500'
                }`}>
                <div className="flex items-start gap-3">
                  <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5 ${selectedSynopsis === i ? 'border-purple-500 bg-purple-500' : 'border-slate-500'}`}>
                    {selectedSynopsis === i && <Check size={12} />}
                  </div>
                  <p className="text-slate-300 text-sm leading-relaxed">{synopsis}</p>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(3)} className="px-6 py-3 border border-slate-600 rounded-xl text-slate-400 hover:text-white transition">← Back</button>
            <button onClick={createBookAndGenerate} disabled={loading}
              className="flex-1 py-3 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-xl font-bold transition flex items-center justify-center gap-2">
              {loading ? <><Loader className="animate-spin" size={18} /> Creating book & charging $5...</> : <>🚀 Start Writing My Book — $5.00</>}
            </button>
          </div>
        </div>
      )}

      {/* Step 5: Auto-generating */}
      {step === 5 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8 text-center">
          <div className="text-6xl mb-6">✍️</div>
          <h2 className="text-2xl font-bold mb-2">AI is writing your book...</h2>
          <p className="text-slate-400 mb-2">Sit back and relax. Your chapters are being written one by one.</p>
          <p className="text-emerald-400 text-sm mb-8">✓ $5.00 credits charged successfully</p>
          <div className="max-w-md mx-auto space-y-3 mb-8">
            {Array.from({ length: chaptersCount }, (_, i) => (
              <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${
                completedChapters.includes(i + 1) ? 'border-green-700 bg-green-900/20' :
                generatingChapter === i + 1 ? 'border-purple-700 bg-purple-900/20' :
                'border-slate-700 bg-slate-800'
              }`}>
                <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                  completedChapters.includes(i + 1) ? 'bg-green-600' :
                  generatingChapter === i + 1 ? 'bg-purple-600' : 'bg-slate-700'
                }`}>
                  {completedChapters.includes(i + 1) ? <Check size={16} /> :
                   generatingChapter === i + 1 ? <Loader className="animate-spin" size={16} /> :
                   <span className="text-xs">{i + 1}</span>}
                </div>
                <span className={`text-sm ${
                  completedChapters.includes(i + 1) ? 'text-green-400' :
                  generatingChapter === i + 1 ? 'text-purple-300' : 'text-slate-500'
                }`}>
                  {completedChapters.includes(i + 1) ? '✓ ' : generatingChapter === i + 1 ? '⟳ Writing ' : ''}
                  Chapter {i + 1}
                  {completedChapters.includes(i + 1) ? ' — Complete' :
                   generatingChapter === i + 1 ? '...' : ' — Waiting'}
                </span>
              </div>
            ))}
          </div>
          <div className="w-full bg-slate-700 rounded-full h-3 mb-4">
            <div className="bg-purple-600 h-3 rounded-full transition-all duration-500"
              style={{ width: `${(completedChapters.length / chaptersCount) * 100}%` }} />
          </div>
          <p className="text-slate-400 text-sm">{completedChapters.length} of {chaptersCount} chapters complete</p>
        </div>
      )}
    </div>
  );
}

// ============ SELF AUTHOR FLOW ============
function SelfAuthorFlow({ onBack, router }: { onBack: () => void; router: any }) {
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [genre, setGenre] = useState('Self-Help');
  const [tone, setTone] = useState('Engaging & Accessible');
  const [audience, setAudience] = useState('General readers');
  const [language, setLanguage] = useState('English');
  const [chaptersCount, setChaptersCount] = useState(5);
  const [chapterTitles, setChapterTitles] = useState<string[]>(Array(5).fill(''));
  const [synopsis, setSynopsis] = useState('');
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const updateChapterTitle = (index: number, value: string) => {
    const updated = [...chapterTitles];
    updated[index] = value;
    setChapterTitles(updated);
  };

  const handleChaptersCount = (count: number) => {
    setChaptersCount(count);
    const updated = Array(count).fill('').map((_, i) => chapterTitles[i] || '');
    setChapterTitles(updated);
  };

  const createBook = async () => {
    setLoading(true);
    setError('');
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/books`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          topic: title, title, subtitle, genre, tone, audience,
          chaptersCount, language, synopsis,
          chapterTitles: chapterTitles.filter(t => t.trim()),
          mode: 'self',
        }),
      });
      if (!res.ok) throw new Error('Failed to create book');
      const book = await res.json();
      router.push(`/dashboard/books/${book.id}/edit`);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="max-w-3xl mx-auto px-8 py-10">
      <button onClick={onBack} className="flex items-center gap-2 text-slate-400 hover:text-white mb-8 transition">
        <ArrowLeft size={18} /> Choose different method
      </button>

      {step === 1 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-6">✍️ Set Up Your Book</h2>
          <div className="space-y-5">
            <div>
              <label className="block text-sm text-slate-400 mb-2">Book Title *</label>
              <input value={title} onChange={e => setTitle(e.target.value)}
                placeholder="Enter your book title"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Subtitle (optional)</label>
              <input value={subtitle} onChange={e => setSubtitle(e.target.value)}
                placeholder="A compelling subtitle"
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Synopsis</label>
              <textarea value={synopsis} onChange={e => setSynopsis(e.target.value)}
                placeholder="Write a compelling description of your book for readers..."
                rows={4}
                className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500 resize-none" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm text-slate-400 mb-2">Genre</label>
                <select value={genre} onChange={e => setGenre(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500">
                  {GENRES.map(g => <option key={g}>{g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Tone</label>
                <select value={tone} onChange={e => setTone(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500">
                  {TONES.map(t => <option key={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Target Audience</label>
                <select value={audience} onChange={e => setAudience(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500">
                  {AUDIENCES.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-2">Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-blue-500">
                  {['English','Spanish','French','German','Portuguese','Arabic','Hindi','Chinese','Japanese'].map(l => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-2">Number of Chapters: <span className="text-blue-400 font-bold">{chaptersCount}</span></label>
              <input type="range" min={1} max={30} value={chaptersCount} onChange={e => handleChaptersCount(Number(e.target.value))}
                className="w-full accent-blue-500" />
            </div>
            <button onClick={() => setStep(2)} disabled={!title.trim()}
              className="w-full py-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-bold transition">
              Set Chapter Titles →
            </button>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="bg-slate-800 border border-slate-700 rounded-2xl p-8">
          <h2 className="text-2xl font-bold mb-2">📑 Name Your Chapters</h2>
          <p className="text-slate-400 mb-6">Give each chapter a title (you can change these later)</p>
          {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-4 text-sm">{error}</div>}
          <div className="space-y-3 mb-6">
            {Array.from({ length: chaptersCount }, (_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-blue-900/50 flex items-center justify-center text-blue-400 font-bold text-sm flex-shrink-0">
                  {i + 1}
                </div>
                <input value={chapterTitles[i] || ''} onChange={e => updateChapterTitle(i, e.target.value)}
                  placeholder={`Chapter ${i + 1} title...`}
                  className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
            ))}
          </div>
          <div className="flex gap-3">
            <button onClick={() => setStep(1)} className="px-6 py-3 border border-slate-600 rounded-xl text-slate-400 hover:text-white transition">← Back</button>
            <button onClick={createBook} disabled={loading || !title.trim()}
              className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-bold transition flex items-center justify-center gap-2">
              {loading ? <><Loader className="animate-spin" size={18} /> Creating...</> : <>✍️ Start Writing</>}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ============ IMPORT FLOW ============
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