'use client';

interface Props {
  readCount: number;
  totalChapters: number;
  /** Slim version for cards, such as the Library grid. */
  compact?: boolean;
}

export default function ReadingProgressBar({ readCount, totalChapters, compact = false }: Props) {
  if (totalChapters === 0) return null;
  const percent = Math.round((readCount / totalChapters) * 100);
  const finished = readCount >= totalChapters;

  const bar = (
    <div
      className={`${compact ? 'h-1.5' : 'h-2'} bg-slate-700 rounded-full overflow-hidden`}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={totalChapters}
      aria-valuenow={readCount}
      aria-label="Reading progress"
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${finished ? 'bg-green-500' : 'bg-blue-500'}`}
        style={{ width: `${percent}%` }}
      />
    </div>
  );

  if (compact) {
    return (
      <div>
        <div className="flex items-center justify-between mb-1 text-xs">
          <span className={finished ? 'text-green-400' : 'text-slate-400'}>
            {finished ? 'Finished' : readCount === 0 ? 'Not started' : `${readCount} of ${totalChapters} chapters`}
          </span>
          <span className="text-slate-500">{percent}%</span>
        </div>
        {bar}
      </div>
    );
  }

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2 text-sm">
        <span className="font-semibold text-slate-300">Your progress</span>
        <span className={finished ? 'text-green-400' : 'text-slate-400'}>
          {finished ? 'Finished! ' : ''}
          {readCount} of {totalChapters} chapter{totalChapters === 1 ? '' : 's'} read · {percent}%
        </span>
      </div>
      {bar}
    </div>
  );
}
