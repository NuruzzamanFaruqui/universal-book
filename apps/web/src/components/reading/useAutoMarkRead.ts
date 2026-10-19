'use client';

import { useEffect, useRef } from 'react';

/**
 * Calls onIntersect once, the first time the returned sentinel element scrolls
 * into view. Place the sentinel after the chapter text so reaching the end of
 * the chapter counts as reading it.
 *
 * Only ever marks read: scrolling back up never undoes anything.
 */
export function useAutoMarkRead(onIntersect: () => void, enabled: boolean) {
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  // Keep the latest callback without re-creating the observer on every render.
  const callbackRef = useRef(onIntersect);
  callbackRef.current = onIntersect;

  useEffect(() => {
    const el = sentinelRef.current;
    if (!enabled || !el || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          callbackRef.current();
        }
      },
      { threshold: 1 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [enabled]);

  return sentinelRef;
}
