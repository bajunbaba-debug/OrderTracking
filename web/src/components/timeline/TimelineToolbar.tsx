"use client";

import { useRef } from "react";
import { formatDate } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/timeline/schedule";
import type { TimelineZoomLevel } from "@/lib/timeline/zoom";
import { ZOOM_LEVELS, TIMELINE_ZOOM_PRESETS } from "@/lib/timeline/zoom";
import type { MemberTimelineSummary, TimelineSearchResult } from "@/lib/timeline/types";

const SEARCH_PREVIEW_LIMIT = 8;

/** 工具栏统一尺寸 */
const LABEL = "mb-1 block h-4 text-xs leading-4 text-slate-500";
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
    <div className="min-w-[140px] max-w-md flex-1 self-end rounded-md border border-slate-200 bg-slate-50 px-2 py-1">
      <div className="max-h-12 overflow-y-auto overflow-x-hidden">
        <div className="flex flex-wrap gap-1">
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
              className={toggleChipClass(focusedOwner === m.owner)}
            >
              {m.owner}
              {m.riskCount > 0 ? `(${m.riskCount})` : ""}
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
}: Props) {
  const searchWrapRef = useRef<HTMLDivElement>(null);

  const preview = searchResults.slice(0, SEARCH_PREVIEW_LIMIT);
  const moreCount = Math.max(0, searchResults.length - SEARCH_PREVIEW_LIMIT);

  return (
    <div className="mb-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div ref={searchWrapRef} className="relative min-w-[240px] flex-1">
          <div className="mb-1 flex h-4 items-center gap-2">
            <span className={`${TEXT} text-slate-500`}>订单号搜索</span>
            <button type="button" onClick={onToggleDelayed} className={toggleChipClass(onlyDelayed)}>
              延期风险
            </button>
          </div>
          <div className="flex flex-wrap items-end gap-2">
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
              placeholder="合同号 / 项目名"
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
          </div>
          {searchOpen && searchResults.length > 0 ? (
            <>
              <div className="fixed inset-0 z-30" onClick={onSearchClose} aria-hidden="true" />
              <div className="absolute left-0 right-0 top-full z-40 mt-1 max-h-72 overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-xl">
                <p className="px-3 py-1 text-xs text-slate-500">共 {searchResults.length} 条处理项次</p>
                {preview.map((r) => (
                  <button
                    key={r.projectId}
                    type="button"
                    onClick={() => {
                      onSearchSelect(r.projectId, r.owner);
                      onSearchClose();
                    }}
                    className="block w-full border-b border-slate-50 px-3 py-2 text-left text-xs hover:bg-slate-50"
                  >
                    <div className="font-medium text-slate-900">
                      {r.contractNo}
                      <span className="ml-2 font-normal text-slate-500">{r.owner}</span>
                    </div>
                    <div className="mt-0.5 text-slate-600">
                      {r.type} · {r.model} · {STATUS_LABELS[r.status]}
                      {r.queuePosition
                        ? ` · 队列 ${r.queuePosition.index + 1}/${r.queuePosition.total}`
                        : ""}
                    </div>
                    <div className="text-slate-400">
                      {formatDate(r.startDate)} → {formatDate(r.endDate)}
                    </div>
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

        <div className="flex shrink-0 flex-wrap items-end gap-3">
          <div>
            <label className={LABEL}>状态</label>
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

          <div>
            <span className={LABEL}>时间轴</span>
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
      </div>
    </div>
  );
}
