"use client";

import { useAuth, DEFAULT_ADMIN, DEFAULT_GUEST } from "@/lib/auth/context";
import type { UserRole } from "@/lib/timeline/types";

function roleLabel(role: UserRole): string {
  if (role === "admin") return "管理员";
  if (role === "guest") return "游客";
  return "普通人员";
}

export function AuthBar() {
  const { user, login, logout, members } = useAuth();

  return (
    <div className="flex items-center gap-2 text-sm">
      {user ? (
        <>
          <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
            {user.name}
            <span className="ml-1 text-slate-400">({roleLabel(user.role)})</span>
          </span>
          <button
            type="button"
            onClick={logout}
            className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
          >
            退出
          </button>
        </>
      ) : (
        <>
          <select
            className="rounded border border-slate-300 px-2 py-1 text-xs"
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value;
              if (!v) return;
              if (v === "admin") login(DEFAULT_ADMIN);
              else if (v === "guest") login(DEFAULT_GUEST);
              else {
                const m = members.find((x) => x.name === v);
                if (m) login(m);
              }
              e.target.value = "";
            }}
          >
            <option value="">模拟登录</option>
            <option value="admin">管理员</option>
            <option value="guest">游客（只读）</option>
            {members.map((m) => (
              <option key={m.id} value={m.name}>
                {m.name}（普通人员）
              </option>
            ))}
          </select>
        </>
      )}
    </div>
  );
}
