"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";
import { GuestReadOnlyBanner } from "@/components/GuestReadOnlyBanner";
import { PageHeader, TableWrap, RiskBadge, EmptyState, TH, TD, TH_NUM, TD_NUM } from "@/components/ui";
import { useAuth } from "@/lib/auth/context";
import { DESIGN_STATUS_LABELS, DUE_BUCKET_COLORS } from "@/lib/types";
import { formatDate, formatNumber, todayDateInput } from "@/lib/format";

interface ProjectItem {
  id: string;
  type: string;
  contractNo: string;
  projectName: string;
  model: string;
  owner: string;
  designStatus: string;
  designCompleteDate: string | null;
  dueBucket: string;
  dueDate: string | null;
  totalComplexity: number;
  riskLevel: string;
}

export function parseUrlFilters(params: URLSearchParams) {
  const status = params.get("status");
  const due = params.get("dueBucket");
  const designStatusParam = params.get("designStatus");

  let designStatus = "incomplete";
  if (designStatusParam === "complete" || designStatusParam === "incomplete") {
    designStatus = designStatusParam;
  } else if (status === "finished" || status === "complete") {
    designStatus = "complete";
  } else if (status === "all") {
    designStatus = "";
  } else if (status === "unfinished") {
    designStatus = "incomplete";
  }

  let dueBucket = params.get("dueBucket") ?? "";
  if (due === "7d") dueBucket = "7天内";
  else if (due === "8_14d") dueBucket = "8-14天";

  return { designStatus, dueBucket };
}

function MarkCompleteModal({
  projectName,
  onConfirm,
  onCancel,
}: {
  projectName: string;
  onConfirm: (date: string) => void;
  onCancel: () => void;
}) {
  const [date, setDate] = useState(todayDateInput());

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mark-complete-title"
    >
      <div
        className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="mark-complete-title" className="text-base font-semibold text-slate-900">
          确认标记完成
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          项目「{projectName || "未命名"}」将标记为已完成，并记录设计完成日期。
        </p>
        <label className="mt-4 block text-sm">
          <span className="mb-1 block text-xs text-slate-500">设计完成日期</span>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
          />
        </label>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="rounded border border-slate-300 px-4 py-2 text-sm"
          >
            取消
          </button>
          <button
            type="button"
            onClick={() => onConfirm(date)}
            className="rounded bg-green-700 px-4 py-2 text-sm text-white"
          >
            确认完成
          </button>
        </div>
      </div>
    </div>
  );
}

function ProjectsPageInner() {
  const { canWrite, isGuest } = useAuth();
  const searchParams = useSearchParams();
  const urlFilters = useMemo(() => parseUrlFilters(searchParams), [searchParams]);

  const [items, setItems] = useState<ProjectItem[]>([]);
  const [loadedQuery, setLoadedQuery] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState("");
  const [qualityCount, setQualityCount] = useState(0);
  const [search, setSearch] = useState("");
  const [designStatus, setDesignStatus] = useState(urlFilters.designStatus);
  const [owner, setOwner] = useState("");
  const [type, setType] = useState("");
  const [dueBucket, setDueBucket] = useState(urlFilters.dueBucket);
  const [completeTarget, setCompleteTarget] = useState<ProjectItem | null>(null);

  const query = useMemo(() => {
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    if (designStatus) params.set("designStatus", designStatus);
    if (owner) params.set("owner", owner);
    if (type) params.set("type", type);
    if (dueBucket) params.set("dueBucket", dueBucket);
    return params.toString();
  }, [search, designStatus, owner, type, dueBucket]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/projects?${query}`)
      .then((r) => {
        if (!r.ok) {
          return r.json().then((body: { error?: string }) => {
            throw new Error(body.error || `加载失败（HTTP ${r.status}）`);
          });
        }
        return r.json();
      })
      .then((data: unknown) => {
        if (cancelled) return;
        if (!Array.isArray(data)) {
          throw new Error("接口返回格式异常");
        }
        setItems(data as ProjectItem[]);
        setFetchError("");
        setLoadedQuery(query);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setItems([]);
        setFetchError(e instanceof Error ? e.message : "加载失败，请稍后重试");
        setLoadedQuery(query);
      });
    return () => {
      cancelled = true;
    };
  }, [query]);

  useEffect(() => {
    fetch("/api/quality")
      .then((r) => {
        if (!r.ok) throw new Error("quality fetch failed");
        return r.json();
      })
      .then((data: unknown[]) => setQualityCount(Array.isArray(data) ? data.length : 0))
      .catch(() => setQualityCount(0));
  }, [query]);

  const loading = loadedQuery !== query;
  const owners = [...new Set(items.map((i) => i.owner).filter(Boolean))];
  const types = [...new Set(items.map((i) => i.type).filter(Boolean))];

  async function confirmMarkComplete(date: string) {
    if (!completeTarget || !canWrite) return;
    const res = await fetch(`/api/projects/${completeTarget.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ designCompleteDate: date }),
    });
    if (!res.ok) return;
    setCompleteTarget(null);
    setLoadedQuery(null);
  }

  const qualityButton = (
    <Link
      href="/quality?from=projects"
      className="relative rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
    >
      数据质量
      {qualityCount > 0 ? (
        <span className="absolute -right-2 -top-2 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-xs text-white">
          {qualityCount}
        </span>
      ) : null}
    </Link>
  );

  return (
    <>
      <PageHeader
        title="项目明细"
        description="支持筛选、搜索、新增与编辑。标记设计完成会自动重算风险与状态。"
        extra={qualityButton}
        action={
          canWrite ? (
            <div className="flex shrink-0 gap-2">
              <Link
                href="/import?from=projects"
                className="rounded border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
              >
                批量导入
              </Link>
              <Link href="/projects/new" className="rounded bg-slate-900 px-4 py-2 text-sm text-white">
                新增明细
              </Link>
            </div>
          ) : undefined
        }
      />

      {isGuest ? <GuestReadOnlyBanner /> : null}

      <div className="mb-4 grid grid-cols-1 gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-5">
        <input
          placeholder="搜索合同号 / 项目名 / 型号"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-2"
        />
        <select
          value={designStatus}
          onChange={(e) => setDesignStatus(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">全部设计状态</option>
          <option value="incomplete">未完成</option>
          <option value="complete">已完成</option>
        </select>
        <select
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">全部负责人</option>
          {owners.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </select>
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">全部类型</option>
          {types.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          value={dueBucket}
          onChange={(e) => setDueBucket(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm md:col-span-1"
        >
          <option value="">全部交期区间</option>
          <option value="已超期">已超期</option>
          <option value="7天内">7天内</option>
          <option value="8-14天">8-14天</option>
          <option value="15天以上">15天以上</option>
          <option value="交期缺失">交期缺失</option>
        </select>
      </div>

      {loading ? (
        <EmptyState message="加载中..." />
      ) : fetchError ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-6 text-center">
          <p className="text-sm text-red-700">{fetchError}</p>
          <button
            type="button"
            onClick={() => setLoadedQuery(null)}
            className="mt-3 rounded border border-red-300 px-4 py-2 text-sm text-red-800 hover:bg-red-100"
          >
            重试
          </button>
        </div>
      ) : items.length === 0 ? (
        <EmptyState message="暂无项目明细，请先导入 Excel 或新增明细。" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={TH}>类型</th>
              <th className={TH}>合同号</th>
              <th className={TH}>项目名称</th>
              <th className={TH}>型号</th>
              <th className={TH}>负责人</th>
              <th className={TH}>状态</th>
              <th className={TH}>交期</th>
              <th className={TH_NUM}>预计(工作日)</th>
              <th className={TH}>风险</th>
              <th className={TH}>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className={TD}>{item.type}</td>
                <td className={TD}>{item.contractNo || "-"}</td>
                <td className={`max-w-[220px] ${TD}`}>
                  <span className="line-clamp-2" title={item.projectName || undefined}>
                    {item.projectName || "-"}
                  </span>
                </td>
                <td className={TD}>{item.model}</td>
                <td className={TD}>{item.owner || "N/A"}</td>
                <td className={TD}>
                  <div>{DESIGN_STATUS_LABELS[item.designStatus] ?? item.designStatus}</div>
                  {item.designStatus === "complete" && item.designCompleteDate ? (
                    <div className="text-xs text-slate-500">
                      完成：{formatDate(item.designCompleteDate)}
                    </div>
                  ) : null}
                </td>
                <td className={TD}>
                  <div>{formatDate(item.dueDate)}</div>
                  <span
                    className={`mt-1 inline-flex rounded px-1.5 py-0.5 text-xs ${
                      DUE_BUCKET_COLORS[item.dueBucket] ?? ""
                    }`}
                  >
                    {item.dueBucket}
                  </span>
                </td>
                <td className={TD_NUM}>{formatNumber(item.totalComplexity)}</td>
                <td className={TD}>
                  <RiskBadge level={item.riskLevel} />
                </td>
                <td className={`whitespace-nowrap ${TD}`}>
                  {canWrite ? (
                    <>
                      <Link href={`/projects/${item.id}/edit`} className="text-sm text-blue-700">
                        编辑
                      </Link>
                      {item.designStatus === "incomplete" ? (
                        <>
                          {" · "}
                          <button
                            onClick={() => setCompleteTarget(item)}
                            className="text-sm text-green-700"
                          >
                            标记完成
                          </button>
                        </>
                      ) : null}
                    </>
                  ) : (
                    <span className="text-sm text-slate-400">只读</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}

      {completeTarget && canWrite ? (
        <MarkCompleteModal
          projectName={completeTarget.projectName}
          onConfirm={(date) => void confirmMarkComplete(date)}
          onCancel={() => setCompleteTarget(null)}
        />
      ) : null}
    </>
  );
}

function ProjectsPageKeyed() {
  const searchParams = useSearchParams();
  const remountKey = searchParams.toString();
  return <ProjectsPageInner key={remountKey} />;
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={<EmptyState message="加载中..." />}>
      <ProjectsPageKeyed />
    </Suspense>
  );
}
