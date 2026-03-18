'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Heart, Zap, Globe, Shield } from 'lucide-react';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';

export default function AboutPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <MarketingNav />
      <div className="flex-1">
        <div className="text-center px-8 py-20 max-w-3xl mx-auto">
          <h1 className="text-5xl font-extrabold mb-6">We believe everyone has <span className="text-blue-400">a book inside them</span></h1>
          <p className="text-xl text-slate-400 leading-relaxed">Universal Book was founded in 2024 with a simple mission — remove every barrier between a person and their published book.</p>
        </div>
        <div className="max-w-4xl mx-auto px-8 py-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center bg-slate-800 border border-slate-700 rounded-2xl p-10">
            {[{num:'48,000+',label:'Books Written'},{num:'127',label:'Genre Modes'},{num:'42',label:'Languages'},{num:'4.9★',label:'Average Rating'}].map((stat,i)=>(
              <div key={i}><div className="text-3xl font-extrabold text-blue-400 mb-1">{stat.num}</div><div className="text-slate-400 text-sm">{stat.label}</div></div>
            ))}
          </div>
        </div>
        <div className="max-w-3xl mx-auto px-8 py-16">
          <h2 className="text-3xl font-bold mb-6">Our Story</h2>
          <div className="space-y-4 text-slate-300 leading-relaxed">
            <p>Universal Book started when our founders realized they had spent years meaning to write their book but never getting past the first chapter.</p>
            <p>When large language models became capable enough to write coherent long-form content, we saw an opportunity — not to replace writers, but to become their most powerful creative partner.</p>
            <p>Today, Universal Book has helped over 48,000 people finish books they never thought they could write.</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-8 py-16">
          <h2 className="text-3xl font-bold text-center mb-12">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {[
              {icon:<Heart className="text-red-400" size={28}/>,title:'Writer First',desc:'Every decision we make starts with: does this help writers create better books?'},
              {icon:<Zap className="text-yellow-400" size={28}/>,title:'Speed Without Compromise',desc:'We believe fast and good are not opposites. Our AI writes quickly without sacrificing quality.'},
              {icon:<Globe className="text-blue-400" size={28}/>,title:'Writing for Everyone',desc:'Stories matter in every language. We support 42 languages and counting.'},
              {icon:<Shield className="text-green-400" size={28}/>,title:'Your Words, Your Rights',desc:'Everything you write belongs to you. We will never claim ownership of your work.'},
            ].map((v,i)=>(
              <div key={i} className="bg-slate-800 border border-slate-700 rounded-2xl p-8 flex gap-5">
                <div className="flex-shrink-0">{v.icon}</div>
                <div><h3 className="text-xl font-bold mb-2">{v.title}</h3><p className="text-slate-400">{v.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
        <div className="max-w-4xl mx-auto px-8 py-16">
          <h2 className="text-3xl font-bold text-center mb-12">Meet the Team</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {[{name:'Alex Morgan',role:'CEO & Co-Founder'},{name:'Sarah Chen',role:'CTO & Co-Founder'},{name:'Marcus Webb',role:'Head of AI'},{name:'Amara Osei',role:'Head of Product'}].map((m,i)=>(
              <div key={i} className="text-center">
                <div className="w-20 h-20 rounded-full bg-blue-600 flex items-center justify-center text-2xl font-bold mx-auto mb-3">{m.name[0]}</div>
                <div className="font-bold">{m.name}</div>
                <div className="text-slate-400 text-sm">{m.role}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-center py-16 px-8 bg-blue-900/20 border-t border-blue-900">
          <h2 className="text-3xl font-bold mb-4">Join our growing community</h2>
          <p className="text-slate-400 mb-8">Start writing your book today — free forever.</p>
          <Link href="/auth/register" className="px-8 py-4 bg-blue-600 hover:bg-blue-500 rounded-xl font-bold text-lg transition inline-block">Get Started Free</Link>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
