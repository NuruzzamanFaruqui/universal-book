'use client';

import { CheckCircle, Circle } from 'lucide-react';

interface Props {
  chapterId: string;
  isRead: boolean;
  onToggle: (chapterId: string, isRead: boolean) => void;
}

/**
 * Sits at the top of an open chapter, so marking it unread never leaves the
 * reader parked on the chapter's end (where it would be auto-marked again).
 */
export default function MarkAsReadButton({ chapterId, isRead, onToggle }: Props) {
  return (
    <div className="mb-4 flex items-center justify-end">
      <button
        type="button"
        onClick={() => onToggle(chapterId, !isRead)}
        aria-pressed={isRead}
        className={`flex items-center gap-2 text-sm px-3 py-1.5 rounded-lg border transition ${
          isRead
            ? 'bg-green-900/30 border-green-700 text-green-300 hover:bg-green-900/50'
            : 'bg-slate-800 border-slate-600 text-slate-300 hover:bg-slate-700'
        }`}
      >
        {isRead ? <CheckCircle size={16} /> : <Circle size={16} />}
        {isRead ? 'Read — mark as unread' : 'Mark as read'}
      </button>
    </div>
  );
}
