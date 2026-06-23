import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { AUTH_ROLE_COOKIE } from "@/lib/auth/permissions";
import type { UserRole } from "@/lib/timeline/types";

/** API 写入前校验：游客返回 403 */
export async function assertCanWriteApi(): Promise<NextResponse | null> {
  const cookieStore = await cookies();
  const raw = cookieStore.get(AUTH_ROLE_COOKIE)?.value;
  const role = raw ? (decodeURIComponent(raw) as UserRole) : undefined;
  if (role === "guest") {
    return NextResponse.json({ error: "游客无写入权限" }, { status: 403 });
  }
  return null;
}
