'use client';
import AppNav from '@/components/AppNav';
export const dynamic = 'force-dynamic';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { User, Mail, Save, Zap, Shield, Camera, Check, X, Loader2 } from 'lucide-react';
import { fetchMe, getToken as getFreshToken } from '@/lib/auth';
import { API_URL } from '@/lib/config';
import Avatar from '@/components/Avatar';
import {
  PROFILE_PHOTO_MAX_BYTES,
  PROFILE_PHOTO_TYPES,
  publishProfilePhoto,
} from '@/lib/profile-photo';

const ADMIN_EMAILS = ['faruqui.swe@diu.edu.bd', 'levin.kuhlmann@monash.edu'];


export default function AccountPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [isAdmin, setIsAdmin] = useState(false);

  // Profile photo: a picked file is previewed locally until confirmed.
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('ub_token');
    if (!token) { router.push('/auth/login'); return; }
    fetchUser();
    checkAdminStatus();
  }, []);

  // Release the preview's object URL when it is replaced or the page unmounts.
  useEffect(() => {
    return () => {
      if (photoPreview) URL.revokeObjectURL(photoPreview);
    };
  }, [photoPreview]);

  const openPhotoPicker = () => {
    if (uploadingPhoto) return;
    fileInputRef.current?.click();
  };

  const handlePhotoSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset so choosing the same file again still fires onChange.
    e.target.value = '';
    if (!file) return;

    setError('');
    setSuccess('');
    if (!PROFILE_PHOTO_TYPES.includes(file.type)) {
      setError('Please choose a JPEG, PNG, WebP or GIF image.');
      return;
    }
    if (file.size > PROFILE_PHOTO_MAX_BYTES) {
      setError('Photo must be 5 MB or smaller.');
      return;
    }
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
  };

  const cancelPhoto = () => {
    setPhotoFile(null);
    setPhotoPreview(null);
  };

  const confirmPhoto = async () => {
    if (!photoFile) return;
    setUploadingPhoto(true);
    setError('');
    setSuccess('');
    try {
      const token = await getFreshToken();
      if (!token) { router.push('/auth/login'); return; }

      const form = new FormData();
      form.append('file', photoFile);
      // No Content-Type header: the browser sets the multipart boundary.
      const res = await fetch(`${API_URL}/api/users/me/photo`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      });

      if (!res.ok) {
        let message = res.status === 413 ? 'Photo must be 5 MB or smaller.' : 'Failed to upload photo.';
        try {
          const body = await res.json();
          if (res.status !== 413 && body?.message) {
            message = Array.isArray(body.message) ? body.message[0] : body.message;
          }
        } catch { /* non-JSON error body */ }
        throw new Error(message);
      }

      const { profilePhoto } = await res.json();
      setUser((u: any) => (u ? { ...u, profilePhoto } : u));
      if (user?.id) publishProfilePhoto(user.id, profilePhoto);
      cancelPhoto();
      setSuccess('Profile photo updated!');
    } catch (err: any) {
      setError(err.message || 'Failed to upload photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const checkAdminStatus = async () => {
    try {
      const me = await fetchMe();
      if (me?.email) {
        const email = me.email.toLowerCase().trim();
        setIsAdmin(ADMIN_EMAILS.some(a => a.toLowerCase() === email));
      }
    } catch (e) {}
  };

  const fetchUser = async () => {
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/users/me`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) throw new Error('Failed to load profile');
      const data = await res.json();
      setUser(data);
      setName(data.name || '');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const token = await getFreshToken();
      const res = await fetch(`${API_URL}/api/users/me`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ name }),
      });
      if (!res.ok) throw new Error('Failed to update profile');
      setSuccess('Profile updated successfully!');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-white text-xl">Loading profile...</div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <AppNav />

      <div className="max-w-2xl mx-auto px-8 py-12">
        <h1 className="text-3xl font-bold mb-8">My Account</h1>

        {error && <div className="bg-red-500/10 border border-red-500 text-red-400 rounded-lg p-3 mb-6">{error}</div>}
        {success && <div className="bg-green-500/10 border border-green-500 text-green-400 rounded-lg p-3 mb-6">{success}</div>}

        {/* Admin Panel Access */}
        {isAdmin && (
          <div className="bg-red-900/20 border border-red-800 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-900/50 rounded-lg flex items-center justify-center">
                  <Shield className="text-red-400" size={20} />
                </div>
                <div>
                  <div className="font-bold text-red-300">Admin Access</div>
                  <div className="text-slate-400 text-sm">You have administrative privileges</div>
                </div>
              </div>
              <Link href="/universalbook-admin"
                className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-500 rounded-lg text-sm font-semibold transition">
                <Shield size={14} /> Open Admin Panel
              </Link>
            </div>
          </div>
        )}

        {/* Profile Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-8 mb-6">
          <div className="flex items-center gap-5 mb-8">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={openPhotoPicker}
                disabled={uploadingPhoto}
                aria-label={user?.profilePhoto ? 'Change profile photo' : 'Add profile photo'}
                title={user?.profilePhoto ? 'Change profile photo' : 'Add profile photo'}
                className="group relative w-24 h-24 rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-800 disabled:cursor-wait"
              >
                <Avatar
                  user={user}
                  src={photoPreview}
                  className={`w-24 h-24 text-3xl ${photoPreview ? 'ring-2 ring-blue-500' : ''}`}
                />
                {/* Hover / focus overlay */}
                <span className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100 transition-opacity">
                  <Camera size={24} className="text-white" />
                </span>
                {/* Always-visible edit badge, so touch users can find it */}
                <span className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-blue-600 border-2 border-slate-800 flex items-center justify-center shadow-md group-hover:bg-blue-500 transition-colors">
                  {uploadingPhoto ? (
                    <Loader2 size={14} className="text-white animate-spin" />
                  ) : (
                    <Camera size={14} className="text-white" />
                  )}
                </span>
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept={PROFILE_PHOTO_TYPES.join(',')}
                onChange={handlePhotoSelected}
                className="hidden"
              />
              {photoPreview && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={confirmPhoto}
                    disabled={uploadingPhoto}
                    className="flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-md text-xs font-semibold transition"
                  >
                    {uploadingPhoto ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    {uploadingPhoto ? 'Saving' : 'Save'}
                  </button>
                  <button
                    type="button"
                    onClick={cancelPhoto}
                    disabled={uploadingPhoto}
                    aria-label="Cancel photo change"
                    className="flex items-center px-2 py-1 border border-slate-600 hover:bg-slate-700 disabled:opacity-50 rounded-md text-xs text-slate-300 transition"
                  >
                    <X size={12} />
                  </button>
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="font-bold text-lg truncate">{user?.name || 'No name set'}</div>
              <div className="text-slate-400 text-sm truncate">{user?.email}</div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs px-2 py-0.5 bg-blue-900 text-blue-300 rounded-full">
                  {user?.plan || 'FREE'} Plan
                </span>
                {isAdmin && (
                  <span className="text-xs px-2 py-0.5 bg-red-900 text-red-300 rounded-full flex items-center gap-1">
                    <Shield size={10} /> Super Admin
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-2">
                {photoPreview
                  ? 'Previewing your new photo — save to apply it.'
                  : 'Click your photo to change it. JPEG, PNG, WebP or GIF, up to 5 MB.'}
              </p>
            </div>
          </div>
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-sm text-slate-400 mb-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input type="text" value={name} onChange={e => setName(e.target.value)}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-white focus:outline-none focus:border-blue-500"
                  placeholder="Your full name" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-slate-400 mb-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 text-slate-500" size={16} />
                <input type="email" value={user?.email || ''} disabled
                  className="w-full bg-slate-700/50 border border-slate-600 rounded-lg pl-9 pr-4 py-2 text-slate-400 cursor-not-allowed" />
              </div>
              <p className="text-xs text-slate-500 mt-1">Email cannot be changed</p>
            </div>
            <button type="submit" disabled={saving}
              className="flex items-center gap-2 px-6 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg font-semibold transition">
              <Save size={16} />
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        </div>

        {/* Stats Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <h2 className="font-bold text-lg mb-4">Your Stats</h2>
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-3xl font-bold text-blue-400">{user?.books?.length || 0}</div>
              <div className="text-slate-400 text-sm">Books Created</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-400">
                {user?.books?.reduce((acc: number, b: any) => acc + (b.chapters?.length || 0), 0) || 0}
              </div>
              <div className="text-slate-400 text-sm">Chapters Written</div>
            </div>
            <div>
              <div className="text-3xl font-bold text-blue-400">{user?.plan || 'FREE'}</div>
              <div className="text-slate-400 text-sm">Current Plan</div>
            </div>
          </div>
        </div>

        {/* Subscription Card */}
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-bold text-lg mb-1">Subscription Plan</h2>
              <p className="text-slate-400 text-sm">Manage your plan and billing</p>
            </div>
            <Link href="/account/subscription"
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm font-semibold transition">
              <Zap size={14} /> Manage Plan
            </Link>
          </div>
        </div>

        {/* Danger Zone */}
        <div className="bg-slate-800 border border-red-900 rounded-xl p-6">
          <h2 className="font-bold text-lg text-red-400 mb-4">Danger Zone</h2>
          <p className="text-slate-400 text-sm mb-4">Once you delete your account, all your books will be permanently deleted.</p>
          <button className="px-4 py-2 border border-red-700 text-red-400 hover:bg-red-900/30 rounded-lg text-sm transition">
            Delete Account
          </button>
        </div>
      </div>
    </div>
  );
}
