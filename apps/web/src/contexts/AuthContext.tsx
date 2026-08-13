'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  AuthUser,
  fetchMe,
  getStoredToken,
  getToken,
  logout as doLogout,
  onAuthChange,
} from '@/lib/auth';
import { API_URL, HEARTBEAT_MS } from '@/lib/config';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  isLoggedIn: boolean;
  getToken: () => Promise<string | null>;
  refreshUser: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isLoggedIn: false,
  getToken: async () => null,
  refreshUser: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    // No token at all — settle immediately rather than making a doomed request.
    if (!getStoredToken()) {
      if (mounted.current) {
        setUser(null);
        setLoading(false);
      }
      return;
    }
    const me = await fetchMe();
    if (mounted.current) {
      setUser(me);
      setLoading(false);
    }
  }, []);

  // Initial resolve, plus re-resolve whenever tokens change — sign in, sign out,
  // or another tab doing either.
  useEffect(() => {
    mounted.current = true;
    load();
    const unsubscribe = onAuthChange(() => {
      load();
    });
    return () => {
      mounted.current = false;
      unsubscribe();
    };
  }, [load]);

  // Presence heartbeat. Pauses on a hidden tab, so a forgotten background tab
  // doesn't keep someone showing as online for hours.
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const beat = async () => {
      if (cancelled || document.visibilityState !== 'visible') return;
      const token = await getToken();
      if (!token || cancelled) return;
      try {
        await fetch(`${API_URL}/api/users/heartbeat`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        });
      } catch {
        /* presence is best-effort */
      }
    };

    beat();
    const interval = setInterval(beat, HEARTBEAT_MS);
    document.addEventListener('visibilitychange', beat);
    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', beat);
    };
  }, [user]);

  const logout = useCallback(async () => {
    await doLogout();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isLoggedIn: !!user,
        getToken,
        refreshUser: load,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
