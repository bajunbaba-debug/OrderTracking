"use client";

import { useState } from "react";
import { effectiveDuration, roundTimelineTenth } from "@/lib/timeline/schedule";
import type { TimelineProjectBase, TimelineSearchResult } from "@/lib/timeline/types";

function ModalShell({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-lg border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <div className="mt-4 space-y-3">{children}</div>
      </div>
    </div>
  );
}

const fieldClass = "w-full rounded border border-slate-300 px-3 py-2 text-sm";
const labelClass = "mb-1 block text-xs text-slate-500";

function formatInsertOption(p: TimelineProjectBase): string {
  return `${p.contractNo}，${p.type}，${p.model}`;
}

export function PriorityInsertModal({
  projects,
  owner,
  onConfirm,
  onClose,
}: {
  projects: TimelineProjectBase[];
  owner: string;
  onConfirm: (data: {
    projectId: string;
    insertBeforeProjectId: string;
    reason: string;
    freezeCurrent: boolean;
    processedTime: number;
    notify: boolean;
  }) => void;
  onClose: () => void;
}) {
  const ownerProjects = projects.filter(
    (p) => p.owner === owner && p.designStatus !== "complete"
  );
  const [projectId, setProjectId] = useState(ownerProjects[0]?.id ?? "");
  const [insertBefore, setInsertBefore] = useState(ownerProjects[0]?.id ?? "");
  const [reason, setReason] = useState("");
  const [freezeCurrent, setFreezeCurrent] = useState(false);
  const [processedTime, setProcessedTime] = useState(0);
  const [notify, setNotify] = useState(true);

  return (
    <ModalShell title="插单" onClose={onClose}>
      <label className="block text-sm">
        <span className={labelClass}>插单订单</span>
        <select value={projectId} onChange={(e) => setProjectId(e.target.value)} className={fieldClass}>
          {ownerProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {formatInsertOption(p)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className={labelClass}>插入位置（在此订单之前）</span>
        <select
          value={insertBefore}
          onChange={(e) => setInsertBefore(e.target.value)}
          className={`${fieldClass} min-w-0`}
        >
          {ownerProjects.map((p) => (
            <option key={p.id} value={p.id}>
              {formatInsertOption(p)}
            </option>
          ))}
        </select>
      </label>
      <label className="block text-sm">
        <span className={labelClass}>影响人员</span>
        <input value={owner} readOnly className={`${fieldClass} bg-slate-50`} />
      </label>
      <label className="block text-sm">
        <span className={labelClass}>插单原因</span>
        <textarea value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass} rows={2} />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={freezeCurrent} onChange={(e) => setFreezeCurrent(e.target.checked)} />
        是否冻结当前处理订单
      </label>
      {freezeCurrent ? (
        <label className="block text-sm">
          <span className={labelClass}>已处理时间 k（工作日）</span>
          <input
            type="number"
            min={0}
            step={0.1}
            value={processedTime}
            onChange={(e) => setProcessedTime(roundTimelineTenth(Number(e.target.value)))}
            className={fieldClass}
          />
        </label>
      ) : null}
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />
        通知相关人员（演示字段）
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="rounded border border-slate-300 px-4 py-2 text-sm">
          取消
        </button>
        <button
          type="button"
          onClick={() =>
            onConfirm({
              projectId,
              insertBeforeProjectId: insertBefore,
              reason,
              freezeCurrent,
              processedTime: roundTimelineTenth(Math.max(0, processedTime)),
              notify,
            })
          }
          className="rounded bg-orange-600 px-4 py-2 text-sm text-white"
        >
          确认插单
        </button>
      </div>
    </ModalShell>
  );
}

export function FreezeModal({
  project,
  orderProcessedTime,
  onConfirm,
  onClose,
}: {
  project: TimelineProjectBase;
  orderProcessedTime: number;
  onConfirm: (data: {
    reason: string;
    processedTime: number;
    byPriority: boolean;
    byIncident: boolean;
    note: string;
  }) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState("");
  const [processedTime, setProcessedTime] = useState(orderProcessedTime);
  const [byPriority, setByPriority] = useState(false);
  const [byIncident, setByIncident] = useState(false);
  const [note, setNote] = useState("");

  const remaining = effectiveDuration(project.estimatedDays, {
    projectId: project.id,
    owner: project.owner,
    queueIndex: 0,
    status: "frozen",
    isPriorityInsert: false,
    processedTime: roundTimelineTenth(processedTime),
    restartExtra: 0,
    workStartDate: null,
    priorityReason: "",
    freezeReason: "",
    frozenAt: null,
    freezeByPriority: false,
    freezeByIncident: false,
    freezeNote: "",
    restartNote: "",
    lastProgressUpdate: null,
  });

  return (
    <ModalShell title="冻结订单" onClose={onClose}>
      <p className="text-sm text-slate-600">
        订单：{project.contractNo} · {project.model}
      </p>
      <label className="block text-sm">
        <span className={labelClass}>冻结原因</span>
        <input value={reason} onChange={(e) => setReason(e.target.value)} className={fieldClass} />
      </label>
      <label className="block text-sm">
        <span className={labelClass}>已处理时间 k（工作日）</span>
        <input
          type="number"
          min={0}
          max={project.estimatedDays}
          step={0.1}
          value={processedTime}
          onChange={(e) =>
            setProcessedTime(
              roundTimelineTenth(Math.max(0, Math.min(project.estimatedDays, Number(e.target.value))))
            )
          }
          className={fieldClass}
        />
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={byPriority} onChange={(e) => setByPriority(e.target.checked)} />
        是否由插单导致
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={byIncident} onChange={(e) => setByIncident(e.target.checked)} />
        是否由突发事件导致
      </label>
      <label className="block text-sm">
        <span className={labelClass}>备注</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} rows={2} />
      </label>
      <div className="rounded bg-slate-50 p-2 text-xs text-slate-600">
        剩余处理时间 = q + 预计 - k = 0 + {project.estimatedDays} - {roundTimelineTenth(processedTime)} ={" "}
        {remaining.toFixed(1)} 工作日（冻结后 q 默认为 0）
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="rounded border border-slate-300 px-4 py-2 text-sm">
          取消
        </button>
        <button
          type="button"
          onClick={() =>
            onConfirm({
              reason,
              processedTime: roundTimelineTenth(processedTime),
              byPriority,
              byIncident,
              note,
            })
          }
          className="rounded bg-slate-800 px-4 py-2 text-sm text-white"
        >
          确认冻结
        </button>
      </div>
    </ModalShell>
  );
}

export function RestartModal({
  project,
  processedTime,
  onConfirm,
  onClose,
}: {
  project: TimelineProjectBase;
  processedTime: number;
  onConfirm: (data: { restartExtra: number; note: string }) => void;
  onClose: () => void;
}) {
  const [restartExtra, setRestartExtra] = useState(1);
  const [note, setNote] = useState("");
  const remaining = effectiveDuration(project.estimatedDays, {
    projectId: project.id,
    owner: project.owner,
    queueIndex: 0,
    status: "frozen",
    isPriorityInsert: false,
    processedTime,
    restartExtra: roundTimelineTenth(restartExtra),
    workStartDate: null,
    priorityReason: "",
    freezeReason: "",
    frozenAt: null,
    freezeByPriority: false,
    freezeByIncident: false,
    freezeNote: "",
    restartNote: "",
    lastProgressUpdate: null,
  });

  return (
    <ModalShell title="再次启动" onClose={onClose}>
      <p className="text-sm text-slate-600">
        订单：{project.contractNo} · k = {processedTime} 工作日
      </p>
      <label className="block text-sm">
        <span className={labelClass}>再次启动时间 q（工作日）</span>
        <input
          type="number"
          min={0}
          step={0.1}
          value={restartExtra}
          onChange={(e) => setRestartExtra(roundTimelineTenth(Number(e.target.value)))}
          className={fieldClass}
        />
      </label>
      <div className="rounded border border-yellow-200 bg-yellow-50 p-3 text-sm">
        <div className="font-medium">计算公式</div>
        <div className="mt-1 font-mono text-xs">
          剩余 = q + 预计 - k = {roundTimelineTenth(restartExtra)} + {project.estimatedDays} - {processedTime} ={" "}
          {remaining.toFixed(1)} 工作日
        </div>
      </div>
      <label className="block text-sm">
        <span className={labelClass}>备注</span>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} className={fieldClass} rows={2} />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="rounded border border-slate-300 px-4 py-2 text-sm">
          取消
        </button>
        <button
          type="button"
          onClick={() => onConfirm({ restartExtra: roundTimelineTenth(restartExtra), note })}
          className="rounded bg-yellow-600 px-4 py-2 text-sm text-white"
        >
          确认启动
        </button>
      </div>
    </ModalShell>
  );
}

export function IncidentModal({
  owner,
  projects,
  onConfirm,
  onClose,
}: {
  owner: string;
  projects: TimelineProjectBase[];
  onConfirm: (data: {
    name: string;
    startDate: string;
    durationDays: number;
    affectedOrderIds: string[];
    description: string;
    insertBeforeQueueIndex: number;
  }) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [startDate, setStartDate] = useState("");
  const [durationDays, setDurationDays] = useState(2);
  const [description, setDescription] = useState("");
  const [affected, setAffected] = useState<string[]>([]);
  const [insertIndex, setInsertIndex] = useState(0);

  const ownerProjects = projects.filter((p) => p.owner === owner && p.designStatus !== "complete");

  return (
    <ModalShell title="创建突发事件 s" onClose={onClose}>
      <label className="block text-sm">
        <span className={labelClass}>事件名称</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={fieldClass} />
      </label>
      <label className="block text-sm">
        <span className={labelClass}>影响人员</span>
        <input value={owner} readOnly className={`${fieldClass} bg-slate-50`} />
      </label>
      <label className="block text-sm">
        <span className={labelClass}>开始时间</span>
        <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className={fieldClass} />
      </label>
      <label className="block text-sm">
        <span className={labelClass}>持续时间（工作日）</span>
        <input
          type="number"
          min={0.5}
          step={0.5}
          value={durationDays}
          onChange={(e) => setDurationDays(Number(e.target.value))}
          className={fieldClass}
        />
      </label>
      <label className="block text-sm">
        <span className={labelClass}>插入位置（队列序号）</span>
        <input
          type="number"
          min={0}
          value={insertIndex}
          onChange={(e) => setInsertIndex(Number(e.target.value))}
          className={fieldClass}
        />
      </label>
      <div className="text-sm">
        <span className={labelClass}>影响订单</span>
        <div className="max-h-32 space-y-1 overflow-y-auto rounded border border-slate-200 p-2">
          {ownerProjects.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={affected.includes(p.id)}
                onChange={(e) => {
                  setAffected((prev) =>
                    e.target.checked ? [...prev, p.id] : prev.filter((id) => id !== p.id)
                  );
                }}
              />
              {formatInsertOption(p)}
            </label>
          ))}
        </div>
      </div>
      <label className="block text-sm">
        <span className={labelClass}>说明</span>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} className={fieldClass} rows={2} />
      </label>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onClose} className="rounded border border-slate-300 px-4 py-2 text-sm">
          取消
        </button>
        <button
          type="button"
          onClick={() =>
            onConfirm({
              name,
              startDate,
              durationDays,
              affectedOrderIds: affected,
              description,
              insertBeforeQueueIndex: insertIndex,
            })
          }
          className="rounded bg-purple-700 px-4 py-2 text-sm text-white"
        >
          创建事件
        </button>
      </div>
    </ModalShell>
  );
}

export function RiskAlertBanner({
  count,
  messages,
  onDismiss,
}: {
  count: number;
  messages: string[];
  onDismiss: () => void;
}) {
  if (count <= 0) return null;
  return (
    <div className="mb-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <div className="flex items-start justify-between gap-2">
        <div>
          <strong>风险汇总：{count} 项</strong>
          <ul className="mt-1 list-inside list-disc text-xs">
            {messages.slice(0, 5).map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        </div>
        <button type="button" onClick={onDismiss} className="text-xs text-red-600 hover:underline">
          收起
        </button>
      </div>
    </div>
  );
}

export function SearchResultsPanel({
  results,
  onSelect,
}: {
  results: TimelineSearchResult[];
  onSelect: (projectId: string, owner: string) => void;
}) {
  if (results.length === 0) return null;
  return (
    <div className="mb-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
      <p className="mb-2 text-xs font-medium text-blue-900">搜索结果 ({results.length})</p>
      <ul className="space-y-1">
        {results.map((r) => (
          <li key={r.projectId}>
            <button
              type="button"
              onClick={() => onSelect(r.projectId, r.owner)}
              className="w-full rounded px-2 py-1.5 text-left text-xs hover:bg-blue-100"
            >
              <span className="font-medium">{r.contractNo}</span>
              <span className="ml-2 text-blue-700">{r.owner}</span>
              <span className="ml-2 text-blue-600">{r.type}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
