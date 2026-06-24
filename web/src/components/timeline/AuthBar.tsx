"use client";

import { useState } from "react";
import { useAuth } from "@/lib/auth/context";
import type { UserRole } from "@/lib/timeline/types";

function roleLabel(role: UserRole): string {
  if (role === "admin") return "管理员";
  return "普通人员";
}

export function AuthBar() {
  const { user, login, logout } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const err = await login(username.trim(), password);
    if (err) setError(err);
    else setPassword("");
    setSubmitting(false);
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      {user ? (
        <>
          <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
            {user.name}
            <span className="ml-1 text-slate-400">({roleLabel(user.role)})</span>
          </span>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
          >
            退出
          </button>
        </>
      ) : (
        <form onSubmit={(e) => void handleLogin(e)} className="flex flex-wrap items-center gap-1.5">
          <input
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="账号"
            className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
            aria-label="登录账号"
            autoComplete="username"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="密码"
            className="w-24 rounded border border-slate-300 px-2 py-1 text-xs"
            aria-label="密码"
            autoComplete="current-password"
          />
          <button
            type="submit"
            disabled={submitting || !username || !password}
            className="rounded bg-slate-900 px-2 py-1 text-xs text-white disabled:opacity-50"
          >
            登录
          </button>
          {error ? <span className="text-xs text-red-600">{error}</span> : null}
        </form>
      )}
    </div>
  );
}
