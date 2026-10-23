'use client';

/**
 * Opens a conversation in the floating chat widget from anywhere on the page.
 *
 * The widget (components/MessagingWidget.tsx) listens for this event and calls
 * preventDefault() once it has taken the conversation. It is not mounted on
 * every route — it hides on the editor and while signed out — so callers get
 * `false` back when nothing handled it and can fall back to /messages/:id.
 */
export const OPEN_CHAT_EVENT = 'ub:open-chat';

export function openChatWindow(conversation: { id: string }): boolean {
  if (typeof window === 'undefined') return false;
  const event = new CustomEvent(OPEN_CHAT_EVENT, { detail: conversation, cancelable: true });
  // dispatchEvent returns false when a listener called preventDefault().
  return !window.dispatchEvent(event);
}
