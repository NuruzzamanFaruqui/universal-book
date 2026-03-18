'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Users, Plus, BookOpen, Crown, Pen } from 'lucide-react';
import DashboardNav from '@/components/DashboardNav';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function AuthorGroupsPage() {
  const router = useRouter();
  const [groups, setGroups] = useState<any[]>([]);
  const [books, setBooks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedBookId, setSelectedBookId] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('ub_token');
    if (!token) { router.push('/auth/login'); return; }
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const token = await getFreshToken();
      const [groupsRes, booksRes] = await Promise.all([
        fetch(`${API_URL}/api/author-groups/my`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch(`${API_URL}/api/books`, { headers: { 'Authorization': `Bearer ${token}` } }),
      ]);
      if (groupsRes.ok) setGroups(await groupsRes.json());
      if (booksRes.ok) setBooks(await booksRes.json());
    } catch (e) {}
    finally { setLoading(false); }
  };

  const handleCreate = async () => {
    if (!name.trim()) return;
    setCreating(true);
    setError('');
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/author-groups`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name, description, bookId: selectedBookId || undefined }),
      });
      if (!res.ok) throw new Error('Failed to create group');
      setShowCreate(false);
      setName('');
      setDescription('');
      setSelectedBookId('');
      fetchData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (groupId: string) => {
    if (!confirm('Delete this author group?')) return;
    try {
      const token = await getFreshToken();
      await fetch(`${API_URL}/api/author-groups/${groupId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });
      fetchData();
    } catch (e) {}
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <DashboardNav />
      <div className="max-w-5xl mx-auto px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-3">
              <Users className="text-purple-400" size={32} /> Author Groups
            </h1>
            <p className="text-slate-400">Collaborate with other writers to co-author books</p>
          </div>
          <button onClick={() => setShowCreate(!showCreate)}
            className="flex items-center gap-2 px-5 py-2 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold transition">
            <Plus size={18} /> Create Group
          </button>
        </div>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-6 text-sm">{error}</div>}

        {/* Create Form */}
        {showCreate && (
          <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-8">
            <h2 className="font-bold text-lg mb-4">Create Author Group</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Group Name</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. The Sci-Fi Collective"
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Description</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What will this group work on?" rows={2}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Link to a Book (optional)</label>
                <select value={selectedBookId} onChange={e => setSelectedBookId(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-purple-500">
                  <option value="">No book selected</option>
                  {books.map((book: any) => (
                    <option key={book.id} value={book.id}>{book.title}</option>
                  ))}
                </select>
              </div>
              <div className="flex gap-3">
                <button onClick={handleCreate} disabled={creating || !name.trim()}
                  className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 rounded-lg text-sm font-semibold transition">
                  {creating ? 'Creating...' : 'Create Group'}
                </button>
                <button onClick={() => setShowCreate(false)}
                  className="px-5 py-2 border border-slate-600 rounded-lg text-sm transition">
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Groups List */}
        {groups.length === 0 ? (
          <div className="text-center py-24 border-2 border-dashed border-slate-700 rounded-2xl">
            <Users className="mx-auto text-slate-600 mb-4" size={48} />
            <h2 className="text-xl font-semibold text-slate-400 mb-2">No author groups yet</h2>
            <p className="text-slate-500 mb-6">Create a group to start co-writing books with other authors</p>
            <button onClick={() => setShowCreate(true)}
              className="px-6 py-3 bg-purple-600 hover:bg-purple-500 rounded-lg font-semibold">
              Create First Group
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {groups.map((membership: any) => {
              const group = membership.group;
              const isOwner = group.createdBy === membership.userId;
              return (
                <div key={group.id} className="bg-slate-800 border border-slate-700 hover:border-purple-500 rounded-xl p-6 transition">
                  <div className="flex items-start justify-between mb-4">
                    <div className="w-12 h-12 rounded-xl bg-purple-900/50 flex items-center justify-center">
                      <Users className="text-purple-400" size={22} />
                    </div>
                    <div className="flex items-center gap-2">
                      {membership.role === 'owner' && (
                        <span className="flex items-center gap-1 text-xs text-yellow-400 bg-yellow-900/30 px-2 py-0.5 rounded-full">
                          <Crown size={10} /> Owner
                        </span>
                      )}
                      {membership.role === 'writer' && (
                        <span className="flex items-center gap-1 text-xs text-blue-400 bg-blue-900/30 px-2 py-0.5 rounded-full">
                          <Pen size={10} /> Writer
                        </span>
                      )}
                    </div>
                  </div>
                  <h3 className="font-bold text-lg mb-2">{group.name}</h3>
                  {group.description && <p className="text-slate-400 text-sm mb-3 line-clamp-2">{group.description}</p>}
                  {group.book && (
                    <div className="flex items-center gap-2 text-sm text-blue-400 mb-3">
                      <BookOpen size={14} />
                      <span className="truncate">{group.book.title}</span>
                    </div>
                  )}
                  <div className="text-xs text-slate-500 mb-4">
                    {group.members?.length || 0} members
                  </div>
                  <div className="flex gap-2">
                    {group.book && (
                      <Link href={`/dashboard/books/${group.book.id}/edit`}
                        className="flex-1 text-center py-2 bg-purple-600 hover:bg-purple-500 rounded-lg text-sm font-semibold transition">
                        Co-Edit Book
                      </Link>
                    )}
                    {isOwner && (
                      <button onClick={() => handleDelete(group.id)}
                        className="px-3 py-2 border border-red-800 text-red-400 hover:bg-red-900/20 rounded-lg text-sm transition">
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
