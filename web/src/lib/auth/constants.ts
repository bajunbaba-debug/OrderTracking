import type { AuthUser } from "@/lib/timeline/types";

/** 全部概览周末配置：批量应用所有可配置人员 */
export const ALL_OWNERS_WORKDAY_KEY = "__all__";

export const SESSION_COOKIE_NAME = "ot-session";

export const DEFAULT_ADMIN: AuthUser = {
  id: "admin",
  name: "管理员",
  role: "admin",
  department: "管理部",
};
