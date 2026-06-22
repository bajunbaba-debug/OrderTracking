"use client";

import { useState } from "react";
import { DashboardMemberTypeChart } from "@/components/DashboardMemberTypeChart";
import { TableWrap, TD, TD_NUM, TH, TH_NUM } from "@/components/ui";
import { formatNumber } from "@/lib/format";

interface RankingRow {
  count: number;
  complexity: number;
}

interface OwnerRankingRow extends RankingRow {
  owner: string;
}

interface TypeRankingRow extends RankingRow {
  type: string;
}

interface DashboardWorkloadPanelProps {
  chart: {
    owners: string[];
    rows: Record<string, string | number>[];
  };
  ownerRanking: OwnerRankingRow[];
  completedOwnerRanking: OwnerRankingRow[];
  typeRanking: TypeRankingRow[];
}

function RankingTable({
  title,
  nameHeader,
  countHeader,
  complexityHeader,
  rows,
  getName,
}: {
  title: string;
  nameHeader: string;
  countHeader: string;
  complexityHeader: string;
  rows: Array<OwnerRankingRow | TypeRankingRow>;
  getName: (row: OwnerRankingRow | TypeRankingRow) => string;
}) {
  return (
    <section className="min-w-0">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      <TableWrap>
        <thead>
          <tr>
            <th className={TH}>{nameHeader}</th>
            <th className={TH_NUM}>{countHeader}</th>
            <th className={TH_NUM}>{complexityHeader}</th>
          </tr>
        </thead>
        <tbody>
          {rows.slice(0, 8).map((row) => (
            <tr key={getName(row)}>
              <td className={TD}>{getName(row)}</td>
              <td className={TD_NUM}>{row.count}</td>
              <td className={TD_NUM}>{formatNumber(row.complexity)}</td>
            </tr>
          ))}
        </tbody>
      </TableWrap>
    </section>
  );
}

export function DashboardWorkloadPanel({
  chart,
  ownerRanking,
  completedOwnerRanking,
  typeRanking,
}: DashboardWorkloadPanelProps) {
  const [active, setActive] = useState<"chart" | "tables">("chart");

  return (
    <section className="mb-6">
      <div className="mb-3 inline-flex rounded-lg border border-slate-300 bg-white p-1 text-sm">
        <button
          type="button"
          onClick={() => setActive("chart")}
          className={`rounded-md px-3 py-1.5 ${
            active === "chart" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          处理中
        </button>
        <button
          type="button"
          onClick={() => setActive("tables")}
          className={`rounded-md px-3 py-1.5 ${
            active === "tables" ? "bg-slate-900 text-white" : "text-slate-700 hover:bg-slate-50"
          }`}
        >
          负载排行
        </button>
      </div>

      <div className="grid overflow-hidden">
        <div
          aria-hidden={active !== "chart"}
          className={`[grid-area:1/1] transition-transform duration-500 ease-in-out motion-reduce:transition-none ${
            active === "chart" ? "translate-y-0" : "-translate-y-full pointer-events-none"
          }`}
        >
          <DashboardMemberTypeChart owners={chart.owners} rows={chart.rows} />
        </div>

        <div
          aria-hidden={active !== "tables"}
          className={`[grid-area:1/1] transition-transform duration-500 ease-in-out motion-reduce:transition-none ${
            active === "tables" ? "translate-y-0" : "translate-y-full pointer-events-none"
          }`}
        >
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            <RankingTable
              title="成员负载排行（未完成）"
              nameHeader="负责人"
              countHeader="未完成条数"
              complexityHeader="未完成预计(工作日)"
              rows={ownerRanking}
              getName={(row) => ("owner" in row ? row.owner : "")}
            />
            <RankingTable
              title="成员负载排行（已完成）"
              nameHeader="负责人"
              countHeader="已完成条数"
              complexityHeader="已完成预计(工作日)"
              rows={completedOwnerRanking}
              getName={(row) => ("owner" in row ? row.owner : "")}
            />
            <RankingTable
              title="产品类型负载排行（未完成）"
              nameHeader="类型"
              countHeader="未完成条数"
              complexityHeader="未完成预计(工作日)"
              rows={typeRanking}
              getName={(row) => ("type" in row ? row.type : "")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
