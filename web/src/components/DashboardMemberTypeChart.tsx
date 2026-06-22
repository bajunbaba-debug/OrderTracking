"use client";

import { useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const COLORS = [
  "#2563eb",
  "#dc2626",
  "#ca8a04",
  "#16a34a",
  "#0d9488",
  "#be123c",
  "#7c3aed",
  "#475569",
];

interface DashboardMemberTypeChartProps {
  owners: string[];
  rows: Record<string, string | number>[];
}

export function DashboardMemberTypeChart({ owners, rows }: DashboardMemberTypeChartProps) {
  const [showMatrix, setShowMatrix] = useState(false);

  if (owners.length === 0 || rows.length === 0) {
    return (
      <section className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-700">处理中</h3>
        <p className="mt-2 text-sm text-slate-500">暂无未完成项目数据。</p>
      </section>
    );
  }

  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-700">处理中</h3>
          <span className="text-xs text-slate-500">未完成项目数量，按类型与负责人拆分</span>
        </div>
        <button
          type="button"
          aria-label={showMatrix ? "隐藏数据表格" : "显示数据表格"}
          title={showMatrix ? "隐藏数据表格" : "显示数据表格"}
          onClick={() => setShowMatrix((value) => !value)}
          className={`inline-flex h-8 w-8 items-center justify-center rounded border text-sm ${
            showMatrix
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          ▦
        </button>
      </div>

      <div className="h-[430px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={rows} margin={{ top: 28, right: 18, left: 4, bottom: 8 }}>
            <CartesianGrid stroke="#e2e8f0" vertical={false} />
            <XAxis dataKey="type" tick={{ fontSize: 12 }} interval={0} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip />
            <Legend verticalAlign="bottom" height={36} />
            {owners.map((owner, index) => (
              <Bar key={owner} dataKey={owner} fill={COLORS[index % COLORS.length]} maxBarSize={18}>
                <LabelList dataKey={owner} position="top" className="fill-slate-700 text-xs" />
              </Bar>
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>

      {showMatrix ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full table-fixed text-xs">
            <thead>
              <tr>
                <th className="w-32 border border-slate-200 bg-slate-50 px-2 py-1 text-left">负责人</th>
                {rows.map((row) => (
                  <th
                    key={String(row.type)}
                    className="w-24 border border-slate-200 bg-slate-50 px-2 py-1 text-right"
                  >
                    {row.type}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {owners.map((owner, index) => (
                <tr key={owner}>
                  <td className="border border-slate-200 px-2 py-1">
                    <span
                      className="mr-2 inline-block h-2.5 w-2.5"
                      style={{ backgroundColor: COLORS[index % COLORS.length] }}
                    />
                    {owner}
                  </td>
                  {rows.map((row) => (
                    <td
                      key={`${owner}-${String(row.type)}`}
                      className="border border-slate-200 px-2 py-1 text-right tabular-nums"
                    >
                      {Number(row[owner] ?? 0)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}
