import { addCalendarDays, calendarDaysBetween } from "./workdays";
import type { ScheduledBlock } from "./types";

export interface DateSegment {
  index: number;
  startDate: string;
  endDate: string;
  dayCount: number;
}

/** 将日期范围切分为多段，每段 daysPerRow 个日历日 */
export function splitDateRange(
  rangeStart: string,
  rangeEnd: string,
  daysPerRow: number
): DateSegment[] {
  if (rangeStart > rangeEnd) return [];
  const segments: DateSegment[] = [];
  let cursor = rangeStart;
  let index = 0;

  while (cursor <= rangeEnd) {
    const endCandidate = addCalendarDays(cursor, daysPerRow - 1);
    const endDate = endCandidate > rangeEnd ? rangeEnd : endCandidate;
    segments.push({
      index,
      startDate: cursor,
      endDate,
      dayCount: calendarDaysBetween(cursor, endDate) + 1,
    });
    cursor = addCalendarDays(endDate, 1);
    index++;
  }

  return segments;
}

export interface BlockSegmentSlice {
  block: ScheduledBlock;
  sliceKey: string;
  visibleStart: string;
  visibleEnd: string;
  continuesBefore: boolean;
  continuesAfter: boolean;
  dayOffset: number;
  daySpan: number;
}

export function sliceBlockForSegment(
  block: ScheduledBlock,
  segment: DateSegment
): BlockSegmentSlice | null {
  if (block.endDate < segment.startDate || block.startDate > segment.endDate) {
    return null;
  }

  const visibleStart =
    block.startDate > segment.startDate ? block.startDate : segment.startDate;
  const visibleEnd = block.endDate < segment.endDate ? block.endDate : segment.endDate;

  return {
    block,
    sliceKey: `${block.id}-seg-${segment.index}`,
    visibleStart,
    visibleEnd,
    continuesBefore: block.startDate < segment.startDate,
    continuesAfter: block.endDate > segment.endDate,
    dayOffset: calendarDaysBetween(segment.startDate, visibleStart),
    daySpan: Math.max(1, calendarDaysBetween(visibleStart, visibleEnd) + 1),
  };
}

export function getBlocksForSegment(
  blocks: ScheduledBlock[],
  segment: DateSegment
): BlockSegmentSlice[] {
  return blocks
    .map((b) => sliceBlockForSegment(b, segment))
    .filter((s): s is BlockSegmentSlice => s !== null);
}
