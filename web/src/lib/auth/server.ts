import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth/session";
import type { UserRole } from "@/lib/timeline/types";
import { canWriteRole } from "@/lib/auth/permissions";

/** API 写入前校验：游客返回 403 */
export async function assertCanWriteApi(): Promise<NextResponse | null> {
  const user = await getSessionUser();
  const role: UserRole | undefined = user?.role;
  if (!canWriteRole(role)) {
    return NextResponse.json({ error: "当前账号无写入权限" }, { status: 403 });
  }
  return null;
}

/** 仅管理员可执行的高危 API */
export async function assertAdminApi(): Promise<NextResponse | null> {
  const user = await getSessionUser();
  if (user?.role !== "admin") {
    return NextResponse.json({ error: "仅管理员可执行此操作" }, { status: 403 });
  }
  return null;
}

/** 读取当前会话用户（API 路由用） */
export { getSessionUser };
