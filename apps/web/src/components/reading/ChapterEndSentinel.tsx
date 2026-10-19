'use client';

import { useAutoMarkRead } from './useAutoMarkRead';

interface Props {
  /** False once the chapter is read, or after the reader unmarked it this visit. */
  enabled: boolean;
  onReachEnd: () => void;
}

/** Invisible marker after the chapter text; reaching it marks the chapter read. */
export default function ChapterEndSentinel({ enabled, onReachEnd }: Props) {
  const sentinelRef = useAutoMarkRead(onReachEnd, enabled);
  return <div ref={sentinelRef} aria-hidden className="h-px w-full" />;
}
