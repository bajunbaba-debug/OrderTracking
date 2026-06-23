import type { TimelinePersistedState } from "./types";

const STORAGE_KEY = "order-tracking-timeline-v1";

export const EMPTY_TIMELINE_STATE: TimelinePersistedState = {
  orderStates: [],
  incidents: [],
  operationLogs: [],
  memberWorkStarts: {},
  memberWorkdayConfig: {},
  memberWeeklyWorkdayConfig: {},
};

export function loadTimelineState(): TimelinePersistedState {
  if (typeof window === "undefined") return EMPTY_TIMELINE_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_TIMELINE_STATE;
    const parsed = JSON.parse(raw) as TimelinePersistedState;
    return {
      orderStates: parsed.orderStates ?? [],
      incidents: parsed.incidents ?? [],
      operationLogs: parsed.operationLogs ?? [],
      memberWorkStarts: parsed.memberWorkStarts ?? {},
      memberWorkdayConfig: parsed.memberWorkdayConfig ?? {},
      memberWeeklyWorkdayConfig: parsed.memberWeeklyWorkdayConfig ?? {},
    };
  } catch {
    return EMPTY_TIMELINE_STATE;
  }
}

export function saveTimelineState(state: TimelinePersistedState): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function appendLog(
  state: TimelinePersistedState,
  entry: Omit<TimelinePersistedState["operationLogs"][number], "id" | "timestamp" | "operator" | "operatorRole"> & {
    operator: string;
    operatorRole: "admin" | "member";
  }
): TimelinePersistedState {
  const log = {
    ...entry,
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date().toISOString(),
  };
  return {
    ...state,
    operationLogs: [log, ...state.operationLogs].slice(0, 200),
  };
}
