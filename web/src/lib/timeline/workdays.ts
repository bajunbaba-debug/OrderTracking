import { formatDate, parseDateInput } from "@/lib/format";

/** 单周周末工作配置 */
export interface MemberWorkdayConfig {
  saturdayWork: boolean;
  sundayWork: boolean;
}

export const DEFAULT_WORKDAY_CONFIG: MemberWorkdayConfig = {
  saturdayWork: false,
  sundayWork: false,
};

/** memberWeeklyWorkdayConfig[owner][weekStartMonday] */
export type MemberWeeklyWorkdayStore = Record<string, Record<string, MemberWorkdayConfig>>;

export type WorkdayLookup = (dateStr: string) => MemberWorkdayConfig;

export function addCalendarDays(dateStr: string, days: number): string {
  const parsed = parseDateInput(dateStr);
  if (!parsed) return dateStr;
  const d = new Date(parsed.getTime());
  d.setUTCDate(d.getUTCDate() + days);
  return formatDate(d);
}

/** 所在周的周一（UTC） */
export function getWeekStart(dateStr: string): string {
  const parsed = parseDateInput(dateStr);
  if (!parsed) return dateStr;
  const dow = parsed.getUTCDay();
  const diff = dow === 0 ? -6 : 1 - dow;
  return addCalendarDays(dateStr, diff);
}

export function getConfigurableWeeks(
  baseDateStr: string,
  count = 3
): { weekStart: string; label: string }[] {
  const w0 = getWeekStart(baseDateStr);
  const labels = ["本周", "下周", "下下周"];
  return Array.from({ length: count }, (_, i) => ({
    weekStart: addCalendarDays(w0, i * 7),
    label: labels[i] ?? `第${i + 1}周`,
  }));
}

export function getWeekConfigForDate(
  dateStr: string,
  owner: string,
  weekly?: MemberWeeklyWorkdayStore,
  legacy?: Record<string, MemberWorkdayConfig>
): MemberWorkdayConfig {
  const weekStart = getWeekStart(dateStr);
  const byWeek = weekly?.[owner];
  if (byWeek?.[weekStart]) return byWeek[weekStart];
  return legacy?.[owner] ?? DEFAULT_WORKDAY_CONFIG;
}

export function createWorkdayLookup(
  owner: string,
  weekly?: MemberWeeklyWorkdayStore,
  legacy?: Record<string, MemberWorkdayConfig>
): WorkdayLookup {
  return (dateStr: string) => getWeekConfigForDate(dateStr, owner, weekly, legacy);
}

/** @deprecated 兼容旧接口 */
export function getMemberWorkdayConfig(
  owner: string,
  configs: Record<string, MemberWorkdayConfig> | undefined
): MemberWorkdayConfig {
  return configs?.[owner] ?? DEFAULT_WORKDAY_CONFIG;
}

export function formatWorkdayRuleLabel(config: MemberWorkdayConfig): string {
  const sat = config.saturdayWork ? "周六工作" : "周六休息";
  const sun = config.sundayWork ? "周日工作" : "周日休息";
  return `${sat} / ${sun}`;
}

export function formatWeekRuleLabel(weekStart: string, config: MemberWorkdayConfig): string {
  return `${weekStart.slice(5)} 起：${formatWorkdayRuleLabel(config)}`;
}

function getUtcDayOfWeek(date: Date): number {
  return date.getUTCDay();
}

export function isWorkdayAt(date: Date, lookup: WorkdayLookup): boolean {
  const config = lookup(formatDate(date));
  const dow = getUtcDayOfWeek(date);
  if (dow >= 1 && dow <= 5) return true;
  if (dow === 6) return config.saturdayWork;
  if (dow === 0) return config.sundayWork;
  return false;
}

/** 兼容：固定 config */
export function isWorkday(date: Date, config: MemberWorkdayConfig): boolean {
  const dow = getUtcDayOfWeek(date);
  if (dow >= 1 && dow <= 5) return true;
  if (dow === 6) return config.saturdayWork;
  if (dow === 0) return config.sundayWork;
  return false;
}

export function alignToWorkday(dateStr: string, lookup: WorkdayLookup): string {
  const parsed = parseDateInput(dateStr);
  if (!parsed) return dateStr;
  const d = new Date(parsed.getTime());
  let guard = 0;
  while (!isWorkdayAt(d, lookup) && guard < 21) {
    d.setUTCDate(d.getUTCDate() + 1);
    guard++;
  }
  return formatDate(d);
}

export function nextWorkdayAfter(dateStr: string, lookup: WorkdayLookup): string {
  return alignToWorkday(addCalendarDays(dateStr, 1), lookup);
}

export function addWorkDays(
  startDateStr: string,
  workDays: number,
  lookup: WorkdayLookup
): string {
  if (workDays <= 0) return alignToWorkday(startDateStr, lookup);

  const d = parseDateInput(alignToWorkday(startDateStr, lookup))!;
  const remaining = Math.ceil(workDays);
  let counted = 1;

  while (counted < remaining) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isWorkdayAt(d, lookup)) counted++;
  }

  return formatDate(d);
}

/** 两个日期之间的日历天数 */
export function calendarDaysBetween(fromStr: string, toStr: string): number {
  const from = parseDateInput(fromStr);
  const to = parseDateInput(toStr);
  if (!from || !to) return 0;
  return Math.round((to.getTime() - from.getTime()) / 86400000);
}

export function getOwnerWeeklyConfig(
  owner: string,
  weekStart: string,
  weekly?: MemberWeeklyWorkdayStore,
  legacy?: Record<string, MemberWorkdayConfig>
): MemberWorkdayConfig {
  return weekly?.[owner]?.[weekStart] ?? legacy?.[owner] ?? DEFAULT_WORKDAY_CONFIG;
}
