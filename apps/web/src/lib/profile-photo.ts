'use client';

import { useSyncExternalStore } from 'react';

/**
 * Live profile-photo updates.
 *
 * Avatars across the app are rendered from user objects that each page fetched
 * for itself (AppNav, the feed, chat, …). After an upload those copies are
 * stale, so rather than refetching everywhere, the uploader publishes the new
 * URL here and every <Avatar> for that user id switches to it immediately —
 * in this tab and, via BroadcastChannel, in any other open tab.
 */

/** Largest accepted photo; mirrors PROFILE_PHOTO_MAX_BYTES in the API. */
export const PROFILE_PHOTO_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

type Listener = () => void;

// userId → latest photo URL (null = photo removed). Absent = no override.
const overrides = new Map<string, string | null>();
const listeners = new Set<Listener>();

let channel: BroadcastChannel | null = null;
let channelReady = false;

function emit() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* one broken listener must not stop the others */
    }
  });
}

function ensureChannel() {
  if (channelReady || typeof window === 'undefined') return;
  channelReady = true;
  if (typeof BroadcastChannel === 'undefined') return;
  try {
    channel = new BroadcastChannel('ub-profile-photo');
    channel.onmessage = (e: MessageEvent) => {
      const { userId, url } = (e.data || {}) as { userId?: string; url?: string | null };
      if (!userId) return;
      overrides.set(userId, url ?? null);
      emit();
    };
  } catch {
    channel = null;
  }
}

function subscribe(fn: Listener): () => void {
  ensureChannel();
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

/** Announce a user's new photo URL to every avatar on the page (and other tabs). */
export function publishProfilePhoto(userId: string, url: string | null) {
  overrides.set(userId, url);
  emit();
  ensureChannel();
  try {
    channel?.postMessage({ userId, url });
  } catch {
    /* cross-tab sync is best-effort */
  }
}

/** Subscribe outside React (e.g. to patch a cached user object). */
export function onProfilePhotoChange(fn: (userId: string, url: string | null) => void): () => void {
  const seen = new Map(overrides);
  return subscribe(() => {
    overrides.forEach((url, id) => {
      if (seen.get(id) !== url || !seen.has(id)) {
        seen.set(id, url);
        fn(id, url);
      }
    });
  });
}

/**
 * The newest photo published for `userId` during this session, or `undefined`
 * if none has been — in which case the caller's own data is current.
 */
export function useProfilePhotoOverride(userId?: string | null): string | null | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (userId ? overrides.get(userId) : undefined),
    () => undefined,
  );
}
