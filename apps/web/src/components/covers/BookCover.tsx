'use client';

import { useState } from 'react';
import { BookOpen } from 'lucide-react';

interface BookCoverProps {
  /** The book's coverUrl. Falsy shows the placeholder. */
  url?: string | null;
  /** Used for alt text and shown on the placeholder. */
  title?: string;
  className?: string;
  /** Placeholder icon size. */
  iconSize?: number;
  /** Show the title on the placeholder (useful at larger sizes). */
  showTitle?: boolean;
}

/**
 * A book's cover at a fixed 2:3 ratio, or the old BookOpen placeholder when the
 * book has none (or its image fails to load). Every page that shows a book uses
 * this, so covers look the same everywhere.
 */
export default function BookCover({ url, title, className = '', iconSize = 32, showTitle = false }: BookCoverProps) {
  const [failed, setFailed] = useState(false);

  if (url && !failed) {
    return (
      // A plain <img>: covers are already sized PNGs on a public bucket, so
      // next/image's optimiser would add a hop without saving anything.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={title ? `Cover of ${title}` : 'Book cover'}
        loading="lazy"
        onError={() => setFailed(true)}
        className={`aspect-[2/3] object-cover bg-slate-800 ${className}`}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={title ? `${title} (no cover)` : 'No cover'}
      className={`aspect-[2/3] bg-gradient-to-br from-blue-900 to-slate-800 flex flex-col items-center justify-center gap-2 p-3 text-center ${className}`}
    >
      <BookOpen className="text-blue-400 opacity-60" size={iconSize} />
      {showTitle && title && (
        <span className="text-slate-300 text-xs font-semibold line-clamp-3">{title}</span>
      )}
    </div>
  );
}
