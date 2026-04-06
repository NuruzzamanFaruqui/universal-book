'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Plus, MessageCircle, Globe, Lock } from 'lucide-react';
import AppNav from '@/components/AppNav';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function GroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<any[]>([]);
  const [myGroups, setMyGroups] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ub_token');
    setIsLoggedIn(!!token);
    fetchGroups();
    if (token) fetchMyGroups();
  }, []);

  const fetchGroups = async () => {
    try {
      const res = await fetch(`${API_URL}/api/groups`);
      if (res.ok) setGroups(await res.json());
    } catch (e) {}
    finally { setLoading(false); }
  };

  const fetchMyGroups = async () => {
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/groups/my`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setMyGroups(data.map((m: any) => m.groupId));
      }
    } catch (e) {}
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, description, isPublic }),
      });
      if (res.ok) {
        const group = await res.json();
        setShowCreate(false);
        setName('');
        setDescription('');
        fetchGroups();
        router.push(`/groups/${group.id}`);
      }
    } catch (e) {}
    finally { setCreating(false); }
  };

  const handleJoin = async (groupId: string) => {
    if (!isLoggedIn) { router.push('/auth/login'); return; }
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/groups/${groupId}/join`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.joined) setMyGroups(prev => [...prev, groupId]);
        else setMyGroups(prev => prev.filter(id => id !== groupId));
      }
    } catch (e) {}
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <AppNav />
      <div className="max-w-6xl mx-auto px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Users className="text-blue-400" size={32} /> Communities
            </h1>
            <p className="text-slate-400">Join groups of writers and readers who share your interests</p>
          </div>
          {isLoggedIn && (
            <button onClick={() => setShowCreate(!showCreate)}
              className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold transition">
              <Plus size={18} /> Create Group
            </button>
          )}
        </div>

        {showCreate && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
            <h2 className="font-bold text-lg mb-4">Create New Group</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Group Name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Fantasy Writers Club"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Visibility</label>
                <select value={isPublic ? 'public' : 'private'} onChange={e => setIsPublic(e.target.value === 'public')}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                  <option value="public">Public — Anyone can join</option>
                  <option value="private">Private — Invite only</option>
                </select>
              </div>
            </div>
            <div className="mb-4">
              <label className="block text-sm text-slate-400 mb-1">Description</label>
              <textarea value={description} onChange={e => setDescription(e.target.value)}
                placeholder="What is this group about?" rows={3}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div className="flex gap-3">
              <button onClick={handleCreate} disabled={creating || !name.trim()}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-semibold transition">
                {creating ? 'Creating...' : 'Create Group'}
              </button>
              <button onClick={() => setShowCreate(false)}
                className="px-5 py-2 border border-slate-600 hover:border-slate-500 rounded-lg text-sm transition">
                Cancel
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1,2,3].map(i => <div key={i} className="bg-slate-800 rounded-xl h-48 animate-pulse" />)}
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-slate-700 rounded-2xl">
            <Users className="mx-auto text-slate-600 mb-4" size={48} />
            <h2 className="text-xl font-semibold text-slate-400 mb-2">No groups yet</h2>
            <p className="text-slate-500 mb-6">Be the first to create a community!</p>
            {isLoggedIn && (
              <button onClick={() => setShowCreate(true)}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-500 rounded-lg font-semibold">
                Create First Group
              </button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {groups.map((group: any) => (
              <div key={group.id} className="bg-slate-800 border border-slate-700 hover:border-blue-500 rounded-xl p-6 transition">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-900/50 flex items-center justify-center">
                    <Users className="text-blue-400" size={22} />
                  </div>
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    {group.isPublic ? <><Globe size={12} /> Public</> : <><Lock size={12} /> Private</>}
                  </span>
                </div>
                <h3 className="font-bold text-lg mb-2">{group.name}</h3>
                {group.description && <p className="text-slate-400 text-sm mb-4 line-clamp-2">{group.description}</p>}
                <div className="flex items-center gap-4 text-xs text-slate-500 mb-4">
                  <span className="flex items-center gap-1"><Users size={12} /> {group._count?.members || 0} members</span>
                  <span className="flex items-center gap-1"><MessageCircle size={12} /> {group._count?.messages || 0} messages</span>
                </div>
                <div className="flex gap-2">
                  <Link href={`/groups/${group.id}`}
                    className="flex-1 text-center py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm transition">
                    View Group
                  </Link>
                  <button onClick={() => handleJoin(group.id)}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold transition ${
                      myGroups.includes(group.id)
                        ? 'bg-red-900/30 text-red-400 border border-red-800'
                        : 'bg-blue-600 hover:bg-blue-500 text-white'
                    }`}>
                    {myGroups.includes(group.id) ? 'Leave' : 'Join'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
