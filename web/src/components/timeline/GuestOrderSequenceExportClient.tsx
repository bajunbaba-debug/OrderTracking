"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/lib/auth/context";
import { ALL_OWNERS_WORKDAY_KEY } from "@/lib/auth/constants";
import { normalizeOwnerKey } from "@/lib/format";
import {
  computeAllSchedules,
  initOrderStates,
  projectToTimelineBase,
} from "@/lib/timeline/schedule";
import { loadTimelineState } from "@/lib/timeline/storage";
import type {
  ScheduledBlock,
  TimelinePersistedState,
  TimelineProjectBase,
} from "@/lib/timeline/types";

function formatExportDate(value: string | null) {
  return value ? value.replaceAll("-", "/") : "";
}

function escapeHtml(value: string | number | null) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function estimateTextWidth(value: string | number | null) {
  const text = String(value ?? "");
  let width = 0;
  for (const char of text) {
    width += /[\u4e00-\u9fff\uff00-\uffef]/.test(char) ? 15 : 8;
  }
  return width;
}

function buildOrderSequenceHtml(rows: (string | number | null)[][]) {
  const headers = [
    "顺序",
    "处理类型",
    "合同号",
    "项目名称",
    "型号",
    "数量",
    "常用备注",
    "额外备注",
    "交期",
    "预计开始",
    "预计完成",
  ];
  const colWidths = headers.map((header, colIndex) => {
    if (header === "项目名称") return 230;
    if (header === "交期" || header === "预计开始" || header === "预计完成") return 88;
    let maxTextWidth = estimateTextWidth(header);
    for (const row of rows) {
      maxTextWidth = Math.max(maxTextWidth, estimateTextWidth(row[colIndex]));
    }
    return Math.ceil(maxTextWidth + 24);
  });
  const colgroup = colWidths.map((width) => `<col style="width:${width}px">`).join("");
  const headerHtml = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const bodyHtml = rows
    .map((row) => `<tr>${row.map((value) => `<td>${escapeHtml(value)}</td>`).join("")}</tr>`)
    .join("");

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
table {
  border-collapse: collapse;
  table-layout: fixed;
  font-family: "Microsoft YaHei", Arial, sans-serif;
  font-size: 11pt;
}
th, td {
  border: 1px solid #b7c9e2;
  padding: 4px 8px;
  text-align: center;
  vertical-align: middle;
  white-space: normal;
  word-break: break-all;
  line-height: 18px;
}
th {
  height: 30px;
  background: #dbeafe;
  color: #1f2937;
  font-weight: 700;
}
td {
  height: 44px;
  mso-height-source: userset;
}
</style>
</head>
<body>
<table>
<colgroup>${colgroup}</colgroup>
<thead><tr>${headerHtml}</tr></thead>
<tbody>${bodyHtml}</tbody>
</table>
</body>
</html>`;
}

function downloadHtmlExcel(html: string, fileName: string) {
  const blob = new Blob(["\ufeff", html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function rowsForOwner(
  owner: string,
  schedules: Map<string, ScheduledBlock[]>,
  projectById: Map<string, TimelineProjectBase>
) {
  const rows: (string | number | null)[][] = [];
  let sequence = 1;
  for (const block of schedules.get(owner) ?? []) {
    if (block.kind !== "order" || !block.projectId) continue;
    const project = projectById.get(block.projectId);
    if (!project) continue;
    rows.push([
      sequence,
      project.type,
      project.contractNo,
      project.projectName,
      project.model,
      project.quantity,
      project.commonRemark,
      project.extraRemark,
      formatExportDate(project.dueDate),
      formatExportDate(block.startDate),
      formatExportDate(block.endDate),
    ]);
    sequence += 1;
  }
  return rows;
}

export function GuestOrderSequenceExportClient({ serverToday }: { serverToday: string }) {
  const { logout } = useAuth();
  const [projects, setProjects] = useState<TimelineProjectBase[]>([]);
  const [persisted, setPersisted] = useState<TimelinePersistedState>(() => loadTimelineState());
  const [loaded, setLoaded] = useState(false);
  const [selectedOwner, setSelectedOwner] = useState("");
  const [toast, setToast] = useState("");

  useEffect(() => {
    fetch("/api/projects?designStatus=incomplete")
      .then((r) => r.json())
      .then((data) => {
        const bases = (data as Parameters<typeof projectToTimelineBase>[0][]).map(projectToTimelineBase);
        setProjects(bases);
        setPersisted((prev) => ({
          ...prev,
          orderStates: initOrderStates(bases, prev.orderStates),
        }));
        setLoaded(true);
      });
  }, []);

  const owners = useMemo(
    () => [...new Set(projects.map((p) => normalizeOwnerKey(p.owner)).filter(Boolean))].sort(),
    [projects]
  );

  const effectiveSelectedOwner =
    selectedOwner && owners.includes(selectedOwner) ? selectedOwner : "";

  const schedules = useMemo(
    () => computeAllSchedules(projects, persisted, serverToday),
    [projects, persisted, serverToday]
  );

  const projectById = useMemo(
    () => new Map(projects.map((project) => [project.id, project])),
    [projects]
  );

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
  }, []);

  const handleExport = useCallback(() => {
    if (!effectiveSelectedOwner || effectiveSelectedOwner === ALL_OWNERS_WORKDAY_KEY) {
      showToast("请选择人员");
      return;
    }
    const rows = rowsForOwner(effectiveSelectedOwner, schedules, projectById);
    if (rows.length === 0) {
      showToast("该人员没有可导出的订单");
      return;
    }
    const safeOwner = effectiveSelectedOwner.replace(/[\\/:*?"<>|]/g, "_");
    downloadHtmlExcel(
      buildOrderSequenceHtml(rows),
      `订单顺序_${safeOwner}_${serverToday}.xls`
    );
    showToast(`已导出 ${rows.length} 条订单`);
  }, [effectiveSelectedOwner, projectById, schedules, serverToday, showToast]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-6">
      <button
        type="button"
        onClick={() => void logout()}
        className="absolute right-6 top-5 rounded border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100"
      >
        退出
      </button>
      <div className="flex w-full max-w-[10.5rem] flex-col items-center gap-3">
        <select
          value={effectiveSelectedOwner}
          onChange={(e) => setSelectedOwner(e.target.value)}
          disabled={!loaded || owners.length === 0}
          className="h-10 w-full rounded-lg border border-slate-300 bg-white px-2 text-center text-sm font-medium text-slate-800 shadow-sm ring-1 ring-transparent transition focus:border-slate-500 focus:outline-none focus:ring-slate-300 disabled:bg-slate-100 disabled:text-slate-400"
          aria-label="选择导出人员"
        >
          {owners.length === 0 ? (
            <option value="">暂无人员</option>
          ) : (
            <>
              <option value="">请选择</option>
              {owners.map((owner) => (
                <option key={owner} value={owner}>
                  {owner || "缺失"}
                </option>
              ))}
            </>
          )}
        </select>
        <button
          type="button"
          onClick={handleExport}
          disabled={!loaded}
          className="h-10 w-full rounded-lg bg-slate-900 px-3 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          导出订单顺序
        </button>
        {toast ? <div className="text-sm text-slate-500">{toast}</div> : null}
      </div>
    </div>
  );
}
