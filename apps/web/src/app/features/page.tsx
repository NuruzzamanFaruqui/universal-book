'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Sparkles, Download, Shield, Globe, RefreshCw, Zap, Users, FileText, Star, BookOpen } from 'lucide-react';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';

const features = [
  {icon:<Sparkles className="text-blue-400" size={32}/>,title:'AI Outline Generator',desc:'Describe your idea and Claude AI instantly creates a professional book structure in seconds.'},
  {icon:<BookOpen className="text-purple-400" size={32}/>,title:'Narrative Consistency',desc:'Claude maintains character voices and tone across the entire manuscript.'},
  {icon:<RefreshCw className="text-green-400" size={32}/>,title:'Chapter Regeneration',desc:'Not happy with a chapter? Regenerate it without losing continuity in the rest.'},
  {icon:<Download className="text-yellow-400" size={32}/>,title:'Multi-Format Export',desc:'Export as TXT, HTML, PDF, or DOCX — ready for publishing anywhere.'},
  {icon:<Globe className="text-cyan-400" size={32}/>,title:'42 Languages',desc:'Write in any of 42 supported languages or translate your completed manuscript.'},
  {icon:<Zap className="text-orange-400" size={32}/>,title:'Fast Generation',desc:'Full book outline in seconds. Complete chapters in under a minute each.'},
  {icon:<Shield className="text-red-400" size={32}/>,title:'Your Content, Always',desc:'Everything you create belongs to you. We never use your manuscripts for AI training.'},
  {icon:<Users className="text-pink-400" size={32}/>,title:'Team Collaboration',desc:'Publisher plan users can invite team members and collaborate in real time.'},
  {icon:<FileText className="text-indigo-400" size={32}/>,title:'127 Genre Modes',desc:'Specialized writing modes for every genre with genre-accurate structures.'},
];

export default function FeaturesPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <MarketingNav />
      <div className="flex-1">
        <div className="text-center px-8 py-20 max-w-4xl mx-auto">
          <h1 className="text-5xl font-extrabold mb-6">Everything you need to <span className="text-blue-400">write a book</span></h1>
          <p className="text-xl text-slate-400 mb-8">Universal Book is a complete AI publishing pipeline — from raw idea to market-ready manuscript.</p>
          <Link href="/auth/register" className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-lg transition inline-block">Start Writing Free</Link>
        </div>
        <div className="max-w-6xl mx-auto px-8 py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((f,i)=>(
              <div key={i} className="bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-2xl p-8 transition">
                <div className="mb-4">{f.icon}</div>
                <h3 className="text-xl font-bold mb-3">{f.title}</h3>
                <p className="text-slate-400 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="text-center py-20 px-8 bg-blue-900/20 border-t border-blue-900">
          <Star className="mx-auto text-yellow-400 mb-4" size={40}/>
          <h2 className="text-4xl font-bold mb-4">Ready to write your book?</h2>
          <p className="text-slate-400 mb-8 max-w-xl mx-auto">Join thousands of authors who've already published with Universal Book.</p>
          <Link href="/auth/register" className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-lg transition inline-block">Get Started Free</Link>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
