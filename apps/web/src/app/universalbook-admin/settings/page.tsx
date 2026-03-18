'use client';
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
import { Save, Eye, EyeOff, CreditCard, Bot, Globe, Shield, CheckCircle } from 'lucide-react';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function AdminSettingsPage() {
  const [activeTab, setActiveTab] = useState('stripe');
  const [showKeys, setShowKeys] = useState<any>({});
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<any>({});
  const [error, setError] = useState('');
  const [stripe, setStripe] = useState({
    stripePublishableKey: '',
    stripeSecretKey: '',
    stripeWebhookSecret: '',
    authorPriceId: '',
    publisherPriceId: '',
  });
  const [ai, setAi] = useState({
    anthropicKey: '',
    model: 'claude-sonnet-4-20250514',
    maxTokens: '2000',
  });
  const [general, setGeneral] = useState({
    siteName: 'Universal Book',
    supportEmail: 'support@universal-book.com',
    maintenanceMode: false,
    allowRegistration: true,
  });

  useEffect(() => { loadSettings(); }, []);

  const loadSettings = async () => {
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/admin/settings`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.STRIPE_PUBLISHABLE_KEY) setStripe({
          stripePublishableKey: data.STRIPE_PUBLISHABLE_KEY || '',
          stripeSecretKey: data.STRIPE_SECRET_KEY || '',
          stripeWebhookSecret: data.STRIPE_WEBHOOK_SECRET || '',
          authorPriceId: data.STRIPE_AUTHOR_PRICE_ID || '',
          publisherPriceId: data.STRIPE_PUBLISHER_PRICE_ID || '',
        });
        if (data.AI_MODEL) setAi({
          anthropicKey: data.ANTHROPIC_API_KEY || '',
          model: data.AI_MODEL || 'claude-sonnet-4-20250514',
          maxTokens: data.AI_MAX_TOKENS || '2000',
        });
      }
    } catch (e) {}
  };

  const toggleShow = (key: string) => setShowKeys((prev: any) => ({ ...prev, [key]: !prev[key] }));

  const handleSaveStripe = async () => {
    setSaving(true);
    setError('');
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/admin/settings/stripe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(stripe),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaved((prev: any) => ({ ...prev, stripe: true }));
      setTimeout(() => setSaved((prev: any) => ({ ...prev, stripe: false })), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAi = async () => {
    setSaving(true);
    setError('');
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/admin/settings/ai`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(ai),
      });
      if (!res.ok) throw new Error('Failed to save');
      setSaved((prev: any) => ({ ...prev, ai: true }));
      setTimeout(() => setSaved((prev: any) => ({ ...prev, ai: false })), 3000);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const tabs = [
    { id: 'stripe', label: 'Stripe Payments', icon: <CreditCard size={16} /> },
    { id: 'ai', label: 'AI Settings', icon: <Bot size={16} /> },
    { id: 'general', label: 'General', icon: <Globe size={16} /> },
    { id: 'security', label: 'Security', icon: <Shield size={16} /> },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-gray-400 text-sm mt-1">Configure Universal Book platform settings</p>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-6 text-sm">{error}</div>}

      <div className="flex gap-2 mb-8 border-b border-gray-800">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition border-b-2 -mb-px ${
              activeTab === tab.id ? 'border-blue-500 text-blue-400' : 'border-transparent text-gray-400 hover:text-white'
            }`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'stripe' && (
        <div className="max-w-2xl">
          <div className="bg-blue-900/20 border border-blue-800 rounded-xl p-4 mb-6">
            <p className="text-sm text-blue-300">
              <strong>How to get Stripe keys:</strong> Go to <a href="https://dashboard.stripe.com/apikeys" target="_blank" className="underline">dashboard.stripe.com/apikeys</a> and copy your keys. For webhook secret, go to Developers → Webhooks.
            </p>
          </div>
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <CreditCard className="text-blue-400" size={20} /> Stripe Configuration
            </h2>
            {[
              { key: 'stripePublishableKey', label: 'Publishable Key', placeholder: 'pk_live_...' },
              { key: 'stripeSecretKey', label: 'Secret Key', placeholder: 'sk_live_...' },
              { key: 'stripeWebhookSecret', label: 'Webhook Secret', placeholder: 'whsec_...' },
              { key: 'authorPriceId', label: 'Author Plan Price ID ($29/mo)', placeholder: 'price_...' },
              { key: 'publisherPriceId', label: 'Publisher Plan Price ID ($99/mo)', placeholder: 'price_...' },
            ].map(field => (
              <div key={field.key}>
                <label className="block text-sm text-gray-400 mb-1">{field.label}</label>
                <div className="relative">
                  <input
                    type={showKeys[field.key] ? 'text' : 'password'}
                    value={(stripe as any)[field.key]}
                    onChange={e => setStripe({ ...stripe, [field.key]: e.target.value })}
                    placeholder={field.placeholder}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 pr-10 text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                  <button onClick={() => toggleShow(field.key)} className="absolute right-3 top-2.5 text-gray-500 hover:text-white">
                    {showKeys[field.key] ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
            ))}
            <button onClick={handleSaveStripe} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-semibold transition">
              {saved.stripe ? <><CheckCircle size={16} /> Saved!</> : <><Save size={16} /> Save Stripe Settings</>}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'ai' && (
        <div className="max-w-2xl">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Bot className="text-purple-400" size={20} /> AI Configuration
            </h2>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Anthropic API Key</label>
              <div className="relative">
                <input type={showKeys.anthropicKey ? 'text' : 'password'} value={ai.anthropicKey}
                  onChange={e => setAi({ ...ai, anthropicKey: e.target.value })} placeholder="sk-ant-..."
                  className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 pr-10 text-white text-sm focus:outline-none focus:border-blue-500" />
                <button onClick={() => toggleShow('anthropicKey')} className="absolute right-3 top-2.5 text-gray-500 hover:text-white">
                  {showKeys.anthropicKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">AI Model</label>
              <select value={ai.model} onChange={e => setAi({ ...ai, model: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                <option value="claude-sonnet-4-20250514">Claude Sonnet 4 (Recommended)</option>
                <option value="claude-opus-4-20250514">Claude Opus 4 (Most Powerful)</option>
                <option value="claude-haiku-4-5-20251001">Claude Haiku (Fastest)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Max Tokens Per Chapter</label>
              <input type="number" value={ai.maxTokens} onChange={e => setAi({ ...ai, maxTokens: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <button onClick={handleSaveAi} disabled={saving}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-semibold transition">
              {saved.ai ? <><CheckCircle size={16} /> Saved!</> : <><Save size={16} /> Save AI Settings</>}
            </button>
          </div>
        </div>
      )}

      {activeTab === 'general' && (
        <div className="max-w-2xl">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Globe className="text-green-400" size={20} /> General Settings
            </h2>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Site Name</label>
              <input type="text" value={general.siteName} onChange={e => setGeneral({ ...general, siteName: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Support Email</label>
              <input type="email" value={general.supportEmail} onChange={e => setGeneral({ ...general, supportEmail: e.target.value })}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div>
                <div className="font-medium text-sm">Maintenance Mode</div>
                <div className="text-gray-400 text-xs">Block all user access temporarily</div>
              </div>
              <button onClick={() => setGeneral({ ...general, maintenanceMode: !general.maintenanceMode })}
                className={`w-12 h-6 rounded-full transition ${general.maintenanceMode ? 'bg-red-500' : 'bg-gray-600'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${general.maintenanceMode ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
            <div className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
              <div>
                <div className="font-medium text-sm">Allow New Registrations</div>
                <div className="text-gray-400 text-xs">Let new users sign up</div>
              </div>
              <button onClick={() => setGeneral({ ...general, allowRegistration: !general.allowRegistration })}
                className={`w-12 h-6 rounded-full transition ${general.allowRegistration ? 'bg-blue-500' : 'bg-gray-600'}`}>
                <div className={`w-5 h-5 bg-white rounded-full shadow transition-transform mx-0.5 ${general.allowRegistration ? 'translate-x-6' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'security' && (
        <div className="max-w-2xl">
          <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 space-y-5">
            <h2 className="font-bold text-lg flex items-center gap-2">
              <Shield className="text-red-400" size={20} /> Security Settings
            </h2>
            <div className="bg-yellow-900/20 border border-yellow-800 rounded-lg p-4">
              <p className="text-yellow-300 text-sm">⚠ Changes here affect platform security. Proceed with caution.</p>
            </div>
            {[
              { label: 'Require email verification', desc: 'Users must verify email before accessing dashboard' },
              { label: 'Enable rate limiting', desc: 'Limit API requests per user per minute' },
              { label: 'Log all admin actions', desc: 'Keep audit trail of all admin activities' },
              { label: 'Block suspicious IPs', desc: 'Automatically block IPs with suspicious activity' },
            ].map((setting, i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-gray-800 rounded-lg">
                <div>
                  <div className="font-medium text-sm">{setting.label}</div>
                  <div className="text-gray-400 text-xs">{setting.desc}</div>
                </div>
                <div className="w-12 h-6 rounded-full bg-blue-500 cursor-pointer">
                  <div className="w-5 h-5 bg-white rounded-full shadow translate-x-6 mx-0.5 mt-0.5" />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
