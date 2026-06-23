import { calendarDaysBetween } from "./workdays";
import type { BlockSegmentSlice } from "./date-segments";

/** 计算色块切片内已处理时间占比（0–100），支持 0.1 步进 */
export function getSliceProgressFillPercent(
  slice: BlockSegmentSlice,
  processedTime: number,
  estimatedDays: number
): number {
  if (processedTime <= 0 || estimatedDays <= 0) return 0;

  const block = slice.block;
  const blockCalendarDays = Math.max(
    1,
    calendarDaysBetween(block.startDate, block.endDate) + 1
  );
  const sliceStartInBlock = calendarDaysBetween(block.startDate, slice.visibleStart);
  const sliceEndInBlock = sliceStartInBlock + slice.daySpan;
  const processedCalendarSpan = (processedTime / estimatedDays) * blockCalendarDays;

  const completedInSlice = Math.max(
    0,
    Math.min(sliceEndInBlock, processedCalendarSpan) - sliceStartInBlock
  );
  return Math.min(100, (completedInSlice / slice.daySpan) * 100);
}

/** 概览模式下单色块的已处理宽度占比（0–100） */
export function getBlockProgressFillPercent(
  block: { startDate: string; endDate: string; processedTime: number; estimatedDays: number },
  processedTime: number,
  estimatedDays: number
): number {
  if (processedTime <= 0 || estimatedDays <= 0) return 0;
  return Math.min(100, (processedTime / estimatedDays) * 100);
}
