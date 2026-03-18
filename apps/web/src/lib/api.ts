import axios from 'axios';

const API_URL = "https://api.universal-book.com";

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use(async (config) => {
  if (typeof window === 'undefined') return config;
  try {
    const { auth } = await import('@/lib/firebase');
    if (!auth) return config;
    const user = auth.currentUser;
    if (user) {
      const token = await user.getIdToken();
      config.headers.Authorization = `Bearer ${token}`;
    }
  } catch (e) {}
  return config;
});

export { API_URL };
export default api;
