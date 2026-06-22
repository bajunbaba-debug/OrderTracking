/** 集中配置：统计日期、风险阈值等 */
import { parseDateInput } from "./format";

export const APP_CONFIG = {
  /** 统计基准日期，用于交期区间与等待天数 */
  statsDate: process.env.STATS_DATE || "2026-06-18",
  /** 7 天内到期且总复杂度较高（红色风险） */
  highComplexityThreshold: 3,
  /** 发布超过 N 天仍未完成（黄色风险） */
  waitingDaysThreshold: 21,
  /** 舒适度基准 P20 */
  comfortBaselineP20: 3,
  /** P1 相对 P10 偏离阈值（20%） */
  p1DeviationThreshold: 0.2,
  /** P2 相对 P20 偏离阈值（20%） */
  p2DeviationThreshold: 0.2,
  /** 默认 Excel 路径（相对 web 目录） */
  defaultExcelPath: "../项目统计2026.xlsm",
} as const;

export function getStatsDate(): Date {
  return parseDateInput(APP_CONFIG.statsDate) ?? new Date(Date.UTC(2026, 5, 18, 12, 0, 0));
}
