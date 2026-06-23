"use client";

import { useEffect, useRef, useState } from "react";
import type { MemberWorkdayConfig } from "@/lib/timeline/workdays";

const CONFIG_TITLE = "周末加班配置";

interface WeekItem {
  weekStart: string;
  label: string;
  config: MemberWorkdayConfig;
}

interface Props {
  weeks: WeekItem[];
  canEdit: boolean;
  onChange: (weekStart: string, patch: Partial<MemberWorkdayConfig>) => void;
}

function WeekDayChip({
  label,
  active,
  canEdit,
  onToggle,
}: {
  label: string;
  active: boolean;
  canEdit: boolean;
  onToggle: () => void;
}) {
  const base =
    "inline-flex h-5 min-w-5 items-center justify-center rounded px-1 text-[9px] font-medium leading-none";
  const tone = active ? "bg-slate-800 text-white" : "bg-slate-100 text-slate-500";

  if (!canEdit) {
    return (
      <span
        className={`${base} ${tone} ${active ? "" : "opacity-70"}`}
        title={active ? `${label}工作` : `${label}休息`}
      >
        {label}
      </span>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className={`${base} ${tone} hover:ring-1 hover:ring-slate-300`}
      title={active ? "点击设为休息" : "点击设为工作"}
    >
      {label}
    </button>
  );
}

function WeekRow({
  weeks,
  canEdit,
  onChange,
}: {
  weeks: WeekItem[];
  canEdit: boolean;
  onChange: Props["onChange"];
}) {
  return (
    <div className="flex max-w-full flex-nowrap items-center gap-1 overflow-x-auto">
      {weeks.map(({ weekStart, label, config }) => (
        <div
          key={weekStart}
          className="flex shrink-0 items-center gap-0.5 rounded border border-slate-200 bg-white px-1 py-0.5"
          title={`${label}（${weekStart.slice(5)} 起）`}
        >
          <span className="shrink-0 pr-0.5 text-[9px] font-medium text-slate-600">{label}</span>
          <WeekDayChip
            label="六"
            active={config.saturdayWork}
            canEdit={canEdit}
            onToggle={() => onChange(weekStart, { saturdayWork: !config.saturdayWork })}
          />
          <WeekDayChip
            label="日"
            active={config.sundayWork}
            canEdit={canEdit}
            onToggle={() => onChange(weekStart, { sundayWork: !config.sundayWork })}
          />
        </div>
      ))}
    </div>
  );
}

export function TimelineWeeklyConfig({ weeks, canEdit, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (weeks.length === 0) return null;

  return (
    <div ref={wrapRef} className="relative shrink-0">
      <div className="hidden items-center gap-1.5 lg:flex">
        <span className="shrink-0 text-[9px] font-medium text-slate-600">{CONFIG_TITLE}</span>
        {!canEdit ? <span className="shrink-0 text-[9px] text-slate-400">只读</span> : null}
        <WeekRow weeks={weeks} canEdit={canEdit} onChange={onChange} />
      </div>

      <div className="lg:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="whitespace-nowrap rounded border border-slate-200 bg-white px-2 py-1 text-[10px] text-slate-700 shadow-sm"
        >
          {CONFIG_TITLE}
          {!canEdit ? "·只读" : ""}
        </button>
        {open ? (
          <div className="absolute right-0 top-full z-20 mt-1 max-w-[calc(100vw-2rem)] rounded-md border border-slate-200 bg-white p-2 shadow-lg">
            <WeekRow weeks={weeks} canEdit={canEdit} onChange={onChange} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
