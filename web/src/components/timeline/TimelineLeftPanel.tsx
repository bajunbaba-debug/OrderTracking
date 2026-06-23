"use client";

import { formatDate } from "@/lib/format";
import type { MemberTimelineSummary } from "@/lib/timeline/types";

const LOAD_LABELS = {
  normal: { text: "正常", className: "bg-green-100 text-green-800" },
  high: { text: "偏高", className: "bg-orange-100 text-orange-800" },
  critical: { text: "过高", className: "bg-red-100 text-red-800" },
};

interface Props {
  members: MemberTimelineSummary[];
  selectedOwner: string | null;
  onSelectOwner: (owner: string | null) => void;
  search: string;
  onSearchChange: (v: string) => void;
  department: string;
  onDepartmentChange: (v: string) => void;
  statusFilter: string;
  onStatusFilterChange: (v: string) => void;
  dateFrom: string;
  dateTo: string;
  onDateFromChange: (v: string) => void;
  onDateToChange: (v: string) => void;
  onlyDelayed: boolean;
  onlyPriority: boolean;
  onlyFrozen: boolean;
  onlyIncident: boolean;
  onToggleDelayed: () => void;
  onTogglePriority: () => void;
  onToggleFrozen: () => void;
  onToggleIncident: () => void;
  departments: string[];
  visibleOwners: string[];
}

export function TimelineLeftPanel({
  members,
  selectedOwner,
  onSelectOwner,
  search,
  onSearchChange,
  department,
  onDepartmentChange,
  statusFilter,
  onStatusFilterChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  onlyDelayed,
  onlyPriority,
  onlyFrozen,
  onlyIncident,
  onToggleDelayed,
  onTogglePriority,
  onToggleFrozen,
  onToggleIncident,
  departments,
  visibleOwners,
}: Props) {
  const filtered = members.filter((m) => visibleOwners.includes(m.owner));

  return (
    <aside className="flex h-full flex-col gap-3 overflow-hidden rounded-lg border border-slate-200 bg-white p-3">
      <div>
        <label className="mb-1 block text-xs font-medium text-slate-500">订单号搜索</label>
        <input
          type="search"
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="输入合同号/项目名"
          className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500">部门</label>
          <select
            value={department}
            onChange={(e) => onDepartmentChange(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="">全部</option>
            {departments.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">状态</label>
          <select
            value={statusFilter}
            onChange={(e) => onStatusFilterChange(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          >
            <option value="">全部</option>
            <option value="pending">未处理</option>
            <option value="in_progress">正在处理</option>
            <option value="frozen">已冻结</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="mb-1 block text-xs text-slate-500">开始日期</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => onDateFromChange(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-slate-500">结束日期</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => onDateToChange(e.target.value)}
            className="w-full rounded border border-slate-300 px-2 py-1 text-xs"
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {[
          { active: onlyDelayed, onClick: onToggleDelayed, label: "延期风险" },
          { active: onlyPriority, onClick: onTogglePriority, label: "插单" },
          { active: onlyFrozen, onClick: onToggleFrozen, label: "冻结" },
          { active: onlyIncident, onClick: onToggleIncident, label: "突发事件" },
        ].map((chip) => (
          <button
            key={chip.label}
            type="button"
            onClick={chip.onClick}
            className={`rounded-full px-2 py-0.5 text-xs ${
              chip.active
                ? "bg-slate-900 text-white"
                : "border border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-500">人员列表</span>
        <button
          type="button"
          onClick={() => onSelectOwner(null)}
          className="text-xs text-blue-700 hover:underline"
        >
          显示全部
        </button>
      </div>

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
        {filtered.map((m) => {
          const load = LOAD_LABELS[m.loadStatus];
          const active = selectedOwner === m.owner;
          return (
            <button
              key={m.owner}
              type="button"
              onClick={() => onSelectOwner(active ? null : m.owner)}
              className={`w-full rounded-lg border p-2.5 text-left transition-colors ${
                active
                  ? "border-slate-900 bg-slate-900 text-white"
                  : "border-slate-200 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{m.owner}</span>
                <span
                  className={`rounded px-1.5 py-0.5 text-[10px] ${
                    active ? "bg-white/20 text-white" : load.className
                  }`}
                >
                  {load.text}
                </span>
              </div>
              <div className={`mt-1 text-[11px] ${active ? "text-slate-200" : "text-slate-500"}`}>
                未处理 {m.pendingCount} · 风险 {m.riskCount}
              </div>
              <div className={`text-[11px] ${active ? "text-slate-300" : "text-slate-400"}`}>
                最早交期 {m.earliestDue ? formatDate(m.earliestDue) : "-"}
              </div>
              {m.currentOrder ? (
                <div className={`mt-1 truncate text-[11px] ${active ? "text-green-200" : "text-green-700"}`}>
                  当前：{m.currentOrder}
                </div>
              ) : null}
            </button>
          );
        })}
      </div>
    </aside>
  );
}
