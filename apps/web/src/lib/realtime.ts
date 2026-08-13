'use client';

import { authHeader } from './auth';
import { API_URL } from './config';

/**
 * Polling primitives for live data.
 *
 * Each subscribe function returns an unsubscribe function. Keeping that shape
 * uniform means the transport underneath can be swapped for SSE or WebSockets
 * later without touching a single call site.
 */

export type Unsubscribe = () => void;

interface PollOptions<T> {
  /** Milliseconds between polls while the tab is visible. */
  interval: number;
  /** Fetch one round. Return `undefined` to signal "nothing new". */
  fetcher: () => Promise<T | undefined>;
  /** Called for each non-undefined result. */
  onData: (data: T) => void;
  onError?: (err: unknown) => void;
}

/**
 * Runs `fetcher` on an interval until unsubscribed.
 *
 * - Pauses entirely while the tab is hidden, and fires once immediately on
 *   return, so a backgrounded tab costs nothing.
 * - Never overlaps requests: a slow round delays the next one rather than
 *   stacking up behind it.
 * - Backs off on consecutive failures (up to 30s) so an API outage doesn't turn
 *   every open tab into a retry storm.
 */
export function poll<T>({ interval, fetcher, onData, onError }: PollOptions<T>): Unsubscribe {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;

  const delay = () => {
    if (failures === 0) return interval;
    return Math.min(interval * 2 ** failures, 30_000);
  };

  const schedule = () => {
    if (stopped) return;
    timer = setTimeout(run, delay());
  };

  const run = async () => {
    if (stopped) return;
    if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
      schedule();
      return;
    }
    try {
      const data = await fetcher();
      failures = 0;
      if (!stopped && data !== undefined) onData(data);
    } catch (err) {
      failures = Math.min(failures + 1, 5);
      onError?.(err);
    }
    schedule();
  };

  const onVisible = () => {
    if (document.visibilityState === 'visible' && !stopped) {
      if (timer) clearTimeout(timer);
      failures = 0;
      run();
    }
  };

  run();
  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisible);
  }

  return () => {
    stopped = true;
    if (timer) clearTimeout(timer);
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisible);
    }
  };
}

/** Authenticated GET returning parsed JSON, or null on any failure. */
export async function authedGet<T>(path: string): Promise<T | null> {
  const headers = await authHeader();
  if (!headers.Authorization) return null;
  const res = await fetch(`${API_URL}${path}`, { headers });
  if (!res.ok) return null;
  return (await res.json()) as T;
}

// ─── Chat ───────────────────────────────────────────────────────────────────

export interface ChatMessage {
  id: string;
  content: string;
  senderId: string;
  createdAt: string;
  sender?: { id: string; name: string | null; avatarUrl: string | null; profilePhoto?: string | null };
}

/**
 * Streams new messages in a conversation. Only messages newer than the latest
 * already seen come back, so every poll after the first is near-empty.
 */
export function subscribeToMessages(
  conversationId: string,
  onMessages: (messages: ChatMessage[]) => void,
  intervalMs: number,
  initialSince?: string,
): Unsubscribe {
  let since = initialSince;

  return poll<ChatMessage[]>({
    interval: intervalMs,
    fetcher: async () => {
      const query = since ? `?since=${encodeURIComponent(since)}` : '';
      const data = await authedGet<ChatMessage[]>(
        `/api/social/conversations/${conversationId}/messages${query}`,
      );
      if (!data || data.length === 0) return undefined;
      since = data[data.length - 1].createdAt;
      return data;
    },
    onData: onMessages,
  });
}

// ─── Presence ───────────────────────────────────────────────────────────────

/** Online status for the given users, refreshed on an interval. */
export function subscribeToPresence(
  userIds: () => string[],
  onPresence: (online: Record<string, boolean>) => void,
  intervalMs: number,
): Unsubscribe {
  return poll<Record<string, boolean>>({
    interval: intervalMs,
    fetcher: async () => {
      const ids = userIds();
      if (!ids.length) return undefined;
      const data = await authedGet<Record<string, boolean>>(
        `/api/users/presence?ids=${encodeURIComponent(ids.join(','))}`,
      );
      return data ?? undefined;
    },
    onData: onPresence,
  });
}

// ─── Collaborative editor ───────────────────────────────────────────────────

export interface EditorSyncState {
  /** Null when the caller is already current, or made the last edit itself. */
  content: string | null;
  updatedAt: string;
  updatedById: string | null;
  activeUsers: { userId: string; name: string; avatarUrl: string | null }[];
}

/**
 * Chapter body plus the list of people currently editing it. The same request
 * doubles as this editor's presence heartbeat.
 */
export function subscribeToChapter(
  bookId: string,
  chapterId: string,
  onSync: (state: EditorSyncState) => void,
  intervalMs: number,
): Unsubscribe {
  let since: string | undefined;

  return poll<EditorSyncState>({
    interval: intervalMs,
    fetcher: async () => {
      const query = since ? `?since=${encodeURIComponent(since)}` : '';
      const data = await authedGet<EditorSyncState>(
        `/api/books/${bookId}/chapters/${chapterId}/sync${query}`,
      );
      if (!data) return undefined;
      since = data.updatedAt;
      return data;
    },
    onData: onSync,
  });
}

/** Best-effort departure notice, so collaborators drop out promptly. */
export async function leaveChapter(bookId: string, chapterId: string): Promise<void> {
  try {
    const headers = await authHeader();
    if (!headers.Authorization) return;
    await fetch(`${API_URL}/api/books/${bookId}/chapters/${chapterId}/presence`, {
      method: 'DELETE',
      headers,
      keepalive: true,
    });
  } catch {
    /* the presence window expires it anyway */
  }
}
