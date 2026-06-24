"use client";

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import type { AuthUser, UserRole } from "@/lib/timeline/types";
import { canWriteRole } from "@/lib/auth/permissions";
import { DEFAULT_ADMIN } from "@/lib/auth/constants";

export { DEFAULT_ADMIN };

const AUTH_CHANGE_EVENT = "order-tracking-auth-change";

interface AuthContextValue {
  user: AuthUser | null;
  authReady: boolean;
  isAdmin: boolean;
  canWrite: boolean;
  login: (username: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
  canManageOwner: (owner: string) => boolean;
  members: AuthUser[];
  setMembersFromOwners: (owners: string[]) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

let cachedUser: AuthUser | null | undefined = undefined;
let fetchPromise: Promise<AuthUser | null> | null = null;

async function fetchSessionUser(): Promise<AuthUser | null> {
  const res = await fetch("/api/auth/session", { credentials: "same-origin" });
  if (!res.ok) return null;
  const data = (await res.json()) as { user: AuthUser | null };
  return data.user ?? null;
}

function loadSessionSnapshot(): AuthUser | null {
  if (cachedUser !== undefined) return cachedUser;
  if (typeof window === "undefined") return null;
  if (!fetchPromise) {
    fetchPromise = fetchSessionUser()
      .then((user) => {
        cachedUser = user;
        return user;
      })
      .finally(() => {
        fetchPromise = null;
      });
  }
  return null;
}

function subscribeAuthStore(onStoreChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onCustom = () => {
    cachedUser = undefined;
    void fetchSessionUser().then((user) => {
      cachedUser = user;
      onStoreChange();
    });
  };
  window.addEventListener(AUTH_CHANGE_EVENT, onCustom);
  if (cachedUser === undefined) {
    void fetchSessionUser().then((user) => {
      cachedUser = user;
      onStoreChange();
    });
  }
  return () => window.removeEventListener(AUTH_CHANGE_EVENT, onCustom);
}

function getStoredUserSnapshot(): AuthUser | null {
  if (typeof window === "undefined") return null;
  if (cachedUser !== undefined) return cachedUser;
  loadSessionSnapshot();
  return null;
}

function emitAuthStoreChange() {
  cachedUser = undefined;
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
  }
}

function getAuthReadySnapshot(): boolean {
  if (typeof window === "undefined") return false;
  return cachedUser !== undefined;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useSyncExternalStore(
    subscribeAuthStore,
    getStoredUserSnapshot,
    () => null
  );
  const authReady = useSyncExternalStore(
    subscribeAuthStore,
    getAuthReadySnapshot,
    () => false
  );
  const [memberUsers, setMemberUsers] = useState<AuthUser[]>([]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch("/api/auth/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify({ mode: "password", username, password }),
    });
    const data = (await res.json()) as { error?: string };
    if (!res.ok) return data.error ?? "登录失败";
    emitAuthStoreChange();
    return null;
  }, []);

  const logout = useCallback(async () => {
    await fetch("/api/auth/session", { method: "DELETE", credentials: "same-origin" });
    emitAuthStoreChange();
  }, []);

  const setMembersFromOwners = useCallback((owners: string[]) => {
    const unique = [...new Set(owners.filter(Boolean))].sort();
    setMemberUsers(
      unique.map((name, i) => ({
        id: `member-${i}`,
        name,
        role: "member" as UserRole,
        department: "设计部",
      }))
    );
  }, []);

  const canManageOwner = useCallback(
    (owner: string) => {
      if (!user) return false;
      if (user.role === "admin") return true;
      return user.name === owner;
    },
    [user]
  );

  const members = useMemo(() => memberUsers, [memberUsers]);

  const value = useMemo(
    () => ({
      user,
      authReady,
      isAdmin: user?.role === "admin",
      canWrite: canWriteRole(user?.role),
      login,
      logout,
      canManageOwner,
      members,
      setMembersFromOwners,
    }),
    [user, authReady, login, logout, canManageOwner, members, setMembersFromOwners]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
