'use client';

import { authHeader } from './auth';
import { API_URL } from './config';

/**
 * Editor-side AI. Everything here is Claude working on text the author already
 * has, which is included in the book's cost — nothing here bills credits.
 */

export type AssistAction = 'tighten' | 'expand' | 'concrete' | 'simplify' | 'voice' | 'continue';

export const ASSIST_LABELS: { action: AssistAction; label: string; hint: string }[] = [
  { action: 'tighten',  label: 'Tighten',       hint: 'Same meaning, fewer words' },
  { action: 'expand',   label: 'Expand',        hint: 'Develop it one step further' },
  { action: 'concrete', label: 'Make concrete', hint: 'Swap abstraction for specifics' },
  { action: 'simplify', label: 'Simplify',      hint: 'For a reader outside the field' },
  { action: 'voice',    label: 'In my voice',   hint: 'Match how you write' },
];

export interface ShapeReport {
  summary: string;
  gaps: string[];
  suggestedNext?: { title: string; why: string };
}

async function post<T>(path: string, body: unknown): Promise<T> {
  const headers = await authHeader();
  if (!headers.Authorization) throw new Error('Please sign in again.');

  const res = await fetch(`${API_URL}${path}`, {
    method: 'POST',
    headers: { ...headers, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    let message = 'That did not work. Try again.';
    try {
      const err = await res.json();
      message = Array.isArray(err?.message) ? err.message[0] : err?.message || message;
    } catch { /* non-JSON error body */ }
    // 429 comes from the throttler; say something useful rather than the raw code.
    if (res.status === 429) message = 'Slow down a moment — too many requests in a row.';
    throw new Error(message);
  }
  return res.json();
}

export async function assist(
  action: AssistAction,
  text: string,
  context?: { bookTitle?: string; tone?: string; voiceSample?: string },
): Promise<string> {
  const { text: out } = await post<{ text: string }>('/api/books/assist', { action, text, ...context });
  return out;
}

export async function describeShape(bookId: string): Promise<ShapeReport> {
  return post<ShapeReport>(`/api/books/${bookId}/shape`, {});
}
