"use client";

import { useMemo, useState } from "react";
import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Sector,
  Tooltip,
  useChartHeight,
  useChartWidth,
  ZIndexLayer,
  DefaultZIndexes,
} from "recharts";
import { DashboardMemberTypeChart } from "@/components/DashboardMemberTypeChart";
import { DisplayText } from "@/components/ui";
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

const PIE_COLORS = [
  "#2563eb",
  "#dc2626",
  "#ca8a04",
  "#16a34a",
  "#0d9488",
  "#be123c",
  "#7c3aed",
  "#475569",
];

/** 扇区内放不下百分比标签时的阈值 */
const INSIDE_LABEL_MIN_PERCENT = 8;
const HIGHLIGHT_BOOST = 10;
const PIE_MARGIN = { top: 8, right: 22, bottom: 8, left: 22 };
const PIE_INNER_RADIUS = 32;
const PIE_OUTER_RADIUS = 58;
const PIE_PADDING_ANGLE = 1;

type PieDatum = {
  name: string;
  value: number;
  color: string;
  percent: number;
};

function buildPieData(
  rows: Array<OwnerRankingRow | TypeRankingRow>,
  getName: (row: OwnerRankingRow | TypeRankingRow) => string,
): PieDatum[] {
  const sliced = rows.slice(0, 8);
  const total = sliced.reduce((sum, row) => sum + row.complexity, 0);

  return sliced.map((row, index) => ({
    name: getName(row),
    value: row.complexity,
    color: PIE_COLORS[index % PIE_COLORS.length],
    percent: total > 0 ? (row.complexity / total) * 100 : 0,
  }));
}

/** 按工作日占比分配整数百分比，保证各项之和为 100 */
function computeIntegerPercents(data: PieDatum[]): number[] {
  const total = data.reduce((sum, item) => sum + item.value, 0);
  if (total <= 0) return data.map(() => 0);

  const raw = data.map((item) => (item.value / total) * 100);
  const floors = raw.map((value) => Math.floor(value));
  const remainder = 100 - floors.reduce((sum, value) => sum + value, 0);
  const order = raw
    .map((value, index) => ({ index, fraction: value - floors[index]! }))
    .sort((a, b) => b.fraction - a.fraction);

  const result = [...floors];
  for (let i = 0; i < remainder; i++) {
    result[order[i]!.index]!++;
  }
  return result;
}

function findMaxIndex(data: PieDatum[]) {
  if (data.length === 0) return 0;
  return data.reduce(
    (maxIndex, item, index, arr) => (item.value > arr[maxIndex].value ? index : maxIndex),
    0,
  );
}

function polarPoint(cx: number, cy: number, radius: number, angleDeg: number) {
  const rad = (Math.PI / 180) * angleDeg;
  return {
    x: cx + Math.cos(-rad) * radius,
    y: cy + Math.sin(-rad) * radius,
  };
}

/** 与 Recharts Pie 一致的中角计算 */
function computeSliceMidAngles(data: PieDatum[]): number[] {
  const sum = data.reduce((total, item) => total + item.value, 0);
  if (sum <= 0) return data.map(() => 0);

  const paddingAngle = data.length <= 1 ? 0 : PIE_PADDING_ANGLE;
  const nonZeroCount = data.filter((item) => item.value !== 0).length;
  const totalPaddingAngle = (nonZeroCount - 1) * paddingAngle;
  const realTotalAngle = 360 - totalPaddingAngle;

  const midAngles: number[] = [];
  let prevEndAngle = 0;

  data.forEach((item, index) => {
    const tempStartAngle =
      index === 0 ? 0 : prevEndAngle + (item.value !== 0 ? paddingAngle : 0);
    const sliceAngle = (item.value / sum) * realTotalAngle;
    const tempEndAngle = tempStartAngle + sliceAngle;
    midAngles.push((tempStartAngle + tempEndAngle) / 2);
    prevEndAngle = tempEndAngle;
  });

  return midAngles;
}

function getPieCenter(width: number, height: number) {
  return {
    cx: PIE_MARGIN.left + (width - PIE_MARGIN.left - PIE_MARGIN.right) / 2,
    cy: PIE_MARGIN.top + (height - PIE_MARGIN.top - PIE_MARGIN.bottom) / 2,
  };
}

function PiePercentLabelLayer({
  data,
  displayPercents,
  highlightedIndex,
}: {
  data: PieDatum[];
  displayPercents: number[];
  highlightedIndex: number;
}) {
  const width = useChartWidth() ?? 0;
  const height = useChartHeight() ?? 0;
  const midAngles = useMemo(() => computeSliceMidAngles(data), [data]);

  if (width <= 0 || height <= 0) return null;

  const { cx, cy } = getPieCenter(width, height);

  return (
    <ZIndexLayer zIndex={DefaultZIndexes.label}>
      <g pointerEvents="none">
      {data.map((item, index) => {
        const percentValue = displayPercents[index] ?? 0;
        const isHighlighted = index === highlightedIndex;
        const boost = isHighlighted ? HIGHLIGHT_BOOST : 0;
        const outerRadius = PIE_OUTER_RADIUS + boost;
        const midAngle = midAngles[index] ?? 0;
        const inside = percentValue >= INSIDE_LABEL_MIN_PERCENT && !isHighlighted;
        const labelRadius = inside
          ? PIE_INNER_RADIUS + (outerRadius - PIE_INNER_RADIUS) * 0.5
          : outerRadius + 22;
        const labelPoint = polarPoint(cx, cy, labelRadius, midAngle);
        const label = `${percentValue}%`;

        if (isHighlighted && !inside) {
          const fontSize = 12;
          const boxWidth = Math.max(34, label.length * 8 + 14);
          const boxHeight = 22;
          const centerX = labelPoint.x;
          const centerY = labelPoint.y;
          const boxX = centerX - boxWidth / 2;
          const boxY = centerY - boxHeight / 2;
          const lineEndX = centerX + (centerX >= cx ? -boxWidth / 2 : boxWidth / 2);
          const start = polarPoint(cx, cy, outerRadius, midAngle);
          const elbow = polarPoint(cx, cy, outerRadius + 10, midAngle);

          return (
            <g key={item.name}>
              <path
                d={`M${start.x},${start.y}L${elbow.x},${elbow.y}L${lineEndX},${centerY}`}
                stroke="#64748b"
                strokeWidth={1.5}
                fill="none"
              />
              <rect
                x={boxX}
                y={boxY}
                width={boxWidth}
                height={boxHeight}
                rx={4}
                fill="rgba(255,255,255,0.95)"
                stroke="#0f172a"
                strokeWidth={1}
              />
              <text
                x={centerX}
                y={centerY}
                fill="#0f172a"
                textAnchor="middle"
                dominantBaseline="central"
                fontSize={fontSize}
                fontWeight={700}
              >
                {label}
              </text>
            </g>
          );
        }

        const textAnchor = inside ? "middle" : labelPoint.x >= cx ? "start" : "end";
        const textX = inside ? labelPoint.x : labelPoint.x + (labelPoint.x >= cx ? 4 : -4);

        return (
          <g key={item.name}>
            {!inside ? (
              <path
                d={(() => {
                  const start = polarPoint(cx, cy, outerRadius, midAngle);
                  const elbow = polarPoint(cx, cy, outerRadius + 10, midAngle);
                  const endX = textX + (labelPoint.x >= cx ? -4 : 4);
                  return `M${start.x},${start.y}L${elbow.x},${elbow.y}L${endX},${labelPoint.y}`;
                })()}
                stroke="#94a3b8"
                strokeWidth={1}
                fill="none"
              />
            ) : null}
            <text
              x={textX}
              y={labelPoint.y}
              fill={inside ? "#ffffff" : "#0f172a"}
              stroke={inside ? "rgba(15,23,42,0.35)" : "none"}
              strokeWidth={inside ? 2 : 0}
              paintOrder="stroke fill"
              textAnchor={textAnchor}
              dominantBaseline="central"
              fontSize={11}
              fontWeight={700}
            >
              {label}
            </text>
          </g>
        );
      })}
      </g>
    </ZIndexLayer>
  );
}

function WorkloadPieChart({
  data,
  hoveredIndex,
}: {
  data: PieDatum[];
  hoveredIndex: number | null;
}) {
  const maxIndex = useMemo(() => findMaxIndex(data), [data]);
  const displayPercents = useMemo(() => computeIntegerPercents(data), [data]);
  const total = useMemo(() => data.reduce((sum, item) => sum + item.value, 0), [data]);

  const highlightedIndex = hoveredIndex ?? maxIndex;

  if (data.length === 0 || total <= 0) {
    return (
      <div className="flex h-[220px] items-center justify-center rounded-lg border border-slate-200 bg-white text-xs text-slate-500">
        暂无工作日数据
      </div>
    );
  }

  return (
    <div className="h-[220px] min-w-0 w-full rounded-lg border border-slate-200 bg-white p-1">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={PIE_MARGIN}>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={PIE_INNER_RADIUS}
            outerRadius={PIE_OUTER_RADIUS}
            paddingAngle={PIE_PADDING_ANGLE}
            isAnimationActive={false}
            label={false}
            labelLine={false}
            shape={(props) => {
              const isHighlighted = props.index === highlightedIndex;
              const dimOthers = hoveredIndex !== null && !isHighlighted;
              return (
                <Sector
                  {...props}
                  outerRadius={(props.outerRadius ?? PIE_OUTER_RADIUS) + (isHighlighted ? HIGHLIGHT_BOOST : 0)}
                  stroke={isHighlighted ? "#0f172a" : "#fff"}
                  strokeWidth={isHighlighted ? 3 : 1}
                  opacity={dimOthers ? 0.35 : 1}
                />
              );
            }}
          >
            {data.map((entry) => (
              <Cell key={entry.name} fill={entry.color} />
            ))}
          </Pie>
          <PiePercentLabelLayer
            data={data}
            displayPercents={displayPercents}
            highlightedIndex={highlightedIndex}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const datum = payload[0]?.payload as PieDatum | undefined;
              if (!datum) return null;

              return (
                <div className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs shadow-sm">
                  <div className="font-medium text-slate-900">{datum.name}</div>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

function RankingTable({
  title,
  nameHeader,
  countHeader,
  rows,
  getName,
}: {
  title: string;
  nameHeader: string;
  countHeader: string;
  rows: Array<OwnerRankingRow | TypeRankingRow>;
  getName: (row: OwnerRankingRow | TypeRankingRow) => string;
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const visibleRows = rows.slice(0, 8);
  const pieData = buildPieData(rows, getName);

  return (
    <section className="min-w-0">
      <h3 className="mb-3 text-sm font-semibold text-slate-700">{title}</h3>
      <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white">
          <table className="w-full table-fixed text-xs [&_td]:align-middle [&_th]:align-middle">
            <colgroup>
              <col className="w-[44%]" />
              <col className="w-[24%]" />
              <col className="w-[32%]" />
            </colgroup>
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-1.5 py-1 text-left align-middle font-medium text-slate-600">
                  {nameHeader}
                </th>
                <th className="px-1 py-1 text-center align-middle font-medium text-slate-600">
                  {countHeader}
                </th>
                <th className="px-1 py-1 text-center align-middle font-medium text-slate-600">
                  工作日
                </th>
              </tr>
            </thead>
            <tbody>
              {visibleRows.map((row, index) => {
                const isSelected = hoveredIndex === index;
                const accentColor = PIE_COLORS[index % PIE_COLORS.length];

                return (
                  <tr
                    key={getName(row)}
                    onMouseEnter={() => setHoveredIndex(index)}
                    onMouseLeave={() => setHoveredIndex(null)}
                    className={`transition-colors ${
                      isSelected
                        ? "bg-slate-100 font-semibold ring-2 ring-inset ring-slate-500"
                        : "hover:bg-slate-50"
                    }`}
                  >
                    <td
                      className={`border-l-[3px] px-1.5 py-1 align-middle break-words leading-snug text-slate-900 ${
                        isSelected ? "" : "border-l-transparent"
                      }`}
                      style={isSelected ? { borderLeftColor: accentColor } : undefined}
                    >
                      <DisplayText value={getName(row)} />
                    </td>
                    <td className="px-1 py-1 text-center align-middle tabular-nums">{row.count}</td>
                    <td className="px-1 py-1 text-center align-middle tabular-nums">
                      {formatNumber(row.complexity)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <WorkloadPieChart data={pieData} hoveredIndex={hoveredIndex} />
      </div>
    </section>
  );
}

export function DashboardWorkloadPanel({
  chart,
  ownerRanking,
  completedOwnerRanking,
  typeRanking,
}: DashboardWorkloadPanelProps) {
  const [active, setActive] = useState<"chart" | "tables">("tables");

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
              countHeader="条数"
              rows={ownerRanking}
              getName={(row) => ("owner" in row ? row.owner : "")}
            />
            <RankingTable
              title="成员负载排行（已完成）"
              nameHeader="负责人"
              countHeader="条数"
              rows={completedOwnerRanking}
              getName={(row) => ("owner" in row ? row.owner : "")}
            />
            <RankingTable
              title="产品类型负载排行（未完成）"
              nameHeader="类型"
              countHeader="条数"
              rows={typeRanking}
              getName={(row) => ("type" in row ? row.type : "")}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
