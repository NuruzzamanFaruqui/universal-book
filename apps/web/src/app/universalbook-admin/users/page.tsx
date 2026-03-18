'use client';
export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Search, RefreshCw, Users, BookOpen } from 'lucide-react';

const API_URL = "https://api.universal-book.com";

async function getFreshToken(): Promise<string | null> {
  try {
    const { auth } = await import('@/lib/firebase');
    if (auth?.currentUser) return await auth.currentUser.getIdToken(true);
  } catch (e) {}
  return localStorage.getItem('ub_token');
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [filtered, setFiltered] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [planFilter, setPlanFilter] = useState('ALL');

  useEffect(() => { fetchUsers(); }, []);

  useEffect(() => {
    let result = users;
    if (search) result = result.filter(u => u.email?.toLowerCase().includes(search.toLowerCase()) || u.name?.toLowerCase().includes(search.toLowerCase()));
    if (planFilter !== 'ALL') result = result.filter(u => (u.plan || 'FREE') === planFilter);
    setFiltered(result);
  }, [search, planFilter, users]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUsers(data);
        setFiltered(data);
      }
    } catch (e) {}
    finally { setLoading(false); }
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-gray-400 text-sm mt-1">{users.length} total users</p>
        </div>
        <button onClick={fetchUsers} className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition">
          <RefreshCw size={14} /> Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 text-gray-500" size={16} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full bg-gray-900 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
          />
        </div>
        <select
          value={planFilter}
          onChange={e => setPlanFilter(e.target.value)}
          className="bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
        >
          <option value="ALL">All Plans</option>
          <option value="FREE">Free</option>
          <option value="AUTHOR">Author</option>
          <option value="PUBLISHER">Publisher</option>
        </select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Free Users', value: users.filter(u => !u.plan || u.plan === 'FREE').length, color: 'gray' },
          { label: 'Author Plan', value: users.filter(u => u.plan === 'AUTHOR').length, color: 'blue' },
          { label: 'Publisher Plan', value: users.filter(u => u.plan === 'PUBLISHER').length, color: 'purple' },
        ].map((stat, i) => (
          <div key={i} className="bg-gray-900 border border-gray-800 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{stat.value}</div>
            <div className="text-gray-400 text-sm">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider">User</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider">Plan</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider">Books</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider">Joined</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">Loading users...</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={4} className="px-6 py-8 text-center text-gray-400">No users found</td></tr>
            ) : (
              filtered.map((user, i) => (
                <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold flex-shrink-0">
                        {user.name?.[0] || user.email?.[0] || '?'}
                      </div>
                      <div>
                        <div className="text-sm font-medium">{user.name || 'No name'}</div>
                        <div className="text-xs text-gray-400">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${
                      user.plan === 'AUTHOR' ? 'bg-blue-900 text-blue-300' :
                      user.plan === 'PUBLISHER' ? 'bg-purple-900 text-purple-300' :
                      'bg-gray-800 text-gray-400'
                    }`}>{user.plan || 'FREE'}</span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1 text-sm text-gray-300">
                      <BookOpen size={14} className="text-gray-500" />
                      {user.books?.length || 0}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-400">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
