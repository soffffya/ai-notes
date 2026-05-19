import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type PropsWithChildren,
} from 'react';
import { apiFetch } from '@/api/client';
import type { AuthResponse, AuthUser } from '@/types/auth';

type AuthMode = 'login' | 'register';

type AuthContextValue = {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  isReady: boolean;
  mode: AuthMode;
  isAuthenticated: boolean;
  setMode: (mode: AuthMode) => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const TOKEN_KEY = 'accessToken';
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [isLoading, setIsLoading] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [mode, setMode] = useState<AuthMode>('login');

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      if (!accessToken) {
        setIsReady(true);
        return;
      }

      setIsLoading(true);

      try {
        const nextUser = await apiFetch<AuthUser>('/auth/me');
        if (!cancelled) {
          setUser(nextUser);
        }
      } catch {
        if (!cancelled) {
          setUser(null);
          setAccessToken(null);
          localStorage.removeItem(TOKEN_KEY);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
          setIsReady(true);
        }
      }
    }

    void hydrate();

    return () => {
      cancelled = true;
    };
  }, [accessToken]);

  async function authenticate(path: string, email: string, password: string) {
    setIsLoading(true);

    try {
      const response = await apiFetch<AuthResponse>(path, {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });

      setAccessToken(response.accessToken);
      setUser(response.user);
      localStorage.setItem(TOKEN_KEY, response.accessToken);
      setIsReady(true);
    } finally {
      setIsLoading(false);
    }
  }

  function logout() {
    setUser(null);
    setAccessToken(null);
    localStorage.removeItem(TOKEN_KEY);
    setIsReady(true);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      accessToken,
      isLoading,
      isReady,
      mode,
      isAuthenticated: Boolean(accessToken && user),
      setMode,
      login: (email, password) => authenticate('/auth/login', email, password),
      register: (email, password) => authenticate('/auth/register', email, password),
      logout,
    }),
    [accessToken, isLoading, isReady, mode, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return context;
}
