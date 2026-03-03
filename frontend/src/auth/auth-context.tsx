/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from "react";
import { api } from "../lib/api";
import type { AuthUser } from "../types/api";

const ACCESS_TOKEN_KEY = "ecommerce_access_token";
const USER_KEY = "ecommerce_user";

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getInitialUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) {
    return null;
  }
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function getInitialToken(): string | null {
  return localStorage.getItem(ACCESS_TOKEN_KEY);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => getInitialUser());
  const [token, setToken] = useState<string | null>(() => getInitialToken());

  const persist = useCallback((nextToken: string, nextUser: AuthUser): void => {
    setToken(nextToken);
    setUser(nextUser);
    localStorage.setItem(ACCESS_TOKEN_KEY, nextToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  }, []);

  const signIn = useCallback(
    async (email: string, password: string): Promise<void> => {
      const response = await api.login(email, password);
      persist(response.accessToken, response.user);
    },
    [persist]
  );

  const signUp = useCallback(
    async (email: string, password: string): Promise<void> => {
      await api.register(email, password);
      const response = await api.login(email, password);
      persist(response.accessToken, response.user);
    },
    [persist]
  );

  const signOut = useCallback((): void => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: Boolean(user && token),
      signIn,
      signUp,
      signOut
    }),
    [user, token, signIn, signUp, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within AuthProvider");
  }
  return context;
}
