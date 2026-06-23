"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { AuthUser, UserRole } from "@/lib/timeline/types";
import { canWriteRole, syncAuthRoleCookie } from "@/lib/auth/permissions";

const AUTH_STORAGE_KEY = "order-tracking-auth-v1";

export const DEFAULT_ADMIN: AuthUser = {
  id: "admin",
  name: "管理员",
  role: "admin",
  department: "管理部",
};

export const DEFAULT_GUEST: AuthUser = {
  id: "guest",
  name: "游客",
  role: "guest",
  department: "访客",
};

interface AuthContextValue {
  user: AuthUser | null;
  isAdmin: boolean;
  isGuest: boolean;
  /** 是否允许写入（游客为 false；未登录仍为 true） */
  canWrite: boolean;
  login: (user: AuthUser) => void;
  logout: () => void;
  canManageOwner: (owner: string) => boolean;
  members: AuthUser[];
  setMembersFromOwners: (owners: string[]) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === "undefined") return null;
    return loadStoredUser();
  });
  const [memberUsers, setMemberUsers] = useState<AuthUser[]>([]);

  const login = useCallback((next: AuthUser) => {
    setUser(next);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(next));
    syncAuthRoleCookie(next.role);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
    syncAuthRoleCookie(null);
  }, []);

  useEffect(() => {
    syncAuthRoleCookie(user?.role ?? null);
  }, [user]);

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
      if (!user || user.role === "guest") return false;
      if (user.role === "admin") return true;
      return user.name === owner;
    },
    [user]
  );

  const members = useMemo(() => memberUsers, [memberUsers]);

  const value = useMemo(
    () => ({
      user,
      isAdmin: user?.role === "admin",
      isGuest: user?.role === "guest",
      canWrite: canWriteRole(user?.role),
      login,
      logout,
      canManageOwner,
      members,
      setMembersFromOwners,
    }),
    [user, login, logout, canManageOwner, members, setMembersFromOwners]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
