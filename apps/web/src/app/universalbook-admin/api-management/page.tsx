'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { KeyRound, RefreshCw, Save, CheckCircle2, XCircle, Loader2, Eye, EyeOff } from 'lucide-react';
import { getToken as getFreshToken } from '@/lib/auth';
import { API_URL } from '@/lib/config';

interface ManagedKey {
  key: string;
  label: string;
  group: 'ai' | 'stripe' | 'google' | 'email';
  secret: boolean;
  required?: boolean;
  hint?: string;
  placeholder?: string;
  configured: boolean;
  source: 'database' | 'environment' | 'unset';
  preview: string;
}

const GROUPS: { id: ManagedKey['group']; title: string; blurb: string }[] = [
  { id: 'ai', title: 'Anthropic', blurb: 'Book generation, writing assistance and diagrams.' },
  { id: 'google', title: 'Google Cloud', blurb: 'Imagen and Veo run in this project. Access uses the Cloud Run service account — there is no key to paste.' },
  { id: 'stripe', title: 'Stripe', blurb: 'Credit top-ups and book purchases.' },
  { id: 'email', title: 'Email', blurb: 'Password reset. Use SMTP for a mailbox you already own, or Resend over HTTPS.' },
];

export default function ApiManagementPage() {
  const [keys, setKeys] = useState<ManagedKey[]>([]);
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [reveal, setReveal] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [tests, setTests] = useState<Record<string, { ok?: boolean; detail?: string; error?: string; running?: boolean }>>({});

  useEffect(() => { load(); }, []);

  const load = async () => {
    setLoading(true);
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/admin/api-keys`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setKeys(data.keys);
        setEdits({});
      }
    } catch (e) { /* leave the previous state on screen */ }
    finally { setLoading(false); }
  };

  const save = async () => {
    if (!Object.keys(edits).length) return;
    setSaving(true);
    setMessage('');
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/admin/api-keys`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(edits),
      });
      const data = await res.json();
      setMessage(res.ok ? data.message : data.message || 'Could not save.');
      if (res.ok) await load();
    } catch (e: any) {
      setMessage(e.message || 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const test = async (group: string) => {
    setTests(t => ({ ...t, [group]: { running: true } }));
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/admin/api-keys/test/${group}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const result = await res.json();
      setTests(t => ({ ...t, [group]: result }));
    } catch (e: any) {
      setTests(t => ({ ...t, [group]: { ok: false, error: e.message } }));
    }
  };

  const dirty = Object.keys(edits).length;

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-start justify-between mb-2 gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <KeyRound size={22} className="text-blue-400" /> API Management
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Keys saved here take effect immediately — no redeploy. They override the matching
            environment variable.
          </p>
        </div>
        <button onClick={load} disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition disabled:opacity-50 shrink-0">
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Reload
        </button>
      </div>

      <div className="text-xs text-gray-500 bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 my-6 leading-relaxed">
        Stored secrets are never sent back to this page — you see a masked preview only. Leave a
        field untouched to keep it, or clear it to fall back to the environment variable.
      </div>

      {GROUPS.map(group => {
        const groupKeys = keys.filter(k => k.group === group.id);
        if (!groupKeys.length) return null;
        const t = tests[group.id];

        return (
          <section key={group.id} className="mb-8 bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-gray-800 flex items-start justify-between gap-4">
              <div>
                <h2 className="font-semibold">{group.title}</h2>
                <p className="text-xs text-gray-500 mt-1 max-w-xl leading-relaxed">{group.blurb}</p>
              </div>
              <button onClick={() => test(group.id)} disabled={t?.running}
                className="shrink-0 px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-xs transition disabled:opacity-50 flex items-center gap-1.5">
                {t?.running ? <Loader2 size={12} className="animate-spin" /> : null}
                Test connection
              </button>
            </div>

            {t && !t.running && (
              <div className={`px-5 py-2.5 text-xs flex items-center gap-2 border-b border-gray-800 ${
                t.ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                {t.ok ? <CheckCircle2 size={13} /> : <XCircle size={13} />}
                {t.ok ? t.detail : t.error}
              </div>
            )}

            <div className="divide-y divide-gray-800">
              {groupKeys.map(k => {
                const edited = k.key in edits;
                const shown = reveal[k.key];
                return (
                  <div key={k.key} className="px-5 py-4">
                    <div className="flex items-baseline gap-2 mb-2 flex-wrap">
                      <label htmlFor={k.key} className="text-sm font-medium">{k.label}</label>
                      <code className="text-[10px] text-gray-600 font-mono">{k.key}</code>
                      {k.required && !k.configured && (
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">required</span>
                      )}
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ml-auto ${
                        k.source === 'database' ? 'bg-blue-500/15 text-blue-400'
                        : k.source === 'environment' ? 'bg-gray-700 text-gray-400'
                        : 'bg-gray-800 text-gray-600'}`}>
                        {k.source === 'database' ? 'saved here'
                          : k.source === 'environment' ? 'from env' : 'not set'}
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <input
                        id={k.key}
                        type={k.secret && !shown && !edited ? 'password' : 'text'}
                        value={edited ? edits[k.key] : (k.preview || '')}
                        placeholder={k.placeholder || ''}
                        onChange={e => setEdits(v => ({ ...v, [k.key]: e.target.value }))}
                        className="flex-1 bg-gray-950 border border-gray-700 rounded-lg px-3 py-2 text-sm font-mono
                                   focus:outline-none focus:border-blue-500 text-gray-200 placeholder-gray-700"
                      />
                      {k.secret && (
                        <button onClick={() => setReveal(r => ({ ...r, [k.key]: !r[k.key] }))}
                          title={shown ? 'Hide' : 'Show masked preview'}
                          className="px-2.5 text-gray-500 hover:text-gray-300 border border-gray-800 rounded-lg transition">
                          {shown ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      )}
                    </div>

                    {k.hint && <p className="text-[11px] text-gray-500 mt-1.5 leading-relaxed">{k.hint}</p>}
                    {edited && edits[k.key] === '' && (
                      <p className="text-[11px] text-amber-500 mt-1.5">
                        Will clear the saved value and fall back to the environment variable.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <div className="sticky bottom-0 bg-gray-950/95 backdrop-blur border-t border-gray-800 -mx-8 px-8 py-4 flex items-center gap-4">
        <button onClick={save} disabled={!dirty || saving}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-40
                     disabled:cursor-not-allowed rounded-lg text-sm font-semibold transition">
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          {saving ? 'Saving…' : dirty ? `Save ${dirty} change${dirty > 1 ? 's' : ''}` : 'Save'}
        </button>
        {message && <span className="text-sm text-gray-400">{message}</span>}
      </div>
    </div>
  );
}
