import { API_URL } from './config';
import { getToken } from './auth';

export interface BookProgress {
  bookId: string;
  readCount: number;
  totalChapters: number;
  readChapterIds: string[];
}

/** Per-book counts for the Library page. */
export type LibraryProgress = Omit<BookProgress, 'readChapterIds'>;

async function request<T = BookProgress>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Sign in to track your reading progress.');

  const res = await fetch(`${API_URL}/api/reading-progress${path}`, {
    ...init,
    headers: {
      ...(init.headers || {}),
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.message || `Reading progress request failed (${res.status})`);
  }
  return res.json();
}

/** Client for the API's /reading-progress routes. */
export const ReadingProgressApi = {
  getBookProgress(bookId: string) {
    return request(`/books/${bookId}`);
  },

  /** Returns the book's progress after the change, so callers can just replace their state. */
  setChapterRead(bookId: string, chapterId: string, isRead: boolean) {
    return request(`/books/${bookId}/chapters/${chapterId}`, {
      method: 'PUT',
      body: JSON.stringify({ isRead }),
    });
  },

  /** Progress for every book the user has bought. */
  getLibraryProgress() {
    return request<LibraryProgress[]>('/library');
  },
};
