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


// ─── Whole-book operations ──────────────────────────────────────────────────

export interface BookMetadata {
  genre: string;
  subGenre?: string;
  audience: string;
  tone: string;
  titles: string[];
  synopsis: string;
  keywords: string[];
}

export interface ReviewReport {
  continuity: { severity: 'high' | 'low'; chapter?: number; issue: string }[];
  voice: string;
  whereYouLeftOff?: { chapter: number; note: string };
  pacing: {
    averageWords: number;
    chapters: number;
    outliers: { number: number; title: string; words: number }[];
  };
}

/** Genre, audience, titles and a blurb, read out of what has been written. */
export async function inferMetadata(bookId: string): Promise<BookMetadata> {
  return post<BookMetadata>(`/api/books/${bookId}/infer`, {});
}

/** Continuity, voice and pacing across the whole manuscript. */
export async function reviewBook(bookId: string): Promise<ReviewReport> {
  return post<ReviewReport>(`/api/books/${bookId}/review`, {});
}

/** Title page, copyright, contents, about the author, acknowledgements. */
export async function generateMatter(bookId: string): Promise<{ created: number }> {
  return post<{ created: number }>(`/api/books/${bookId}/matter`, {});
}


// ─── Chapters ───────────────────────────────────────────────────────────────

async function send<T>(path: string, method: string, body?: unknown): Promise<T> {
  const headers = await authHeader();
  if (!headers.Authorization) throw new Error('Please sign in again.');
  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: { ...headers, 'Content-Type': 'application/json' },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  if (!res.ok) {
    let message = 'That did not work. Try again.';
    try {
      const err = await res.json();
      message = Array.isArray(err?.message) ? err.message[0] : err?.message || message;
    } catch { /* non-JSON error body */ }
    throw new Error(message);
  }
  return res.json();
}

export const addChapter = (bookId: string, afterId?: string) =>
  send<any>(`/api/books/${bookId}/chapters`, 'POST', { afterId });

export const renameChapter = (
  bookId: string, chapterId: string, data: { title?: string; subtitle?: string },
) => send<any>(`/api/books/${bookId}/chapters/${chapterId}/title`, 'PUT', data);

export interface ContentsEntry {
  id: string;
  number: number;
  title: string;
  subtitle: string | null;
  sections: { level: number; label: string; title: string; id: string }[];
}

/** The Contents, derived from the manuscript rather than stored. */
export async function fetchContents(bookId: string): Promise<ContentsEntry[]> {
  const headers = await authHeader();
  const res = await fetch(`${API_URL}/api/books/${bookId}/contents`, { headers });
  if (!res.ok) return [];
  return (await res.json()).chapters ?? [];
}

export const deleteChapter = (bookId: string, chapterId: string) =>
  send<any>(`/api/books/${bookId}/chapters/${chapterId}`, 'DELETE');

export const reorderChapters = (bookId: string, orderedIds: string[]) =>
  send<any>(`/api/books/${bookId}/chapters/order`, 'PUT', { orderedIds });

/** Shapes the author's own notes into a chapter. Included, not billed. */
export const draftFromNotes = (bookId: string, chapterId: string, notes: string) =>
  send<any>(`/api/books/${bookId}/chapters/${chapterId}/from-notes`, 'POST', { notes });
