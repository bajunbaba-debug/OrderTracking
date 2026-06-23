"use client";

import { useMemo, useRef, useEffect } from "react";
import { formatDate, parseDateInput } from "@/lib/format";
import {
  splitDateRange,
  getBlocksForSegment,
  type BlockSegmentSlice,
  type DateSegment,
} from "@/lib/timeline/date-segments";
import { calendarDaysBetween, STATUS_LABELS } from "@/lib/timeline/schedule";
import { compactOverviewBlockLabel } from "@/lib/timeline/display";
import {
  getBlockProgressFillPercent,
  getSliceProgressFillPercent,
} from "@/lib/timeline/progress-display";
import { addCalendarDays, isWorkdayAt, type WorkdayLookup, type MemberWorkdayConfig } from "@/lib/timeline/workdays";
import type { ScheduledBlock } from "@/lib/timeline/types";
import { TimelineWeeklyConfig } from "@/components/timeline/TimelineWeeklyConfig";

const COMPACT_LABEL = 100;
const COMPACT_ROW_HEIGHT = 52;
/** 日期段内单层进度带高度（固定，不随订单数增减） */
const SEGMENT_TRACK_HEIGHT = 60;
const SEGMENT_BAR_TOP = 6;
const SEGMENT_BAR_HEIGHT = 48;
const MAX_OVERLAP_STACK = 3;

function blockStyle(block: ScheduledBlock): string {
  if (block.kind === "incident") return "timeline-bar-incident";
  if (block.status === "complete") return "timeline-bar-complete";
  if (block.status === "in_progress") return "timeline-bar-active";
  if (block.isFrozen) return "timeline-bar-frozen";
  if (block.isPriorityInsert) return "timeline-bar-priority";
  if (block.isDelayed) return "timeline-bar-delayed";
  return "timeline-bar-pending";
}

function blockTitle(block: ScheduledBlock): string {
  return [
    block.label,
    block.subLabel,
    `类型: ${block.typeLabel}`,
    `预计: ${block.estimatedDays} 工作日`,
    `开始: ${formatDate(block.startDate)}`,
    `完成: ${formatDate(block.endDate)}`,
    block.dueDate ? `交期: ${formatDate(block.dueDate)}` : "",
    `状态: ${STATUS_LABELS[block.status]}`,
  ]
    .filter(Boolean)
    .join("\n");
}

/** 仅当时间区间重叠时分配轻量 stack，避免变回多泳道布局 */
function assignOverlapStack(slices: BlockSegmentSlice[]): Map<string, number> {
  const sorted = [...slices].sort(
    (a, b) => a.dayOffset - b.dayOffset || b.daySpan - a.daySpan
  );
  const stackEnds: number[] = [];
  const map = new Map<string, number>();

  for (const slice of sorted) {
    const start = slice.dayOffset;
    const end = slice.dayOffset + slice.daySpan;
    let stack = stackEnds.findIndex((stackEnd) => stackEnd <= start);
    if (stack < 0) {
      stack = stackEnds.length;
      stackEnds.push(end);
    } else {
      stackEnds[stack] = end;
    }
    map.set(slice.sliceKey, Math.min(stack, MAX_OVERLAP_STACK - 1));
  }
  return map;
}

interface FilterState {
  onlyDelayed: boolean;
  onlyPriority: boolean;
  onlyFrozen: boolean;
  onlyIncident: boolean;
  statusFilter: string;
  dateFrom: string;
  dateTo: string;
}

interface Props {
  owners: string[];
  schedules: Map<string, ScheduledBlock[]>;
  workdayLookups: Map<string, WorkdayLookup>;
  rangeStart: string;
  rangeEnd: string;
  daysPerRow: number;
  overviewDayWidth: number;
  expanded: boolean;
  selectedBlockId: string | null;
  highlightProjectId: string | null;
  onSelectBlock: (block: ScheduledBlock) => void;
  scrollToOwner: string | null;
  scrollToProjectId: string | null;
  filters: FilterState;
  weeklyWeeks?: { weekStart: string; label: string; config: MemberWorkdayConfig }[];
  canEditWorkday?: boolean;
  onWeekConfigChange?: (weekStart: string, patch: Partial<MemberWorkdayConfig>) => void;
}

function filterBlocks(blocks: ScheduledBlock[], filters: FilterState) {
  return blocks.filter((b) => {
    if (filters.dateFrom && b.endDate < filters.dateFrom) return false;
    if (filters.dateTo && b.startDate > filters.dateTo) return false;
    if (filters.onlyDelayed && !b.isDelayed) return false;
    if (filters.onlyPriority && !b.isPriorityInsert) return false;
    if (filters.onlyFrozen && !b.isFrozen) return false;
    if (filters.onlyIncident && !b.affectedByIncident && b.kind !== "incident") return false;
    if (filters.statusFilter && b.kind === "order" && b.status !== filters.statusFilter) return false;
    return true;
  });
}

function SliceBlockButton({
  slice,
  stack,
  segment,
  selectedBlockId,
  highlightProjectId,
  onSelectBlock,
}: {
  slice: BlockSegmentSlice;
  stack: number;
  segment: DateSegment;
  selectedBlockId: string | null;
  highlightProjectId: string | null;
  onSelectBlock: (block: ScheduledBlock) => void;
}) {
  const { block } = slice;
  const leftPct = (slice.dayOffset / segment.dayCount) * 100;
  const widthPct = (slice.daySpan / segment.dayCount) * 100;
  const top = SEGMENT_BAR_TOP + stack * 3;
  const height = SEGMENT_BAR_HEIGHT - stack * 4;
  const showProgress =
    block.kind === "order" &&
    (block.status === "in_progress" || block.isFrozen) &&
    block.processedTime > 0 &&
    block.estimatedDays > 0;
  const progressFill = showProgress
    ? getSliceProgressFillPercent(slice, block.processedTime, block.estimatedDays)
    : 0;

  return (
    <button
      type="button"
      data-project-id={block.projectId ?? block.id}
      data-segment={segment.index}
      title={blockTitle(block)}
      onClick={() => onSelectBlock(block)}
      className={`timeline-bar !absolute flex cursor-pointer flex-col justify-center overflow-hidden rounded px-1.5 text-left text-[10px] leading-snug text-white ring-1 ring-white/35 shadow-sm ${blockStyle(block)} ${
        block.isRestarted ? "timeline-bar-restarted" : ""
      } ${selectedBlockId === block.id ? "ring-2 ring-slate-900 ring-offset-1" : ""} ${
        highlightProjectId === block.projectId ? "timeline-bar-highlight" : ""
      } ${slice.continuesBefore ? "rounded-l-none border-l-2 border-dashed border-white/70" : ""} ${
        slice.continuesAfter ? "rounded-r-none border-r-2 border-dashed border-white/70" : ""
      }`}
      style={{
        left: `calc(${leftPct}% + 1px)`,
        width: `calc(${Math.max(widthPct, 100 / segment.dayCount)}% - 2px)`,
        top,
        height,
        zIndex: 10 + stack,
      }}
    >
      {showProgress ? (
        <span
          className={`timeline-bar-progress ${block.isFrozen ? "timeline-bar-progress-frozen" : ""}`}
          style={{ width: `${progressFill}%` }}
          aria-hidden="true"
        />
      ) : null}
      <span className="relative z-[1] truncate font-semibold">
        {slice.continuesBefore ? "← " : ""}
        {block.label}
        {slice.continuesAfter ? " →" : ""}
      </span>
      <span className="relative z-[1] truncate opacity-95">{block.subLabel}</span>
      <span className="relative z-[1] truncate opacity-90">
        {block.typeLabel} · {block.estimatedDays} 工作日
      </span>
      <span className="relative z-[1] truncate opacity-85">
        {formatDate(block.startDate)} → {formatDate(block.endDate)}
      </span>
    </button>
  );
}

function DateSegmentRow({
  segment,
  blocks,
  lookup,
  selectedBlockId,
  highlightProjectId,
  onSelectBlock,
}: {
  segment: DateSegment;
  blocks: ScheduledBlock[];
  lookup: WorkdayLookup;
  selectedBlockId: string | null;
  highlightProjectId: string | null;
  onSelectBlock: (block: ScheduledBlock) => void;
}) {
  const slices = getBlocksForSegment(blocks, segment);
  const stackMap = useMemo(() => assignOverlapStack(slices), [slices]);

  const dayLabels = useMemo(() => {
    return Array.from({ length: segment.dayCount }, (_, i) =>
      addCalendarDays(segment.startDate, i)
    );
  }, [segment]);

  return (
    <section className="border-b border-slate-200 last:border-b-0">
      <div className="flex items-center justify-between bg-slate-100 px-3 py-1.5">
        <span className="text-xs font-semibold text-slate-700">
          第 {segment.index + 1} 行日期 · {formatDate(segment.startDate)} ~{" "}
          {formatDate(segment.endDate)}
        </span>
        <span className="text-[10px] text-slate-500">{segment.dayCount} 天</span>
      </div>

      <div
        className="grid border-b border-slate-100"
        style={{ gridTemplateColumns: `repeat(${segment.dayCount}, 1fr)` }}
      >
        {dayLabels.map((dateStr) => {
          const d = parseDateInput(dateStr)!;
          const nonWork = !isWorkdayAt(d, lookup);
          const dow = d.getUTCDay();
          return (
            <div
              key={dateStr}
              className={`border-l border-slate-100 px-0.5 py-1 text-center text-[9px] first:border-l-0 ${
                nonWork ? "bg-amber-50/80 text-amber-700" : "bg-slate-50 text-slate-400"
              }`}
            >
              {dateStr.slice(5)}
              <div className="text-[8px] opacity-70">
                {["日", "一", "二", "三", "四", "五", "六", "日"][dow]}
              </div>
            </div>
          );
        })}
      </div>

      <div
        className="relative w-full overflow-hidden"
        style={{ height: SEGMENT_TRACK_HEIGHT }}
      >
        <div
          className="absolute inset-0 grid"
          style={{ gridTemplateColumns: `repeat(${segment.dayCount}, 1fr)` }}
        >
          {dayLabels.map((dateStr) => {
            const d = parseDateInput(dateStr)!;
            const nonWork = !isWorkdayAt(d, lookup);
            return (
              <div
                key={`bg-${dateStr}`}
                className={`border-l border-slate-100 first:border-l-0 ${
                  nonWork ? "bg-amber-50/40" : ""
                }`}
              />
            );
          })}
        </div>

        {slices.map((slice) => (
          <SliceBlockButton
            key={slice.sliceKey}
            slice={slice}
            stack={stackMap.get(slice.sliceKey) ?? 0}
            segment={segment}
            selectedBlockId={selectedBlockId}
            highlightProjectId={highlightProjectId}
            onSelectBlock={onSelectBlock}
          />
        ))}
      </div>
    </section>
  );
}

function OverviewDateAxis({
  rangeStart,
  totalDays,
  dayWidth,
  lookup,
}: {
  rangeStart: string;
  totalDays: number;
  dayWidth: number;
  lookup: WorkdayLookup;
}) {
  const chartWidth = totalDays * dayWidth;

  return (
    <div className="sticky top-0 z-20 flex border-b border-slate-200 bg-slate-50">
      <div
        className="sticky left-0 z-30 shrink-0 border-r border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-medium leading-tight text-slate-600"
        style={{ width: COMPACT_LABEL }}
      >
        日期
      </div>
      <div
        className="relative shrink-0"
        style={{
          width: chartWidth,
          minWidth: `calc(100% - ${COMPACT_LABEL}px)`,
          height: 28,
        }}
      >
        {Array.from({ length: totalDays }, (_, i) => {
          const dateStr = addCalendarDays(rangeStart, i);
          const d = parseDateInput(dateStr)!;
          const nonWork = !isWorkdayAt(d, lookup);
          const dow = d.getUTCDay();
          return (
            <div
              key={dateStr}
              className={`absolute top-0 bottom-0 overflow-hidden border-l border-slate-100 text-center text-[9px] ${
                nonWork ? "bg-amber-50/80 text-amber-700" : "bg-slate-50 text-slate-400"
              }`}
              style={{ left: i * dayWidth, width: dayWidth }}
            >
              <div className="pt-0.5 leading-none">{dateStr.slice(5)}</div>
              <div className="text-[8px] leading-none opacity-70">
                {["日", "一", "二", "三", "四", "五", "六", "日"][dow]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CompactOwnerRow({
  owner,
  blocks,
  lookup,
  rangeStart,
  totalDays,
  dayWidth,
  selectedBlockId,
  highlightProjectId,
  onSelectBlock,
}: {
  owner: string;
  blocks: ScheduledBlock[];
  lookup: WorkdayLookup;
  rangeStart: string;
  totalDays: number;
  dayWidth: number;
  selectedBlockId: string | null;
  highlightProjectId: string | null;
  onSelectBlock: (block: ScheduledBlock) => void;
}) {
  const rangeStartDate = parseDateInput(rangeStart)!;
  const chartWidth = totalDays * dayWidth;

  return (
    <div data-owner={owner} className="flex border-b border-slate-100">
      <div
        className="sticky left-0 z-10 shrink-0 border-r border-slate-200 bg-white px-2 py-2 text-xs font-semibold text-slate-800"
        style={{ width: COMPACT_LABEL }}
      >
        {owner}
      </div>
      <div className="min-w-0 flex-1">
        <div
          className="relative shrink-0"
          style={{ width: chartWidth, minWidth: `calc(100% - ${COMPACT_LABEL}px)`, height: COMPACT_ROW_HEIGHT }}
        >
          {Array.from({ length: totalDays + 1 }).map((_, i) => {
            const d = new Date(rangeStartDate.getTime());
            d.setUTCDate(d.getUTCDate() + i);
            const nonWork = !isWorkdayAt(d, lookup);
            return (
              <div
                key={i}
                className={`absolute top-0 bottom-0 border-l ${
                  nonWork ? "border-amber-100 bg-amber-50/40" : "border-slate-100"
                }`}
                style={{ left: i * dayWidth, width: dayWidth }}
              />
            );
          })}
          {blocks.map((block) => {
            const startOffset = Math.max(0, calendarDaysBetween(rangeStart, block.startDate));
            const endOffset = Math.max(
              startOffset + 1,
              calendarDaysBetween(rangeStart, block.endDate)
            );
            const width = Math.max(dayWidth * 0.75, (endOffset - startOffset + 1) * dayWidth - 6);
            const left = startOffset * dayWidth + 3;
            const displayLabel =
              block.kind === "order" ? compactOverviewBlockLabel(block.label) : block.label;
            const showProgress =
              block.kind === "order" &&
              (block.status === "in_progress" || block.isFrozen) &&
              block.processedTime > 0 &&
              block.estimatedDays > 0;
            const progressFill = showProgress
              ? getBlockProgressFillPercent(block, block.processedTime, block.estimatedDays)
              : 0;
            return (
              <button
                key={`${block.kind}-${block.id}`}
                type="button"
                data-project-id={block.projectId ?? block.id}
                title={blockTitle(block)}
                onClick={() => onSelectBlock(block)}
                className={`timeline-bar !absolute top-1.5 flex h-9 cursor-pointer flex-col justify-center overflow-hidden rounded px-1 text-left text-[10px] text-white ring-1 ring-white/30 shadow-sm ${blockStyle(block)} ${
                  selectedBlockId === block.id ? "ring-2 ring-slate-900 ring-offset-1" : ""
                } ${highlightProjectId === block.projectId ? "timeline-bar-highlight" : ""}`}
                style={{ left, width }}
              >
                {showProgress ? (
                  <span
                    className={`timeline-bar-progress ${block.isFrozen ? "timeline-bar-progress-frozen" : ""}`}
                    style={{ width: `${progressFill}%` }}
                    aria-hidden="true"
                  />
                ) : null}
                <span className="relative z-[1] truncate font-medium">{displayLabel}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Legend({
  daysPerRow,
  mode,
  overviewDayWidth,
}: {
  daysPerRow: number;
  mode: "expanded" | "overview";
  overviewDayWidth?: number;
}) {
  return (
    <div className="flex shrink-0 flex-wrap gap-3 border-t border-slate-200 bg-slate-50 px-3 py-2 text-[10px] text-slate-500">
      <span className="flex items-center gap-1">
        <span className="inline-block h-2 w-4 rounded bg-blue-500" /> 未处理
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2 w-4 rounded bg-green-600" /> 正在处理
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-2 w-4 rounded border-2 border-dashed border-white bg-orange-500" />{" "}
        跨行延续
      </span>
      <span className="flex items-center gap-1">
        <span className="inline-block h-3 w-4 rounded bg-amber-50 ring-1 ring-amber-200" /> 非工作日
      </span>
      <span className="text-slate-400">
        {mode === "expanded"
          ? `展开：每行 ${daysPerRow} 天，宽度自适应容器`
          : `概览：${overviewDayWidth}px/天`}
      </span>
    </div>
  );
}

export function TimelineGantt({
  owners,
  schedules,
  workdayLookups,
  rangeStart,
  rangeEnd,
  daysPerRow,
  overviewDayWidth,
  expanded,
  selectedBlockId,
  highlightProjectId,
  onSelectBlock,
  scrollToOwner,
  scrollToProjectId,
  filters,
  weeklyWeeks,
  canEditWorkday = false,
  onWeekConfigChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const singleOwnerExpanded = expanded && owners.length === 1;
  const owner = singleOwnerExpanded ? owners[0] : null;

  const segments = useMemo(() => {
    if (!singleOwnerExpanded || !owner) return [];
    return splitDateRange(rangeStart, rangeEnd, daysPerRow);
  }, [singleOwnerExpanded, owner, rangeStart, rangeEnd, daysPerRow]);

  const totalDays = useMemo(
    () => Math.max(1, calendarDaysBetween(rangeStart, rangeEnd) + 1),
    [rangeStart, rangeEnd]
  );

  useEffect(() => {
    if (!containerRef.current) return;
    if (scrollToProjectId) {
      const el = containerRef.current.querySelector(
        `[data-project-id="${scrollToProjectId}"]`
      );
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }
    if (scrollToOwner) {
      containerRef.current
        .querySelector(`[data-owner="${scrollToOwner}"]`)
        ?.scrollIntoView({ block: "start", behavior: "smooth" });
    }
  }, [scrollToOwner, scrollToProjectId, daysPerRow, segments.length]);

  const filteredByOwner = useMemo(() => {
    const map = new Map<string, ScheduledBlock[]>();
    for (const o of owners) {
      map.set(o, filterBlocks(schedules.get(o) ?? [], filters));
    }
    return map;
  }, [owners, schedules, filters]);

  if (singleOwnerExpanded && owner) {
    const blocks = filteredByOwner.get(owner) ?? [];
    const lookup = workdayLookups.get(owner)!;

    if (
      blocks.length === 0 &&
      (filters.dateFrom ||
        filters.dateTo ||
        filters.onlyDelayed ||
        filters.onlyPriority ||
        filters.onlyFrozen ||
        filters.onlyIncident ||
        filters.statusFilter)
    ) {
      return (
        <div className="flex h-full items-center justify-center rounded-lg border border-slate-200 bg-white p-8 text-sm text-slate-500">
          当前筛选下无可见订单
        </div>
      );
    }

    return (
      <div
        ref={containerRef}
        data-owner={owner}
        className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white"
      >
        <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-1.5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold leading-tight text-slate-800">{owner}</div>
              <div className="text-[11px] leading-tight text-slate-500">
                日期轴分 {segments.length} 行 · 每行 {daysPerRow} 天 · 纵向浏览
              </div>
            </div>
            {weeklyWeeks && weeklyWeeks.length > 0 ? (
              <TimelineWeeklyConfig
                weeks={weeklyWeeks}
                canEdit={canEditWorkday}
                onChange={onWeekConfigChange ?? (() => {})}
              />
            ) : null}
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          {segments.map((segment) => (
            <DateSegmentRow
              key={segment.index}
              segment={segment}
              blocks={blocks}
              lookup={lookup}
              selectedBlockId={selectedBlockId}
              highlightProjectId={highlightProjectId}
              onSelectBlock={onSelectBlock}
            />
          ))}
        </div>
        <Legend daysPerRow={daysPerRow} mode="expanded" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-3 py-1.5 text-[11px] text-slate-500">
        全部概览 · 紧凑横向时间流（可横向滚动）
      </div>
      <div ref={containerRef} className="min-h-0 flex-1 overflow-auto">
        {owners.length > 0 ? (
          <OverviewDateAxis
            rangeStart={rangeStart}
            totalDays={totalDays}
            dayWidth={overviewDayWidth}
            lookup={workdayLookups.get(owners[0])!}
          />
        ) : null}
        {owners.map((o) => {
          const blocks = filteredByOwner.get(o) ?? [];
          if (
            blocks.length === 0 &&
            (filters.dateFrom ||
              filters.dateTo ||
              filters.onlyDelayed ||
              filters.onlyPriority ||
              filters.onlyFrozen ||
              filters.onlyIncident ||
              filters.statusFilter)
          ) {
            return null;
          }
          return (
            <CompactOwnerRow
              key={o}
              owner={o}
              blocks={blocks}
              lookup={workdayLookups.get(o)!}
              rangeStart={rangeStart}
              totalDays={totalDays}
              dayWidth={overviewDayWidth}
              selectedBlockId={selectedBlockId}
              highlightProjectId={highlightProjectId}
              onSelectBlock={onSelectBlock}
            />
          );
        })}
      </div>
      <Legend daysPerRow={daysPerRow} mode="overview" overviewDayWidth={overviewDayWidth} />
    </div>
  );
}
