'use client';

import { useState } from 'react';
import { useProfilePhotoOverride } from '@/lib/profile-photo';

export interface AvatarUser {
  id?: string | null;
  name?: string | null;
  email?: string | null;
  profilePhoto?: string | null;
  avatarUrl?: string | null;
}

interface AvatarProps {
  user?: AvatarUser | null;
  /** Size, text size and any layout classes, e.g. "w-8 h-8 text-sm shrink-0". */
  className?: string;
  /** Colours for the initial-letter fallback. */
  fallbackClassName?: string;
  /** Overrides the photo, e.g. a local preview before upload. */
  src?: string | null;
  alt?: string;
}

export function avatarInitial(user?: AvatarUser | null): string {
  return (
    user?.name?.trim()?.[0]?.toUpperCase() ||
    user?.email?.trim()?.[0]?.toUpperCase() ||
    '?'
  );
}

/**
 * Circular user avatar: the profile photo when there is one, otherwise the
 * first letter of the user's name on a coloured disc. Picks up a newly
 * uploaded photo immediately via lib/profile-photo.
 */
export default function Avatar({
  user,
  className = 'w-8 h-8 text-sm',
  fallbackClassName = 'bg-blue-600 text-white',
  src,
  alt = '',
}: AvatarProps) {
  const override = useProfilePhotoOverride(user?.id);
  const photo =
    src !== undefined && src !== null
      ? src
      : override !== undefined
        ? override
        : user?.profilePhoto || user?.avatarUrl || null;

  // Remember which URL failed so a later, different URL still gets a try.
  const [failedSrc, setFailedSrc] = useState<string | null>(null);

  if (photo && photo !== failedSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- remote GCS URLs, no next/image domain config
      <img
        src={photo}
        alt={alt}
        className={`rounded-full object-cover bg-slate-700 ${className}`}
        onError={() => setFailedSrc(photo)}
        referrerPolicy="no-referrer"
        draggable={false}
      />
    );
  }

  return (
    <div
      className={`rounded-full flex items-center justify-center font-bold select-none ${fallbackClassName} ${className}`}
      aria-hidden={alt ? undefined : true}
      aria-label={alt || undefined}
    >
      {avatarInitial(user)}
    </div>
  );
}
