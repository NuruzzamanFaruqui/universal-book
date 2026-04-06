'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isLoggedIn: boolean;
  getToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  isLoggedIn: false,
  getToken: async () => null,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    let unsubscribe: () => void;

    const initAuth = async () => {
      const { onAuthStateChanged } = await import('firebase/auth');
      const { auth } = await import('@/lib/firebase');
      if (!auth) { setLoading(false); return; }
      unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
        setUser(firebaseUser);
        setLoading(false);
        // Keep localStorage in sync for legacy pages
        if (firebaseUser) {
          firebaseUser.getIdToken().then(token => {
            localStorage.setItem('ub_token', token);
          });
        } else {
          localStorage.removeItem('ub_token');
        }
      });
    };

    initAuth();
    return () => { if (unsubscribe) unsubscribe(); };
  }, []);

  const getToken = async (): Promise<string | null> => {
    if (!user) return null;
    try {
      return await user.getIdToken(true);
    } catch {
      return null;
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, isLoggedIn: !!user, getToken }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);