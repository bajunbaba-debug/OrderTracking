import type { UserRole } from "@/lib/timeline/types";

/** 未登录时保持原有可写行为 */
export function canWriteRole(_role: UserRole | null | undefined): boolean {
  return true;
}
