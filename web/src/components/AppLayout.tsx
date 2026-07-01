"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/lib/auth/context";

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, authReady } = useAuth();
  const isLoginPage = pathname === "/login";
  const isGuestExportPage = pathname === "/guest-export";

  useEffect(() => {
    if (isLoginPage || !authReady) return;
    if (!user) {
      const from = pathname === "/" ? "" : `?from=${encodeURIComponent(pathname)}`;
      router.replace(`/login${from}`);
      return;
    }
    if (user.role === "guest" && !isGuestExportPage) {
      router.replace("/guest-export");
      return;
    }
    if (user.role !== "guest" && isGuestExportPage) {
      router.replace("/");
    }
  }, [isLoginPage, isGuestExportPage, authReady, user, pathname, router]);

  if (isLoginPage) {
    return children;
  }

  if (!authReady || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        加载中…
      </div>
    );
  }

  if (user.role === "guest" && !isGuestExportPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        正在进入游客导出页…
      </div>
    );
  }

  if (user.role !== "guest" && isGuestExportPage) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-sm text-slate-500">
        正在进入系统…
      </div>
    );
  }

  if (isGuestExportPage) {
    return children;
  }

  return <AppShell>{children}</AppShell>;
}
