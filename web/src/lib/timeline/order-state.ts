import type { TimelineOrderState } from "./types";

/** 时间流数值统一保留一位小数（0.1 步进） */
export function roundTimelineTenth(value: number): number {
  return Math.round(value * 10) / 10;
}

type LegacyOrderState = TimelineOrderState & { frozenPercent?: number };

/** 从 localStorage 旧字段 frozenPercent（百分比）迁移为 processedTime（工作日） */
export function resolveProcessedTime(
  state: LegacyOrderState,
  estimatedDays: number
): number {
  if (typeof state.processedTime === "number" && !Number.isNaN(state.processedTime)) {
    return roundTimelineTenth(Math.max(0, state.processedTime));
  }
  if (typeof state.frozenPercent === "number" && estimatedDays > 0) {
    const pct = Math.min(100, Math.max(0, state.frozenPercent));
    return roundTimelineTenth((estimatedDays * pct) / 100);
  }
  return 0;
}

/** 反冻结 / 反标记后回到初始未处理状态（保留队列与插单标记） */
export function resetToInitialPending(state: TimelineOrderState): TimelineOrderState {
  return {
    ...state,
    status: "pending",
    processedTime: 0,
    restartExtra: 0,
    workStartDate: null,
    frozenAt: null,
    freezeReason: "",
    freezeNote: "",
    freezeByPriority: false,
    freezeByIncident: false,
    restartNote: "",
    lastProgressUpdate: null,
  };
}

/** 顺序调整导致取消处理中时，保留已处理时间 k 以维持色块剩余时长和进度覆盖 */
export function unmarkInProgressKeepProcessedTime(
  state: TimelineOrderState
): TimelineOrderState {
  return {
    ...state,
    status: "pending",
    restartExtra: 0,
    workStartDate: null,
    frozenAt: null,
    freezeReason: "",
    freezeNote: "",
    freezeByPriority: false,
    freezeByIncident: false,
    restartNote: "",
  };
}
