"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/context";
import type { UserRole } from "@/lib/timeline/types";

function roleLabel(role: UserRole): string {
  if (role === "admin") return "管理员";
  return "普通人员";
}

export function AuthBar() {
  const router = useRouter();
  const { user, logout } = useAuth();

  if (!user) return null;

  async function handleLogout() {
    await logout();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-sm">
      <span className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-600">
        {user.name}
        <span className="ml-1 text-slate-400">({roleLabel(user.role)})</span>
      </span>
      <button
        type="button"
        onClick={() => void handleLogout()}
        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50"
      >
        退出
      </button>
    </div>
  );
}
