export type TimelineZoomLevel = "compact" | "standard" | "wide";

export interface TimelineZoomPreset {
  level: TimelineZoomLevel;
  label: string;
  /** 展开视图：每行日期段包含的日历天数 */
  daysPerRow: number;
  /** 全部概览紧凑模式列宽 px/天 */
  overviewDayWidth: number;
}

export const TIMELINE_ZOOM_PRESETS: Record<TimelineZoomLevel, TimelineZoomPreset> = {
  compact: { level: "compact", label: "紧凑", daysPerRow: 28, overviewDayWidth: 22 },
  standard: { level: "standard", label: "标准", daysPerRow: 21, overviewDayWidth: 28 },
  wide: { level: "wide", label: "放大", daysPerRow: 14, overviewDayWidth: 32 },
};

export const DEFAULT_ZOOM_LEVEL: TimelineZoomLevel = "standard";

const STORAGE_KEY = "order-tracking-timeline-zoom";

export function loadZoomLevel(): TimelineZoomLevel {
  if (typeof window === "undefined") return DEFAULT_ZOOM_LEVEL;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw && raw in TIMELINE_ZOOM_PRESETS) return raw as TimelineZoomLevel;
  } catch {
    /* ignore */
  }
  return DEFAULT_ZOOM_LEVEL;
}

export function saveZoomLevel(level: TimelineZoomLevel): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, level);
}

export function getZoomPreset(level: TimelineZoomLevel): TimelineZoomPreset {
  return TIMELINE_ZOOM_PRESETS[level];
}

export const ZOOM_LEVELS: TimelineZoomLevel[] = ["compact", "standard", "wide"];
