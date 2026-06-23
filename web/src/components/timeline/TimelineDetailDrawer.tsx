"use client";

import Link from "next/link";
import { useState } from "react";
import { formatDate, formatNumber } from "@/lib/format";
import {
  RISK_TYPE_LABELS,
  STATUS_LABELS,
  effectiveDuration,
  roundTimelineTenth,
} from "@/lib/timeline/schedule";
import type {
  RelatedOrderItem,
  ScheduledBlock,
  TimelineOperationLog,
  TimelineOrderState,
  TimelineProjectBase,
} from "@/lib/timeline/types";

interface Props {
  open: boolean;
  block: ScheduledBlock | null;
  project: TimelineProjectBase | null;
  orderState: TimelineOrderState | null;
  relatedItems: RelatedOrderItem[];
  logs: TimelineOperationLog[];
  canEdit: boolean;
  isAdmin: boolean;
  onClose: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveTop: () => void;
  onSetInProgress: (startDate: string, processedTime: number) => void;
  onUnmarkInProgress: () => void;
  onUpdateProcessedTime: (processedTime: number) => void;
  onOpenPriorityInsert: () => void;
  onOpenFreeze: () => void;
  onUnfreeze: () => void;
  onOpenRestart: () => void;
  onOpenIncident: () => void;
  onUpdateEstimate: (days: number) => void;
  onSelectRelated: (projectId: string, owner: string) => void;
  queuePosition: { index: number; total: number } | null;
}

function todayDateStr(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TimelineDetailDrawer({
  open,
  block,
  project,
  orderState,
  relatedItems,
  logs,
  canEdit,
  isAdmin,
  onClose,
  onMoveUp,
  onMoveDown,
  onMoveTop,
  onSetInProgress,
  onUnmarkInProgress,
  onUpdateProcessedTime,
  onOpenPriorityInsert,
  onOpenFreeze,
  onUnfreeze,
  onOpenRestart,
  onOpenIncident,
  onUpdateEstimate,
  onSelectRelated,
  queuePosition,
}: Props) {
  const [logsExpanded, setLogsExpanded] = useState(false);

  if (!open || !block) return null;

  const remaining =
    project && orderState
      ? effectiveDuration(project.estimatedDays, orderState)
      : block.durationDays;

  const relatedLogs = logs
    .filter(
      (l) =>
        l.before.includes(block.label) ||
        l.after.includes(block.label) ||
        (block.projectId &&
          (l.before.includes(block.projectId) || l.after.includes(block.projectId)))
    )
    .slice(0, 8);

  const isInProgress = orderState?.status === "in_progress";
  const isFrozen = orderState?.status === "frozen";
  const canFreeze = isInProgress;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-[1px]"
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-slate-900">
            {block.kind === "incident" ? "突发事件详情" : "订单详情"}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-800"
            aria-label="关闭"
          >
            ✕
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 text-sm">
          {block.isDelayed ? (
            <div className="mb-3 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
              ⚠ 存在延期风险
              {block.risks.map((r) => (
                <div key={r}>· {RISK_TYPE_LABELS[r]}</div>
              ))}
            </div>
          ) : null}

          {project ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-slate-500">订单号</dt>
              <dd>{project.contractNo || "-"}</dd>
              <dt className="text-slate-500">型号</dt>
              <dd>{project.model}</dd>
              <dt className="text-slate-500">处理类型</dt>
              <dd>{project.type}</dd>
              <dt className="text-slate-500">负责人</dt>
              <dd>{project.owner}</dd>
              <dt className="text-slate-500">交货日期</dt>
              <dd>{formatDate(project.dueDate)}</dd>
              <dt className="text-slate-500">预计处理</dt>
              <dd>{formatNumber(project.estimatedDays)} 工作日</dd>
              <dt className="text-slate-500">预计开始</dt>
              <dd>{formatDate(block.startDate)}</dd>
              <dt className="text-slate-500">预计完成</dt>
              <dd>{formatDate(block.endDate)}</dd>
              <dt className="text-slate-500">当前状态</dt>
              <dd>{orderState ? STATUS_LABELS[orderState.status] : "-"}</dd>
              <dt className="text-slate-500">已处理时间 k</dt>
              <dd>{formatNumber(orderState?.processedTime ?? 0)} 工作日</dd>
              <dt className="text-slate-500">插单</dt>
              <dd>{orderState?.isPriorityInsert ? "是" : "否"}</dd>
              <dt className="text-slate-500">冻结</dt>
              <dd>{isFrozen ? "是" : "否"}</dd>
              <dt className="text-slate-500">突发事件影响</dt>
              <dd>{block.affectedByIncident ? "是" : "否"}</dd>
            </dl>
          ) : block.kind === "incident" ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
              <dt className="text-slate-500">事件名称</dt>
              <dd>{block.label}</dd>
              <dt className="text-slate-500">影响人员</dt>
              <dd>{block.owner}</dd>
              <dt className="text-slate-500">开始时间</dt>
              <dd>{formatDate(block.startDate)}</dd>
              <dt className="text-slate-500">持续时间</dt>
              <dd>{block.durationDays} 工作日</dd>
              <dt className="text-slate-500">说明</dt>
              <dd>{block.subLabel}</dd>
            </dl>
          ) : null}

          {isFrozen || (orderState?.restartExtra ?? 0) > 0 ? (
            <div className="mt-3 rounded border border-amber-200 bg-amber-50 p-2 text-xs">
              <div className="font-medium text-amber-900">剩余处理时间公式</div>
              <div className="mt-1 font-mono text-amber-800">
                q + 预计 - k = {orderState?.restartExtra ?? 0} + {project?.estimatedDays ?? 0} -{" "}
                {formatNumber(orderState?.processedTime ?? 0)} = {formatNumber(remaining)} 工作日
              </div>
            </div>
          ) : null}

          {queuePosition ? (
            <p className="mt-2 text-xs text-slate-500">
              队列位置：{queuePosition.index + 1} / {queuePosition.total}
            </p>
          ) : null}

          {!canEdit && block.kind === "order" ? (
            <p className="mt-4 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-500">
              当前为只读模式，无法调整顺序、插单、冻结或修改周末配置。
            </p>
          ) : null}

          {canEdit && block.kind === "order" && orderState?.status !== "complete" ? (
            <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
              <p className="text-xs font-medium text-slate-700">顺序调整</p>
              <div className="flex flex-wrap gap-1">
                <ActionBtn disabled={isFrozen} onClick={onMoveUp}>
                  上移
                </ActionBtn>
                <ActionBtn disabled={isFrozen} onClick={onMoveDown}>
                  下移
                </ActionBtn>
                <ActionBtn disabled={isFrozen} onClick={onMoveTop}>
                  置顶
                </ActionBtn>
              </div>
              <p className="text-xs font-medium text-slate-700">处理操作</p>
              {isInProgress ? (
                <ProcessedTimeEditor
                  value={orderState.processedTime}
                  max={project?.estimatedDays ?? 999}
                  onSave={onUpdateProcessedTime}
                />
              ) : (
                <MarkInProgress onConfirm={onSetInProgress} maxProcessed={project?.estimatedDays ?? 999} />
              )}
              {isInProgress ? (
                <ActionBtn full onClick={onUnmarkInProgress} className="border-slate-400 bg-slate-50">
                  反标记处理
                </ActionBtn>
              ) : null}
              <ActionBtn full onClick={onOpenPriorityInsert} className="border-orange-300 bg-orange-50 text-orange-800">
                插单
              </ActionBtn>
              <ActionBtn
                full
                disabled={!canFreeze}
                onClick={onOpenFreeze}
                title={canFreeze ? undefined : "仅正在处理中的订单可冻结"}
              >
                冻结
              </ActionBtn>
              {isFrozen ? (
                <>
                  <ActionBtn full onClick={onUnfreeze} className="border-blue-400 bg-blue-50 text-blue-900">
                    反冻结
                  </ActionBtn>
                  <ActionBtn full onClick={onOpenRestart} className="border-yellow-400 bg-yellow-50">
                    再次启动
                  </ActionBtn>
                </>
              ) : null}
              {isAdmin ? (
                <>
                  <ActionBtn full onClick={onOpenIncident} className="border-purple-300 bg-purple-50 text-purple-800">
                    创建突发事件
                  </ActionBtn>
                  <EstimateEditor value={project?.estimatedDays ?? 0} onSave={onUpdateEstimate} />
                </>
              ) : null}
            </div>
          ) : null}

          {project && canEdit ? (
            <Link
              href={`/projects/${project.id}/edit?from=timeline&owner=${encodeURIComponent(project.owner)}`}
              className="mt-3 inline-block text-xs text-blue-700 hover:underline"
            >
              在明细中编辑 →
            </Link>
          ) : null}

          <div className="mt-4 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => setLogsExpanded((v) => !v)}
              className="flex w-full items-center justify-between text-xs font-medium text-slate-700"
            >
              <span>操作记录（{relatedLogs.length}）</span>
              <span className="font-normal text-slate-400">{logsExpanded ? "收起" : "展开"}</span>
            </button>
            {logsExpanded ? (
              relatedLogs.length > 0 ? (
                <ul className="mt-2 space-y-2">
                  {relatedLogs.map((log) => (
                    <li key={log.id} className="rounded bg-slate-50 p-2 text-[11px] text-slate-600">
                      <div className="font-medium text-slate-800">
                        {log.operator} · {new Date(log.timestamp).toLocaleString("zh-CN")}
                      </div>
                      <div>{log.reason || log.action}</div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-2 text-[11px] text-slate-400">暂无相关操作记录</p>
              )
            ) : null}
          </div>

          {relatedItems.length > 0 || project ? (
            <div className="mt-4 border-t border-slate-100 pt-3">
              <p className="mb-2 text-xs font-medium text-slate-700">
                同订单其他人员/项次（{relatedItems.length + (project ? 1 : 0)} 项）
              </p>
              <ul className="space-y-2">
                {project ? (
                  <li className="rounded border border-slate-900 bg-slate-50 p-2 text-[11px]">
                    <div className="font-medium">{project.owner}（当前）</div>
                    <div className="text-slate-600">
                      {project.type} · {formatDate(block.startDate)} → {formatDate(block.endDate)}
                    </div>
                  </li>
                ) : null}
                {relatedItems.map((item) => (
                  <li key={item.projectId}>
                    <button
                      type="button"
                      onClick={() => onSelectRelated(item.projectId, item.owner)}
                      className="w-full rounded border border-slate-200 p-2 text-left text-[11px] hover:border-blue-300 hover:bg-blue-50"
                    >
                      <div className="font-medium text-slate-800">{item.owner}</div>
                      <div className="text-slate-600">
                        {item.type} · {item.model} · {STATUS_LABELS[item.status]}
                        {item.queuePosition
                          ? ` · 队列 ${item.queuePosition.index + 1}/${item.queuePosition.total}`
                          : ""}
                      </div>
                      <div className="text-slate-400">
                        {formatDate(item.startDate)} → {formatDate(item.endDate)}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      </aside>
    </>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  full,
  className = "",
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  full?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={title}
      className={`rounded border border-slate-300 px-2 py-1.5 text-xs disabled:cursor-not-allowed disabled:opacity-40 ${
        full ? "block w-full" : ""
      } ${className}`}
    >
      {children}
    </button>
  );
}

function MarkInProgress({
  onConfirm,
  maxProcessed,
}: {
  onConfirm: (startDate: string, processedTime: number) => void;
  maxProcessed: number;
}) {
  const minDate = todayDateStr();
  return (
    <form
      className="space-y-1"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const date = String(fd.get("startDate") || "");
        const processed = roundTimelineTenth(Number(fd.get("processedTime") || 0));
        if (date) onConfirm(date, Math.max(0, Math.min(maxProcessed, processed)));
      }}
    >
      <div className="flex gap-1">
        <input
          name="startDate"
          type="date"
          required
          min={minDate}
          defaultValue={minDate}
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
        />
        <button type="submit" className="rounded bg-green-700 px-2 py-1 text-xs text-white">
          标记处理中
        </button>
      </div>
      <label className="flex items-center gap-1 text-[11px] text-slate-500">
        已处理时间 k
        <input
          name="processedTime"
          type="number"
          step={0.1}
          min={0}
          max={maxProcessed}
          defaultValue={0}
          className="w-16 rounded border border-slate-300 px-2 py-0.5 text-xs"
        />
        工作日
      </label>
    </form>
  );
}

function ProcessedTimeEditor({
  value,
  max,
  onSave,
}: {
  value: number;
  max: number;
  onSave: (processedTime: number) => void;
}) {
  return (
    <form
      className="flex flex-wrap items-center gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const processed = roundTimelineTenth(Number(fd.get("processedTime") || 0));
        onSave(Math.max(0, Math.min(max, processed)));
      }}
    >
      <span className="text-[11px] text-slate-500">已处理时间 k</span>
      <input
        name="processedTime"
        type="number"
        step={0.1}
        min={0}
        max={max}
        defaultValue={value}
        key={value}
        className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
      />
      <button type="submit" className="rounded border border-slate-300 px-2 py-1 text-xs">
        更新
      </button>
    </form>
  );
}

function EstimateEditor({
  value,
  onSave,
}: {
  value: number;
  onSave: (days: number) => void;
}) {
  return (
    <form
      className="flex gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const days = Number(fd.get("days"));
        if (days > 0) onSave(days);
      }}
    >
      <input
        name="days"
        type="number"
        step={0.1}
        min={0.1}
        defaultValue={value}
        className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
      />
      <button type="submit" className="rounded border border-slate-300 px-2 py-1 text-xs">
        修改预计
      </button>
    </form>
  );
}
