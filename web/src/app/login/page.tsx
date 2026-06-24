"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth/context";

function LoginPageInner() {
  const { login, user, authReady } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const from = searchParams.get("from") || "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authReady || !user) return;
    router.replace(from.startsWith("/") && !from.startsWith("/login") ? from : "/");
  }, [authReady, user, from, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError("");
    const err = await login(username.trim(), password);
    if (err) {
      setError(err);
      setSubmitting(false);
      return;
    }
    setPassword("");
    router.replace(from.startsWith("/") && !from.startsWith("/login") ? from : "/");
    router.refresh();
    setSubmitting(false);
  }

  if (!authReady) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        加载中…
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        正在进入系统…
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">订单项目分析系统</h1>
          <p className="mt-2 text-sm text-slate-500">请登录后继续</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">账号</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              placeholder="管理员或负责人姓名"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-slate-500">密码</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              className="w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm"
              placeholder="请输入密码"
            />
          </label>

          {error ? (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={submitting || !username.trim() || !password}
            className="w-full rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "登录中…" : "登录"}
          </button>
        </form>

        {searchParams.get("from") ? (
          <p className="mt-4 text-center text-xs text-slate-400">
            登录后将返回：{searchParams.get("from")}
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
          加载中…
        </div>
      }
    >
      <LoginPageInner />
    </Suspense>
  );
}
