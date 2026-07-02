"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, TableWrap, EmptyState, TH, TD, TH_NUM, TD_NUM, DisplayDate, DisplayNumber, DisplayText } from "@/components/ui";
import { useAuth } from "@/lib/auth/context";

interface DataMatchItem {
  id: string;
  uuid: string;
  type: string;
  contractNo: string;
  projectName: string;
  model: string;
  owner: string;
  dueDate: string | null;
  estimatedComplexity: number | null;
  lastImportBatchId: string;
}

interface DataMatchResponse {
  latest: { displayText: string } | null;
  count: number;
  items: DataMatchItem[];
}

async function readJsonResponse<T>(res: Response): Promise<T & { error?: string }> {
  const text = await res.text();
  if (!text.trim()) {
    return { error: `接口返回为空（HTTP ${res.status}）` } as T & { error?: string };
  }
  try {
    return JSON.parse(text) as T & { error?: string };
  } catch {
    return { error: text.slice(0, 200) || `接口返回格式异常（HTTP ${res.status}）` } as T & {
      error?: string;
    };
  }
}

export default function DataMatchPage() {
  const { canWrite } = useAuth();
  const [data, setData] = useState<DataMatchResponse | null>(null);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [deletingAll, setDeletingAll] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function load() {
    setError("");
    const res = await fetch("/api/data-match");
    const body = await readJsonResponse<DataMatchResponse>(res);
    if (!res.ok) throw new Error(body.error || "加载失败");
    setData(body);
  }

  useEffect(() => {
    void load().catch((e) => setError(e instanceof Error ? e.message : "加载失败"));
  }, []);

  async function deleteItems(options: { ids?: string[]; all?: boolean }) {
    const res = await fetch("/api/data-match", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(options),
    });
    const body = await readJsonResponse<{ deletedCount?: number }>(res);
    if (!res.ok) throw new Error(body.error || "删除失败");
    return body.deletedCount ?? 0;
  }

  async function deleteOne(item: DataMatchItem) {
    if (!canWrite || deletingId || deletingAll) return;
    const label = item.contractNo || item.projectName || item.model || item.id;
    if (!window.confirm(`确定删除「${label}」吗？此操作不可恢复。`)) return;
    setDeletingId(item.id);
    setError("");
    setMessage("");
    try {
      const deletedCount = await deleteItems({ ids: [item.id] });
      setMessage(`已删除 ${deletedCount} 条数据`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  }

  async function deleteAll() {
    if (!canWrite || deletingAll || deletingId || !data?.items.length) return;
    if (!window.confirm(`确定删除全部 ${data.items.length} 条未匹配数据吗？此操作不可恢复。`)) return;
    setDeletingAll(true);
    setError("");
    setMessage("");
    try {
      const deletedCount = await deleteItems({ all: true });
      setMessage(`已删除 ${deletedCount} 条数据`);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "删除失败");
    } finally {
      setDeletingAll(false);
    }
  }

  const items = data?.items ?? [];
  const deleting = deletingAll || deletingId != null;

  return (
    <>
      <PageHeader
        title="数据匹配"
        description={
          data?.latest
            ? `最新批次：${data.latest.displayText}。下方为本批次不存在、但网站中仍存在的数据。`
            : "暂无批量导入记录，无法判断匹配差异。"
        }
        action={
          <Link href="/projects" className="rounded border border-slate-300 px-4 py-2 text-sm">
            返回明细
          </Link>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void deleteAll()}
          disabled={!canWrite || items.length === 0 || deleting}
          className="rounded bg-red-700 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {deletingAll ? "删除中..." : "删除全部"}
        </button>
        <span className="text-sm text-slate-500">未匹配数据：{data?.count ?? 0} 条</span>
      </div>

      {message ? <div className="mb-4 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">{message}</div> : null}
      {error ? <div className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

      {!data ? (
        <EmptyState message="加载中..." />
      ) : items.length === 0 ? (
        <EmptyState message="暂无未匹配数据。" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={TH}>合同号</th>
              <th className={TH}>项目名称</th>
              <th className={TH}>型号</th>
              <th className={TH}>类型</th>
              <th className={TH}>负责人</th>
              <th className={TH}>交期</th>
              <th className={TH_NUM}>预计(工作日)</th>
              <th className={TH}>匹配状态</th>
              <th className={TH}>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className={TD}><DisplayText value={item.contractNo} /></td>
                <td className={`max-w-[220px] ${TD}`}>
                  <span className="line-clamp-2" title={item.projectName || undefined}>
                    <DisplayText value={item.projectName} />
                  </span>
                </td>
                <td className={TD}><DisplayText value={item.model} /></td>
                <td className={TD}><DisplayText value={item.type} /></td>
                <td className={TD}><DisplayText value={item.owner} /></td>
                <td className={TD}><DisplayDate value={item.dueDate} /></td>
                <td className={TD_NUM}><DisplayNumber value={item.estimatedComplexity} /></td>
                <td className={TD}>
                  <span className="rounded bg-amber-50 px-1.5 py-0.5 text-xs text-amber-800">
                    最新批次不存在
                  </span>
                </td>
                <td className={`whitespace-nowrap ${TD}`}>
                  {canWrite ? (
                    <button
                      type="button"
                      onClick={() => void deleteOne(item)}
                      disabled={deleting}
                      className="text-sm text-red-700 disabled:opacity-50"
                    >
                      {deletingId === item.id ? "删除中..." : "删除"}
                    </button>
                  ) : (
                    <span className="text-sm text-slate-400">只读</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
