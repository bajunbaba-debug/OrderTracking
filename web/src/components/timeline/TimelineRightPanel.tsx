"use client";

import Link from "next/link";
import { formatNumber } from "@/lib/format";
import { DisplayDate, DisplayNumber, DisplayText } from "@/components/ui";
import {
  RISK_TYPE_LABELS,
  STATUS_LABELS,
  effectiveDuration,
} from "@/lib/timeline/schedule";
import type {
  ScheduledBlock,
  TimelineOperationLog,
  TimelineOrderState,
  TimelineProjectBase,
} from "@/lib/timeline/types";

interface Props {
  block: ScheduledBlock | null;
  project: TimelineProjectBase | null;
  orderState: TimelineOrderState | null;
  logs: TimelineOperationLog[];
  canEdit: boolean;
  isAdmin: boolean;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onMoveTop: () => void;
  onSetInProgress: (startDate: string) => void;
  onOpenPriorityInsert: () => void;
  onOpenFreeze: () => void;
  onOpenRestart: () => void;
  onOpenIncident: () => void;
  onUpdateEstimate: (days: number) => void;
  queuePosition: { index: number; total: number } | null;
}

export function TimelineRightPanel({
  block,
  project,
  orderState,
  logs,
  canEdit,
  isAdmin,
  onMoveUp,
  onMoveDown,
  onMoveTop,
  onSetInProgress,
  onOpenPriorityInsert,
  onOpenFreeze,
  onOpenRestart,
  onOpenIncident,
  onUpdateEstimate,
  queuePosition,
}: Props) {
  if (!block && !project) {
    return (
      <aside className="flex h-full flex-col rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm text-slate-500">点击时间流中的订单条，或搜索订单号查看详情与操作。</p>
      </aside>
    );
  }

  const remaining =
    project && orderState
      ? effectiveDuration(project.estimatedDays, orderState)
      : block?.durationDays ?? 0;

  const relatedLogs = logs.filter(
    (l) =>
      block &&
      (l.before.includes(block.label) ||
        l.after.includes(block.label) ||
        (block.projectId && (l.before.includes(block.projectId) || l.after.includes(block.projectId))))
  ).slice(0, 8);

  return (
    <aside className="flex h-full flex-col overflow-hidden rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <h3 className="text-sm font-semibold text-slate-900">
          {block?.kind === "incident" ? "突发事件详情" : "订单详情"}
        </h3>
        {block?.isDelayed ? (
          <div className="mt-2 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
            ⚠ 存在延期风险
            {block.risks.map((r) => (
              <div key={r}>· {RISK_TYPE_LABELS[r]}</div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4 text-sm">
        {project ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-slate-500">订单号</dt>
            <dd><DisplayText value={project.contractNo} /></dd>
            <dt className="text-slate-500">型号</dt>
            <dd><DisplayText value={project.model} /></dd>
            <dt className="text-slate-500">处理类型</dt>
            <dd><DisplayText value={project.type} /></dd>
            <dt className="text-slate-500">负责人</dt>
            <dd><DisplayText value={project.owner} /></dd>
            <dt className="text-slate-500">交货日期</dt>
            <dd><DisplayDate value={project.dueDate} /></dd>
            <dt className="text-slate-500">预计处理</dt>
            <dd><DisplayNumber value={project.estimatedDays} /> 工作日</dd>
            {block ? (
              <>
                <dt className="text-slate-500">预计开始</dt>
                <dd><DisplayDate value={block.startDate} /></dd>
                <dt className="text-slate-500">预计完成</dt>
                <dd><DisplayDate value={block.endDate} /></dd>
              </>
            ) : null}
            <dt className="text-slate-500">当前状态</dt>
            <dd>{orderState ? STATUS_LABELS[orderState.status] : <DisplayText value="" />}</dd>
            <dt className="text-slate-500">插单</dt>
            <dd>{orderState?.isPriorityInsert ? "是" : "否"}</dd>
            <dt className="text-slate-500">冻结</dt>
            <dd>{orderState?.status === "frozen" ? "是" : "否"}</dd>
            <dt className="text-slate-500">突发事件影响</dt>
            <dd>{block?.affectedByIncident ? "是" : "否"}</dd>
          </dl>
        ) : block?.kind === "incident" ? (
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
            <dt className="text-slate-500">事件名称</dt>
            <dd>{block.label}</dd>
            <dt className="text-slate-500">影响人员</dt>
            <dd><DisplayText value={block.owner} /></dd>
            <dt className="text-slate-500">开始时间</dt>
            <dd><DisplayDate value={block.startDate} /></dd>
            <dt className="text-slate-500">持续时间</dt>
            <dd>{block.durationDays} 天</dd>
            <dt className="text-slate-500">说明</dt>
            <dd>{block.subLabel}</dd>
          </dl>
        ) : null}

        {orderState?.status === "frozen" || orderState?.restartExtra ? (
          <div className="rounded border border-amber-200 bg-amber-50 p-2 text-xs">
            <div className="font-medium text-amber-900">剩余处理时间公式</div>
            <div className="mt-1 font-mono text-amber-800">
              q + 预计 - k = {orderState.restartExtra} + {project?.estimatedDays ?? 0} -{" "}
              {formatNumber(orderState.processedTime)} = {formatNumber(remaining)} 天
            </div>
          </div>
        ) : null}

        {queuePosition ? (
          <p className="text-xs text-slate-500">
            队列位置：{queuePosition.index + 1} / {queuePosition.total}
          </p>
        ) : null}

        {canEdit && block?.kind === "order" && orderState?.status !== "complete" ? (
          <div className="space-y-2 border-t border-slate-100 pt-3">
            <p className="text-xs font-medium text-slate-700">顺序调整</p>
            <div className="flex flex-wrap gap-1">
              <button
                type="button"
                disabled={orderState?.status === "frozen"}
                onClick={onMoveUp}
                className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
              >
                上移
              </button>
              <button
                type="button"
                disabled={orderState?.status === "frozen"}
                onClick={onMoveDown}
                className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
              >
                下移
              </button>
              <button
                type="button"
                disabled={orderState?.status === "frozen"}
                onClick={onMoveTop}
                className="rounded border border-slate-300 px-2 py-1 text-xs disabled:opacity-40"
              >
                置顶
              </button>
            </div>

            <p className="text-xs font-medium text-slate-700">处理操作</p>
            <MarkInProgress onConfirm={onSetInProgress} />
            <button
              type="button"
              onClick={onOpenPriorityInsert}
              className="block w-full rounded border border-orange-300 bg-orange-50 px-2 py-1.5 text-xs text-orange-800"
            >
              插单
            </button>
            <button
              type="button"
              onClick={onOpenFreeze}
              className="block w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
            >
              冻结
            </button>
            {orderState?.status === "frozen" ? (
              <button
                type="button"
                onClick={onOpenRestart}
                className="block w-full rounded border border-yellow-400 bg-yellow-50 px-2 py-1.5 text-xs"
              >
                再次启动
              </button>
            ) : null}
            {isAdmin ? (
              <>
                <button
                  type="button"
                  onClick={onOpenIncident}
                  className="block w-full rounded border border-purple-300 bg-purple-50 px-2 py-1.5 text-xs text-purple-800"
                >
                  创建突发事件
                </button>
                <EstimateEditor
                  value={project?.estimatedDays ?? 0}
                  onSave={onUpdateEstimate}
                />
              </>
            ) : null}
          </div>
        ) : null}

        {project ? (
          <Link
            href={`/projects/${project.id}/edit`}
            className="inline-block text-xs text-blue-700 hover:underline"
          >
            在明细中编辑 →
          </Link>
        ) : null}

        {relatedLogs.length > 0 ? (
          <div className="border-t border-slate-100 pt-3">
            <p className="mb-2 text-xs font-medium text-slate-700">操作记录</p>
            <ul className="space-y-2">
              {relatedLogs.map((log) => (
                <li key={log.id} className="rounded bg-slate-50 p-2 text-[11px] text-slate-600">
                  <div className="font-medium text-slate-800">
                    {log.operator} · {new Date(log.timestamp).toLocaleString("zh-CN")}
                  </div>
                  <div>{log.reason || log.action}</div>
                  <div className="text-slate-400">
                    影响 {log.affectedCount} 项
                  </div>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    </aside>
  );
}

function MarkInProgress({ onConfirm }: { onConfirm: (date: string) => void }) {
  return (
    <form
      className="flex gap-1"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        const date = String(fd.get("startDate") || "");
        if (date) onConfirm(date);
      }}
    >
      <input
        name="startDate"
        type="date"
        required
        className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
      />
      <button type="submit" className="rounded bg-green-700 px-2 py-1 text-xs text-white">
        标记处理中
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
        step="0.5"
        min="0.5"
        defaultValue={value}
        className="w-16 rounded border border-slate-300 px-2 py-1 text-xs"
      />
      <button type="submit" className="rounded border border-slate-300 px-2 py-1 text-xs">
        修改预计
      </button>
    </form>
  );
}
