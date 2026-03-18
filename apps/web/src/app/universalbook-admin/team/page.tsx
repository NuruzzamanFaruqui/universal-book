'use client';
export const dynamic = 'force-dynamic';

import { useState } from 'react';
import { Shield, Plus, Trash2, Crown, Users, Eye, Settings } from 'lucide-react';

const ROLES = [
  {
    name: 'Super Admin',
    icon: <Crown className="text-yellow-400" size={18} />,
    color: 'yellow',
    permissions: ['Full platform access', 'Manage all users', 'Access all settings', 'Stripe integration', 'Add/remove admins', 'Delete any content'],
  },
  {
    name: 'Admin',
    icon: <Shield className="text-red-400" size={18} />,
    color: 'red',
    permissions: ['Manage users', 'View all books', 'Access settings', 'Cannot manage Stripe', 'Cannot add Super Admins'],
  },
  {
    name: 'Manager',
    icon: <Users className="text-blue-400" size={18} />,
    color: 'blue',
    permissions: ['View all users', 'View all books', 'Cannot change settings', 'Cannot delete users'],
  },
  {
    name: 'Moderator',
    icon: <Eye className="text-green-400" size={18} />,
    color: 'green',
    permissions: ['View books only', 'Flag content', 'Cannot view user details', 'Read-only access'],
  },
];

const colorMap: any = {
  yellow: 'bg-yellow-900/20 border-yellow-800',
  red: 'bg-red-900/20 border-red-800',
  blue: 'bg-blue-900/20 border-blue-800',
  green: 'bg-green-900/20 border-green-800',
};

const badgeMap: any = {
  yellow: 'bg-yellow-900 text-yellow-300',
  red: 'bg-red-900 text-red-300',
  blue: 'bg-blue-900 text-blue-300',
  green: 'bg-green-900 text-green-300',
};

export default function AdminTeamPage() {
  const [teamMembers, setTeamMembers] = useState([
    { email: 'faruqui.swe@diu.edu.bd', role: 'Super Admin', addedAt: '2026-01-01' },
    { email: 'levin.Kuhlmann@monash.edu', role: 'Super Admin', addedAt: '2026-03-16' },
  ]);
  const [showAdd, setShowAdd] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newRole, setNewRole] = useState('Manager');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const addMember = () => {
    setError('');
    setSuccess('');
    if (!newEmail) { setError('Please enter an email address'); return; }
    if (teamMembers.find(m => m.email === newEmail)) { setError('This email is already a team member'); return; }
    setTeamMembers([...teamMembers, { email: newEmail, role: newRole, addedAt: new Date().toISOString().split('T')[0] }]);
    setSuccess(`${newEmail} added as ${newRole}`);
    setNewEmail('');
    setShowAdd(false);
  };

  const removeMember = (email: string) => {
    if (email === 'faruqui.swe@diu.edu.bd' || email === 'levin.Kuhlmann@monash.edu') { setError('Cannot remove the Super Admin'); return; }
    if (!confirm(`Remove ${email} from the team?`)) return;
    setTeamMembers(teamMembers.filter(m => m.email !== email));
    setSuccess(`${email} removed from team`);
  };

  const getRoleColor = (role: string) => {
    if (role === 'Super Admin') return 'yellow';
    if (role === 'Admin') return 'red';
    if (role === 'Manager') return 'blue';
    return 'green';
  };

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Team & Roles</h1>
          <p className="text-gray-400 text-sm mt-1">Manage admin team members and their permissions</p>
        </div>
        <button onClick={() => setShowAdd(!showAdd)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">
          <Plus size={16} /> Add Team Member
        </button>
      </div>

      {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-500/10 border border-green-500 text-green-400 rounded-lg p-3 mb-4 text-sm">{success}</div>}

      {/* Add Member Form */}
      {showAdd && (
        <div className="bg-gray-900 border border-gray-700 rounded-xl p-6 mb-6">
          <h2 className="font-bold mb-4">Add New Team Member</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm text-gray-400 mb-1">Email Address</label>
              <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)}
                placeholder="admin@example.com"
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500" />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Role</label>
              <select value={newRole} onChange={e => setNewRole(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-blue-500">
                <option>Admin</option>
                <option>Manager</option>
                <option>Moderator</option>
              </select>
            </div>
          </div>
          <div className="flex gap-3 mt-4">
            <button onClick={addMember} className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">
              Add Member
            </button>
            <button onClick={() => setShowAdd(false)} className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Team Members */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden mb-8">
        <div className="px-6 py-4 border-b border-gray-800">
          <h2 className="font-bold">Team Members ({teamMembers.length})</h2>
        </div>
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider">Member</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider">Role</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider">Added</th>
              <th className="text-left px-6 py-3 text-xs text-gray-400 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody>
            {teamMembers.map((member, i) => (
              <tr key={i} className="border-b border-gray-800 hover:bg-gray-800/50 transition">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-sm font-bold">
                      {member.email[0].toUpperCase()}
                    </div>
                    <div className="text-sm">{member.email}</div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${badgeMap[getRoleColor(member.role)]}`}>
                    {member.role}
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-400">{member.addedAt}</td>
                <td className="px-6 py-4">
                  {member.email !== 'faruqui.swe@diu.edu.bd' && (
                    <button onClick={() => removeMember(member.email)}
                      className="text-gray-500 hover:text-red-400 transition">
                      <Trash2 size={16} />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Role Descriptions */}
      <h2 className="text-xl font-bold mb-4">Role Permissions</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {ROLES.map((role, i) => (
          <div key={i} className={`border rounded-xl p-6 ${colorMap[role.color]}`}>
            <div className="flex items-center gap-2 mb-4">
              {role.icon}
              <h3 className="font-bold">{role.name}</h3>
            </div>
            <ul className="space-y-2">
              {role.permissions.map((p, j) => (
                <li key={j} className="text-sm text-gray-300 flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-gray-500 flex-shrink-0" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
