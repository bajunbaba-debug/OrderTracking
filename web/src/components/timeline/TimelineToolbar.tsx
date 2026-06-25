"use client";

import { useRef, useState } from "react";
import { formatDate } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/timeline/schedule";
import type { TimelineZoomLevel } from "@/lib/timeline/zoom";
import { ZOOM_LEVELS, TIMELINE_ZOOM_PRESETS } from "@/lib/timeline/zoom";
import type { MemberTimelineSummary, TimelineSearchResult } from "@/lib/timeline/types";
import type { MemberWorkdayConfig } from "@/lib/timeline/workdays";
import { DisplayText } from "@/components/ui";
import { TimelineWeeklyConfig } from "@/components/timeline/TimelineWeeklyConfig";
import { copySearchResultsTableAsImage } from "@/lib/timeline/search-results-image";

const SEARCH_PREVIEW_LIMIT = 8;

const SEARCH_RESULT_COLUMNS =
  "grid grid-cols-[minmax(5.5rem,1.1fr)_minmax(3rem,0.7fr)_minmax(3rem,0.65fr)_minmax(3.5rem,0.75fr)_minmax(3rem,0.6fr)_minmax(3rem,0.55fr)_minmax(7rem,1fr)] gap-x-2";

function formatQueueLabel(position: TimelineSearchResult["queuePosition"]): string {
  if (!position) return "—";
  return `${position.index + 1}/${position.total}`;
}

/** 中英文混排时的显示宽度（中文计 2，其余计 1） */
function displayWidth(value: string): number {
  let width = 0;
  for (const char of value) {
    width += char.charCodeAt(0) > 255 ? 2 : 1;
  }
  return width;
}

function padDisplayCell(value: string, targetWidth: number): string {
  const padding = Math.max(0, targetWidth - displayWidth(value));
  return value + " ".repeat(padding);
}

function formatSearchResultsForCopy(results: TimelineSearchResult[]): string {
  const header = ["合同号", "负责人", "类型", "型号", "状态", "队列", "预计时段"];
  const rows = results.map((r) => [
    r.contractNo || "—",
    r.owner || "—",
    r.type || "—",
    r.model || "—",
    STATUS_LABELS[r.status],
    formatQueueLabel(r.queuePosition),
    `${formatDate(r.startDate)} → ${formatDate(r.endDate)}`,
  ]);
  const allRows = [header, ...rows];
  const widths = header.map((_, colIndex) =>
    Math.max(...allRows.map((row) => displayWidth(row[colIndex] ?? "")))
  );
  return allRows
    .map((row) => row.map((cell, i) => padDisplayCell(cell, widths[i]!)).join("  "))
    .join("\n");
}

function CopyIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function CopyImageIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <path d="M3 9h18" />
      <path d="M9 21V9" />
    </svg>
  );
}

/** 工具栏统一尺寸 */
const CONTROL_H = "h-8";
const TEXT = "text-xs";
const INPUT =
  "h-8 w-full min-w-0 rounded border border-slate-300 px-2.5 text-xs text-slate-900 placeholder:text-slate-400";
const BTN_PRIMARY = `inline-flex ${CONTROL_H} shrink-0 items-center justify-center rounded px-3 text-xs font-medium text-white bg-slate-900 hover:bg-slate-800`;
const SELECT = `h-8 rounded border border-slate-300 px-2 text-xs text-slate-900`;

interface Props {
  searchInput: string;
  onSearchInputChange: (v: string) => void;
  onSearchSubmit: () => void;
  searchResults: TimelineSearchResult[];
  searchOpen: boolean;
  onSearchClose: () => void;
  onSearchSelect: (projectId: string, owner: string) => void;
  ownerFilter: string;
  onOwnerFilterChange: (v: string) => void;
  departmentFilter: string;
  onDepartmentFilterChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onlyDelayed: boolean;
  onToggleDelayed: () => void;
  owners: string[];
  members: MemberTimelineSummary[];
  focusedOwner: string | null;
  onFocusOwner: (owner: string | null) => void;
  showOwnerSwitcher: boolean;
  zoomLevel: TimelineZoomLevel;
  onZoomLevelChange: (level: TimelineZoomLevel) => void;
  weeklyConfig?: {
    weeks: {
      weekStart: string;
      label: string;
      config: MemberWorkdayConfig;
      saturdayMixed?: boolean;
      sundayMixed?: boolean;
    }[];
    canEdit: boolean;
    onChange: (weekStart: string, patch: Partial<MemberWorkdayConfig>) => void;
    ownerSelect?: {
      options: { value: string; label: string }[];
      value: string;
      onChange: (value: string) => void;
    };
  };
}

function toggleChipClass(active: boolean): string {
  return `inline-flex h-6 shrink-0 items-center rounded-full px-2 text-xs leading-none ${
    active
      ? "bg-slate-900 text-white"
      : "border border-slate-300 bg-white text-slate-600 hover:bg-slate-50"
  }`;
}

function OwnerSwitcher({
  members,
  focusedOwner,
  onFocusOwner,
}: {
  members: MemberTimelineSummary[];
  focusedOwner: string | null;
  onFocusOwner: (owner: string | null) => void;
}) {
  return (
    <div className="relative min-w-[140px] max-w-md flex-1 overflow-visible rounded-md border border-slate-200 bg-slate-50">
      <div className="flex h-8 items-center overflow-x-auto overflow-y-visible px-2 [scrollbar-width:thin]">
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onFocusOwner(null)}
            className={toggleChipClass(focusedOwner === null)}
          >
            全部概览
          </button>
          {members.map((m) => (
            <button
              key={m.owner}
              type="button"
              onClick={() => onFocusOwner(m.owner)}
              className={`relative ${toggleChipClass(focusedOwner === m.owner)}`}
            >
              <DisplayText value={m.owner} />
              {m.riskCount > 0 ? (
                <span className="absolute -right-1.5 -top-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs font-medium leading-none text-white ring-2 ring-slate-50">
                  {m.riskCount}
                </span>
              ) : null}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TimelineToolbar({
  searchInput,
  onSearchInputChange,
  onSearchSubmit,
  searchResults,
  searchOpen,
  onSearchClose,
  onSearchSelect,
  statusFilter,
  onStatusFilterChange,
  onlyDelayed,
  onToggleDelayed,
  members,
  focusedOwner,
  onFocusOwner,
  showOwnerSwitcher,
  zoomLevel,
  onZoomLevelChange,
  weeklyConfig,
}: Props) {
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const [copyHint, setCopyHint] = useState("");

  const preview = searchResults.slice(0, SEARCH_PREVIEW_LIMIT);
  const moreCount = Math.max(0, searchResults.length - SEARCH_PREVIEW_LIMIT);

  const showCopyHint = (message: string) => {
    setCopyHint(message);
    window.setTimeout(() => setCopyHint(""), 2000);
  };

  const handleCopyResults = async () => {
    if (searchResults.length === 0) return;
    try {
      await navigator.clipboard.writeText(formatSearchResultsForCopy(searchResults));
      showCopyHint("已复制文字");
    } catch {
      showCopyHint("复制失败");
    }
  };

  const handleCopyResultsAsImage = async () => {
    if (searchResults.length === 0) return;
    try {
      await copySearchResultsTableAsImage(searchResults);
      showCopyHint("已复制图片");
    } catch {
      showCopyHint("复制图片失败");
    }
  };

  return (
    <div className="mb-3 overflow-visible rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="mb-2.5 flex items-center gap-2">
        <span className={`${TEXT} text-slate-500`}>订单号搜索</span>
        <button type="button" onClick={onToggleDelayed} className={toggleChipClass(onlyDelayed)}>
          延期风险
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 overflow-visible">
        <div ref={searchWrapRef} className="relative flex min-w-[240px] flex-1 flex-wrap items-center gap-2">
          <input
            type="search"
            value={searchInput}
            onChange={(e) => onSearchInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                onSearchSubmit();
              }
              if (e.key === "Escape") onSearchClose();
            }}
            placeholder="合同号(项目名)/合同号(项目名)/..."
            className={`${INPUT} min-w-[120px] flex-1`}
          />
          <button type="button" onClick={onSearchSubmit} className={BTN_PRIMARY}>
            搜索
          </button>
          {showOwnerSwitcher ? (
            <OwnerSwitcher
              members={members}
              focusedOwner={focusedOwner}
              onFocusOwner={onFocusOwner}
            />
          ) : null}
          {searchOpen && searchResults.length > 0 ? (
            <>
              <div className="fixed inset-0 z-30" onClick={onSearchClose} aria-hidden="true" />
              <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 min-w-[640px] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-slate-500">
                  <span>共 {searchResults.length} 条处理项次</span>
                  <button
                    type="button"
                    onClick={() => void handleCopyResults()}
                    title={copyHint || "复制搜索结果文字"}
                    aria-label="复制搜索结果文字"
                    className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  >
                    <CopyIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyResultsAsImage()}
                    title={copyHint || "复制搜索结果表格图片"}
                    aria-label="复制搜索结果表格图片"
                    className="inline-flex h-6 w-6 items-center justify-center rounded text-slate-500 hover:bg-slate-100 hover:text-slate-800"
                  >
                    <CopyImageIcon className="h-3.5 w-3.5" />
                  </button>
                  {copyHint ? <span className="text-slate-400">{copyHint}</span> : null}
                </div>
                <div className={`${SEARCH_RESULT_COLUMNS} border-b border-slate-100 px-3 py-1 text-[10px] font-medium text-slate-500`}>
                  <span>合同号</span>
                  <span>负责人</span>
                  <span>类型</span>
                  <span>型号</span>
                  <span>状态</span>
                  <span>队列</span>
                  <span>预计时段</span>
                </div>
                {preview.map((r) => (
                  <button
                    key={r.projectId}
                    type="button"
                    onClick={() => {
                      onSearchSelect(r.projectId, r.owner);
                      onSearchClose();
                    }}
                    className={`${SEARCH_RESULT_COLUMNS} w-full border-b border-slate-50 px-3 py-1.5 text-left text-[11px] hover:bg-slate-50`}
                  >
                    <span className="truncate font-medium text-slate-900">{r.contractNo}</span>
                    <span className="truncate text-slate-600">{r.owner}</span>
                    <span className="truncate text-slate-600">{r.type}</span>
                    <span className="truncate text-slate-600">{r.model}</span>
                    <span className="truncate text-slate-600">{STATUS_LABELS[r.status]}</span>
                    <span className="truncate text-slate-600">{formatQueueLabel(r.queuePosition)}</span>
                    <span className="truncate text-slate-500">
                      {formatDate(r.startDate)} → {formatDate(r.endDate)}
                    </span>
                  </button>
                ))}
                {moreCount > 0 ? (
                  <p className="px-3 py-2 text-xs text-slate-500">还有 {moreCount} 条更多结果，请缩小关键词</p>
                ) : null}
              </div>
            </>
          ) : null}
          {searchOpen && searchResults.length === 0 ? (
            <>
              <div className="fixed inset-0 z-30" onClick={onSearchClose} aria-hidden="true" />
              <div className="absolute left-0 right-0 top-full z-40 mt-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500 shadow-xl">
                未找到匹配的处理项次
              </div>
            </>
          ) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className={`${TEXT} shrink-0 text-slate-500`}>状态</span>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className={SELECT}
          >
            <option value="">全部</option>
            <option value="pending">未处理</option>
            <option value="in_progress">正在处理</option>
            <option value="frozen">已冻结</option>
          </select>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className={`${TEXT} shrink-0 text-slate-500`}>时间轴</span>
          <div
            className={`inline-flex ${CONTROL_H} items-center rounded-md border border-slate-300 bg-slate-50 p-0.5`}
          >
            {ZOOM_LEVELS.map((level) => {
              const preset = TIMELINE_ZOOM_PRESETS[level];
              const active = zoomLevel === level;
              return (
                <button
                  key={level}
                  type="button"
                  onClick={() => onZoomLevelChange(level)}
                  title={`每行 ${preset.daysPerRow} 天`}
                  className={`inline-flex h-7 items-center rounded px-2.5 text-xs transition-colors ${
                    active
                      ? "bg-slate-900 text-white shadow-sm"
                      : "text-slate-600 hover:bg-white hover:text-slate-900"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {weeklyConfig && weeklyConfig.weeks.length > 0 ? (
        <div className="mt-2.5 flex min-w-0 flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5">
          {weeklyConfig.ownerSelect ? (
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-slate-600">
              配置人员
              <select
                value={weeklyConfig.ownerSelect.value}
                onChange={(e) => weeklyConfig.ownerSelect?.onChange(e.target.value)}
                className="h-7 max-w-[9rem] rounded border border-slate-300 bg-white px-2 text-xs text-slate-800"
              >
                {weeklyConfig.ownerSelect.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <TimelineWeeklyConfig
            weeks={weeklyConfig.weeks}
            canEdit={weeklyConfig.canEdit}
            onChange={weeklyConfig.onChange}
          />
        </div>
      ) : null}
    </div>
  );
}
