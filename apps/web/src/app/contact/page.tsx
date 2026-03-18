'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Mail, MessageSquare, Clock } from 'lucide-react';
import MarketingNav from '@/components/MarketingNav';
import MarketingFooter from '@/components/MarketingFooter';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    // Simulate sending - in production connect to email service
    await new Promise(resolve => setTimeout(resolve, 1500));
    setSuccess(true);
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col">
      <MarketingNav />
      <div className="flex-1">
        <div className="text-center px-8 py-16 max-w-3xl mx-auto">
          <h1 className="text-5xl font-extrabold mb-4">Get in Touch</h1>
          <p className="text-xl text-slate-400">Have a question? We'd love to hear from you.</p>
        </div>

        <div className="max-w-6xl mx-auto px-8 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">

            {/* Contact Info */}
            <div className="space-y-8">
              <div>
                <h2 className="text-xl font-bold mb-6">Contact Information</h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-blue-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Mail className="text-blue-400" size={20} />
                    </div>
                    <div>
                      <div className="font-semibold mb-1">Email</div>
                      <div className="text-slate-400 text-sm">hello@universalbook.ai</div>
                      <div className="text-slate-400 text-sm">support@universalbook.ai</div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-blue-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <MessageSquare className="text-blue-400" size={20} />
                    </div>
                    <div>
                      <div className="font-semibold mb-1">Live Chat</div>
                      <div className="text-slate-400 text-sm">Available on all paid plans</div>
                      <div className="text-slate-400 text-sm">Mon–Fri, 9am–6pm EST</div>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="w-10 h-10 bg-blue-900/50 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Clock className="text-blue-400" size={20} />
                    </div>
                    <div>
                      <div className="font-semibold mb-1">Response Time</div>
                      <div className="text-slate-400 text-sm">Free plan: within 48 hours</div>
                      <div className="text-slate-400 text-sm">Paid plans: within 24 hours</div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-slate-800 border border-slate-700 rounded-xl p-6">
                <h3 className="font-bold mb-3">Frequently Asked</h3>
                <div className="space-y-3 text-sm text-slate-400">
                  <div>
                    <div className="text-white font-medium mb-1">Can I cancel anytime?</div>
                    <div>Yes, cancel with one click. No questions asked.</div>
                  </div>
                  <div>
                    <div className="text-white font-medium mb-1">Do I own my books?</div>
                    <div>100%. All content you create belongs to you.</div>
                  </div>
                  <div>
                    <div className="text-white font-medium mb-1">Is there a free plan?</div>
                    <div>Yes! The Scribe plan is free forever.</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Contact Form */}
            <div className="md:col-span-2">
              {success ? (
                <div className="bg-green-900/20 border border-green-700 rounded-2xl p-12 text-center">
                  <div className="w-16 h-16 bg-green-900/50 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Mail className="text-green-400" size={28} />
                  </div>
                  <h2 className="text-2xl font-bold mb-2">Message Sent!</h2>
                  <p className="text-slate-400">Thanks for reaching out. We'll get back to you within 24-48 hours.</p>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="bg-slate-800 border border-slate-700 rounded-2xl p-8 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Your Name</label>
                      <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} required
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
                    </div>
                    <div>
                      <label className="block text-sm text-slate-400 mb-2">Email Address</label>
                      <input type="email" value={form.email} onChange={e => setForm({...form, email: e.target.value})} required
                        className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Subject</label>
                    <select value={form.subject} onChange={e => setForm({...form, subject: e.target.value})} required
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500">
                      <option value="">Select a subject</option>
                      <option>General Question</option>
                      <option>Technical Support</option>
                      <option>Billing & Payments</option>
                      <option>Feature Request</option>
                      <option>Enterprise & Publisher Plan</option>
                      <option>Other</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-2">Message</label>
                    <textarea value={form.message} onChange={e => setForm({...form, message: e.target.value})} required rows={6}
                      placeholder="How can we help you?"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500 resize-none" />
                  </div>
                  <button type="submit" disabled={loading}
                    className="w-full py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-xl font-bold text-lg transition">
                    {loading ? 'Sending...' : 'Send Message'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
      <MarketingFooter />
    </div>
  );
}
