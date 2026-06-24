"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PageHeader, TableWrap, RiskBadge, EmptyState, TH, TD, TH_NUM, TD_NUM, DisplayDate, DisplayNumber, DisplayText } from "@/components/ui";
import { useAuth } from "@/lib/auth/context";
import { RISK_LABELS } from "@/lib/types";

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
  const { canWrite } = useAuth();
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
        description="风险汇总已并入「订单时间流」页面底部。此处保留完整明细风险列表供查阅。"
        action={
          <Link href="/timeline" className="rounded border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50">
            返回订单时间流
          </Link>
        }
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
                <td className={TD}><DisplayText value={item.contractNo} /></td>
                <td className={`max-w-[180px] ${TD}`}>
                  <span className="line-clamp-2" title={item.projectName || undefined}>
                    <DisplayText value={item.projectName} />
                  </span>
                </td>
                <td className={TD}><DisplayText value={item.model} /></td>
                <td className={TD}><DisplayText value={item.owner} /></td>
                <td className={TD}>
                  <DisplayDate value={item.dueDate} />
                  <div className="text-xs text-slate-500">{item.dueBucket}</div>
                </td>
                <td className={TD_NUM}><DisplayNumber value={item.totalComplexity} /></td>
                <td className={TD_NUM}><DisplayNumber value={item.waitingDays} digits={0} /></td>
                <td className={`max-w-[180px] text-xs text-slate-600 ${TD}`}>
                  {[...item.riskTags, ...item.qualityIssues].map(formatRiskTag).join("、") || (
                    <DisplayText value="" />
                  )}
                </td>
                <td className={TD}>
                  {canWrite ? (
                    <Link href={`/projects/${item.id}/edit`} className="text-sm text-blue-700">
                      编辑
                    </Link>
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
