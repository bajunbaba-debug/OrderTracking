"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, TableWrap, RiskBadge, EmptyState, TH, TD, TH_NUM, TD_NUM } from "@/components/ui";
import { RISK_LABELS } from "@/lib/types";
import { formatDate, formatNumber } from "@/lib/format";

interface RiskItem {
  id: string;
  contractNo: string;
  projectName: string;
  model: string;
  owner: string;
  dueDate: string | null;
  dueBucket: string;
  totalComplexity: number;
  waitingDays: number | null;
  riskLevel: string;
  riskTags: string[];
  qualityIssues: string[];
}

function formatRiskTag(tag: string): string {
  if (tag === "P1偏高" || tag === "P2偏高") return "预计异常";
  return tag;
}

export default function RisksPage() {
  const [items, setItems] = useState<RiskItem[]>([]);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [riskLevel, setRiskLevel] = useState("");

  useEffect(() => {
    let cancelled = false;
    const q = riskLevel ? `?riskLevel=${riskLevel}` : "";
    fetch(`/api/risks${q}`)
      .then((r) => r.json())
      .then((data: RiskItem[]) => {
        if (!cancelled) {
          setItems(data);
          setLoadedKey(riskLevel);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [riskLevel]);

  const loading = loadedKey !== riskLevel;

  return (
    <>
      <PageHeader
        title="风险清单"
        description="展示未完成且命中风险规则的项目：超期、7天内、交期缺失、等待过久、字段异常、预计异常。"
      />

      <div className="mb-4">
        <select
          value={riskLevel}
          onChange={(e) => setRiskLevel(e.target.value)}
          className="rounded border border-slate-300 px-3 py-2 text-sm"
        >
          <option value="">全部风险等级</option>
          {Object.entries(RISK_LABELS).map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <EmptyState message="加载中..." />
      ) : items.length === 0 ? (
        <EmptyState message="暂无风险项目，或请先导入数据。" />
      ) : (
        <TableWrap>
          <thead>
            <tr>
              <th className={TH}>风险</th>
              <th className={TH}>合同号</th>
              <th className={TH}>项目</th>
              <th className={TH}>型号</th>
              <th className={TH}>负责人</th>
              <th className={TH}>交期</th>
              <th className={TH_NUM}>预计(工作日)</th>
              <th className={TH_NUM}>等待天数</th>
              <th className={TH}>标签</th>
              <th className={TH}>操作</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id}>
                <td className={TD}>
                  <RiskBadge level={item.riskLevel} />
                </td>
                <td className={TD}>{item.contractNo || "-"}</td>
                <td className={`max-w-[180px] ${TD}`}>
                  <span className="line-clamp-2" title={item.projectName || undefined}>
                    {item.projectName || "-"}
                  </span>
                </td>
                <td className={TD}>{item.model}</td>
                <td className={TD}>{item.owner || "N/A"}</td>
                <td className={TD}>
                  {formatDate(item.dueDate)}
                  <div className="text-xs text-slate-500">{item.dueBucket}</div>
                </td>
                <td className={TD_NUM}>{formatNumber(item.totalComplexity)}</td>
                <td className={TD_NUM}>{item.waitingDays ?? "-"}</td>
                <td className={`max-w-[180px] text-xs text-slate-600 ${TD}`}>
                  {[...item.riskTags, ...item.qualityIssues].map(formatRiskTag).join("、") || "-"}
                </td>
                <td className={TD}>
                  <Link href={`/projects/${item.id}/edit`} className="text-sm text-blue-700">
                    编辑
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </TableWrap>
      )}
    </>
  );
}
