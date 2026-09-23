/**
 * Single source of truth for the API origin.
 *
 * Next.js substitutes NEXT_PUBLIC_* at build time, so the chosen value is baked
 * into the static bundle — which is the property this needs. Locally,
 * apps/web/.env.local sets it to http://localhost:8080.
 *
 * The fallback is the production origin, so a Cloud Run build that does not
 * pass NEXT_PUBLIC_API_URL behaves exactly as it always has. Never set this
 * variable to a localhost value in a deploy environment.
 */
export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || 'https://api.universal-book.com';

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
