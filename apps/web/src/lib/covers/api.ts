import { API_URL } from '../config';
import { getToken } from '../auth';

async function authHeader(): Promise<Record<string, string>> {
  const token = await getToken();
  if (!token) throw new Error('Sign in to save a cover.');
  return { Authorization: `Bearer ${token}` };
}

async function errorMessage(res: Response, fallback: string) {
  const body = await res.json().catch(() => null);
  const msg = Array.isArray(body?.message) ? body.message.join(' ') : body?.message;
  return msg || `${fallback} (${res.status})`;
}

/** Client for the API's cover routes. */
export const CoversApi = {
  /** Uploads a PNG to storage. Returns its public URL; does not change the book. */
  async upload(bookId: string, png: Blob): Promise<string> {
    const form = new FormData();
    form.append('file', png, 'cover.png');
    const res = await fetch(`${API_URL}/api/books/${bookId}/cover`, {
      method: 'POST',
      headers: await authHeader(),
      body: form,
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Cover upload failed'));
    const { url } = await res.json();
    return url;
  },

  /** Sets (or, with null, clears) the book's coverUrl via PUT /books/:id. */
  async setCoverUrl(bookId: string, coverUrl: string | null): Promise<void> {
    const res = await fetch(`${API_URL}/api/books/${bookId}`, {
      method: 'PUT',
      headers: { ...(await authHeader()), 'Content-Type': 'application/json' },
      body: JSON.stringify({ coverUrl }),
    });
    if (!res.ok) throw new Error(await errorMessage(res, 'Could not save the cover'));
  },
};
