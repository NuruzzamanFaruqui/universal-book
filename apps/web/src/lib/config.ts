/**
 * Single source of truth for the API origin.
 *
 * A literal rather than a process.env read: Next.js substitutes NEXT_PUBLIC_*
 * at build time, and the value has to survive into the static bundle.
 */
export const API_URL = 'https://api.universal-book.com';

/** Client polling cadences, in milliseconds. */
export const POLL = {
  /** Active chat thread. */
  messages: 3_000,
  /** Conversation list / unread badges. */
  conversations: 10_000,
  /** Online indicators. */
  presence: 20_000,
  /** Collaborative editor content + active users. */
  editor: 4_000,
  /** Notification bell. */
  notifications: 30_000,
} as const;

/** How often a signed-in tab reports itself alive. Must stay under the
 *  server's PRESENCE_WINDOW_MS (75s), with room for one dropped beat. */
export const HEARTBEAT_MS = 30_000;
