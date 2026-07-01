import type { UserRole } from "@/lib/timeline/types";

/** 游客仅允许查看和导出，不允许写入 */
export function canWriteRole(role: UserRole | null | undefined): boolean {
  return role !== "guest";
}
