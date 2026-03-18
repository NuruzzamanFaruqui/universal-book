'use client';
export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { Check, X } from 'lucide-react';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';

const plans = [
  {
    name:'Scribe',price:'0',tagline:'Perfect to get started',featured:false,cta:'Start Free',href:'/auth/register',
    features:[{t:'1 book per month',y:true},{t:'Up to 5 chapters',y:true},{t:'TXT & HTML export',y:true},{t:'10 genre modes',y:true},{t:'Chapter regeneration',y:false},{t:'PDF & DOCX export',y:false},{t:'Priority generation',y:false},{t:'Multi-language',y:false}],
  },
  {
    name:'Author',price:'29',tagline:'For serious writers',featured:true,cta:'Start 7-Day Trial',href:'/auth/register',
    features:[{t:'Unlimited books',y:true},{t:'Up to 30 chapters',y:true},{t:'All export formats',y:true},{t:'All 127 genre modes',y:true},{t:'Unlimited regeneration',y:true},{t:'Priority generation',y:true},{t:'42 languages',y:true},{t:'API access',y:false}],
  },
  {
    name:'Publisher',price:'99',tagline:'For teams & publishers',featured:false,cta:'Contact Sales',href:'/contact',
    features:[{t:'Everything in Author',y:true},{t:'5 team seats',y:true},{t:'API access',y:true},{t:'Custom AI fine-tuning',y:true},{t:'White-label export',y:true},{t:'Dedicated support',y:true},{t:'SLA guarantee',y:true},{t:'Custom integrations',y:true}],
  },
];

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <MarketingNav />
      <div className="flex-1">
        <div className="max-w-6xl mx-auto px-8 py-16">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-extrabold mb-4">Simple, honest pricing</h1>
            <p className="text-xl text-slate-400">No hidden fees. Cancel anytime. Your manuscripts are always yours.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {plans.map((plan)=>(
              <div key={plan.name} className={`relative rounded-2xl p-8 border ${plan.featured?'bg-blue-900/30 border-blue-500 scale-105':'bg-slate-800 border-slate-700'}`}>
                {plan.featured&&<div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">MOST POPULAR</div>}
                <div className="mb-6">
                  <h2 className="text-xl font-bold mb-1">{plan.name}</h2>
                  <p className="text-slate-400 text-sm mb-4">{plan.tagline}</p>
                  <div className="flex items-baseline gap-1">
                    <span className="text-slate-400 text-xl">$</span>
                    <span className="text-5xl font-extrabold">{plan.price}</span>
                    <span className="text-slate-400">/month</span>
                  </div>
                </div>
                <div className="space-y-3 mb-8">
                  {plan.features.map((f,i)=>(
                    <div key={i} className="flex items-center gap-3">
                      {f.y?<Check size={16} className="text-green-400 flex-shrink-0"/>:<X size={16} className="text-slate-600 flex-shrink-0"/>}
                      <span className={f.y?'text-slate-200':'text-slate-500'}>{f.t}</span>
                    </div>
                  ))}
                </div>
                <Link href={plan.href} className={`block w-full text-center py-3 rounded-xl font-bold transition ${plan.featured?'bg-blue-600 hover:bg-blue-500 text-white':'border border-slate-600 hover:border-blue-500 text-white'}`}>{plan.cta}</Link>
              </div>
            ))}
          </div>
          <div className="text-center mt-16 text-slate-400">
            <p>All plans include a 7-day free trial. No credit card required for Scribe plan.</p>
            <p className="mt-2">Questions? <Link href="/contact" className="text-blue-400 hover:text-blue-300">Contact us</Link></p>
          </div>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
