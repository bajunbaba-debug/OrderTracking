import type { UserRole } from "@/lib/timeline/types";

export const AUTH_ROLE_COOKIE = "ot-user-role";

/** 游客不可写；未登录时保持原有可写行为 */
export function canWriteRole(role: UserRole | null | undefined): boolean {
  return role !== "guest";
}

export function syncAuthRoleCookie(role: UserRole | null): void {
  if (typeof document === "undefined") return;
  if (role) {
    document.cookie = `${AUTH_ROLE_COOKIE}=${encodeURIComponent(role)}; path=/; SameSite=Lax`;
  } else {
    document.cookie = `${AUTH_ROLE_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
  }
}
