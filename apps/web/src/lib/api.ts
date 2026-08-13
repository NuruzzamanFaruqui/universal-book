import axios from 'axios';
import { API_URL } from './config';
import { getToken } from './auth';

const api = axios.create({
  baseURL: API_URL,
});

/**
 * Attaches the bearer token, refreshing it first if it has expired.
 *
 * getToken() reads from storage synchronously and only awaits when a refresh is
 * genuinely due, so there is no window during startup where a request goes out
 * unauthenticated.
 */
api.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined') return config;
  const token = await getToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

export { API_URL };
export default api;
