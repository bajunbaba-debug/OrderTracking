"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { TableWrap } from "@/components/ui";
import { DESIGN_STATUS_LABELS } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/format";

export interface ContractOwnerDetail {
  owner: string;
  items: {
    id: string;
    projectName: string;
    model: string;
    totalComplexity: number;
    dueDate: Date | string | null;
    designStatus: string;
  }[];
}

function useIsClient() {
  return useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
}

export function ContractOwnerCount({
  count,
  owners,
}: {
  count: number;
  owners: ContractOwnerDetail[];
}) {
  const [open, setOpen] = useState(false);
  const isClient = useIsClient();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (count <= 0) return <span className="tabular-nums">0</span>;

  const dialog = (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="contract-owners-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/70 backdrop-blur-[2px]"
        aria-label="关闭负责人明细"
        onClick={() => setOpen(false)}
      />
      <div className="relative z-10 flex max-h-[min(85vh,720px)] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl">
        <div className="shrink-0 border-b border-slate-200 bg-slate-50 px-5 py-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 id="contract-owners-title" className="text-base font-semibold text-slate-900">
                负责人明细
              </h3>
              <p className="mt-1 text-sm text-slate-500">
                各负责人负责的项目子项：项目名称、型号、预计(工作日)、交期、设计状态
              </p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm hover:bg-slate-100"
            >
              关闭
            </button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          <div className="space-y-6">
            {owners.map((group) => (
              <section key={group.owner}>
                <h4 className="mb-2 text-sm font-semibold text-slate-800">
                  {group.owner}
                  <span className="ml-2 font-normal text-slate-500">
                    ({group.items.length} 个子项)
                  </span>
                </h4>
                <TableWrap>
                  <thead>
                    <tr>
                      <th className="px-3 py-2">项目名称</th>
                      <th className="px-3 py-2">型号</th>
                      <th className="px-3 py-2 text-right">预计(工作日)</th>
                      <th className="px-3 py-2">交期</th>
                      <th className="px-3 py-2">设计状态</th>
                    </tr>
                  </thead>
                  <tbody>
                    {group.items.map((item) => (
                      <tr key={item.id}>
                        <td className="max-w-[200px] px-3 py-2">{item.projectName || "-"}</td>
                        <td className="px-3 py-2">{item.model}</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatNumber(item.totalComplexity)}
                        </td>
                        <td className="px-3 py-2">{formatDate(item.dueDate)}</td>
                        <td className="px-3 py-2">
                          {DESIGN_STATUS_LABELS[item.designStatus] ?? item.designStatus}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </TableWrap>
              </section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="tabular-nums text-blue-700 hover:underline"
        title="点击查看各负责人及负责子项"
      >
        {count}
      </button>
      {open && isClient ? createPortal(dialog, document.body) : null}
    </>
  );
}
