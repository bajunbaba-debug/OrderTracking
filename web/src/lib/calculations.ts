import { APP_CONFIG, getStatsDate } from "./config";
import type { ComputedFields, RawProjectRow } from "./types";

export function toDateOnly(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), 12, 0, 0)
  );
}

export function daysBetween(from: Date, to: Date): number {
  const a = toDateOnly(from);
  const b = toDateOnly(to);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function parseModelQuantity(model: string): number | null {
  const match = model.match(/\*(\d+)\*/);
  if (!match) return null;
  const value = parseInt(match[1], 10);
  return value > 0 ? value : null;
}

export function isEmpty(value: string | null | undefined): boolean {
  return value == null || String(value).trim() === "";
}

export function computeQualityIssues(row: RawProjectRow): string[] {
  const issues: string[] = [];
  if (isEmpty(row.contractNo)) issues.push("合同号缺失");
  if (isEmpty(row.projectName)) issues.push("项目名称缺失");
  if (row.quantity == null || Number.isNaN(row.quantity)) issues.push("数量缺失");
  if (!row.publishDate) issues.push("发布日期缺失");
  if (!row.dueDate && !row.designCompleteDate) issues.push("交期缺失");
  if (isEmpty(row.owner)) issues.push("负责人缺失");
  if (row.estimatedComplexity == null || Number.isNaN(row.estimatedComplexity)) {
    issues.push("预计缺失");
  }
  return issues;
}

export function computeDueBucket(
  dueDate: Date | null,
  isComplete: boolean,
  statsDate = getStatsDate()
): string {
  if (isComplete) return "已完成";
  if (!dueDate) return "交期缺失";
  const diff = daysBetween(statsDate, dueDate);
  if (diff < 0) return "已超期";
  if (diff <= 7) return "7天内";
  if (diff <= 14) return "8-14天";
  return "15天以上";
}

function computeP1(row: RawProjectRow): {
  parsedModelQuantity: number | null;
  technicalComplexityP1: number | null;
} {
  const estimated = row.estimatedComplexity ?? 0;
  const parsed = parseModelQuantity(row.model);
  if (parsed != null) {
    return { parsedModelQuantity: parsed, technicalComplexityP1: estimated / parsed };
  }
  if (row.quantity != null && row.quantity > 0) {
    return { parsedModelQuantity: null, technicalComplexityP1: estimated / row.quantity };
  }
  return { parsedModelQuantity: null, technicalComplexityP1: null };
}

export function computeRisk(
  row: RawProjectRow,
  computed: {
    totalComplexity: number;
    dueBucket: string;
    waitingDays: number | null;
    qualityIssues: string[];
    technicalComplexityP1: number | null;
    typeBaselineP10: number | null;
    quantityComplexityP2: number | null;
  }
): { riskLevel: string; riskTags: string[] } {
  const isComplete = row.designCompleteDate != null;

  // 已完成项目不参与当前风险判断，P1/P2 等数值仍保留在 computeFields 中供复盘
  if (isComplete) {
    return { riskLevel: "green", riskTags: [] };
  }

  const tags: string[] = [];

  if (computed.dueBucket === "已超期") tags.push("已超期");
  if (computed.dueBucket === "7天内") tags.push("7天内到期");
  if (computed.dueBucket === "8-14天") tags.push("8-14天内到期");
  if (computed.dueBucket === "交期缺失") tags.push("交期缺失");
  if (
    computed.waitingDays != null &&
    computed.waitingDays > APP_CONFIG.waitingDaysThreshold
  ) {
    tags.push("等待超过21天");
  }

  if (computed.qualityIssues.length > 0) {
    tags.push("关键字段缺失");
  }

  const p20 = APP_CONFIG.comfortBaselineP20;
  const p2 = computed.quantityComplexityP2;
  if (
    computed.technicalComplexityP1 != null &&
    computed.typeBaselineP10 != null &&
    computed.typeBaselineP10 > 0
  ) {
    const rate =
      (computed.technicalComplexityP1 - computed.typeBaselineP10) /
      computed.typeBaselineP10;
    if (rate > APP_CONFIG.p1DeviationThreshold) tags.push("P1偏高");
  }
  if (p2 != null && p20 > 0) {
    const rate = (p2 - p20) / p20;
    if (rate > APP_CONFIG.p2DeviationThreshold) tags.push("P2偏高");
  }

  let riskLevel = "green";

  if (computed.dueBucket === "已超期") riskLevel = "red";
  else if (
    computed.dueBucket === "7天内" &&
    computed.totalComplexity >= APP_CONFIG.highComplexityThreshold
  ) {
    riskLevel = "red";
  } else if (computed.dueBucket === "7天内") riskLevel = "orange";
  else if (computed.dueBucket === "8-14天") riskLevel = "yellow";
  else if (
    computed.waitingDays != null &&
    computed.waitingDays > APP_CONFIG.waitingDaysThreshold
  ) {
    riskLevel = "yellow";
  }

  const hasAlgorithm = tags.includes("P1偏高") || tags.includes("P2偏高");
  const hasDataAnomaly = computed.qualityIssues.length > 0;

  if (hasAlgorithm && riskLevel === "green") riskLevel = "algorithm";
  if (hasDataAnomaly && ["green", "algorithm"].includes(riskLevel)) {
    riskLevel = "data_anomaly";
  }

  const priority = ["red", "orange", "yellow", "algorithm", "data_anomaly", "green"];
  if (hasAlgorithm) {
    const algoIdx = priority.indexOf("algorithm");
    const curIdx = priority.indexOf(riskLevel);
    if (algoIdx < curIdx) riskLevel = "algorithm";
  }

  return { riskLevel, riskTags: tags };
}

export function computeFields(
  row: RawProjectRow,
  typeBaselineP10: number | null,
  statsDate = getStatsDate()
): ComputedFields {
  const isComplete = row.designCompleteDate != null;
  const designStatus = isComplete ? "complete" : "incomplete";
  const totalComplexity = row.estimatedComplexity ?? 0;
  const dueBucket = computeDueBucket(row.dueDate, isComplete, statsDate);
  const waitingDays = row.publishDate ? daysBetween(row.publishDate, statsDate) : null;
  const designCycleDays =
    row.publishDate && row.designCompleteDate
      ? daysBetween(row.publishDate, row.designCompleteDate)
      : null;

  const { parsedModelQuantity, technicalComplexityP1 } = computeP1(row);
  const quantityComplexityP2 = row.estimatedComplexity;
  const comfortBaselineP20 = APP_CONFIG.comfortBaselineP20;
  const qualityIssues = computeQualityIssues(row);

  const p1DeviationRate =
    technicalComplexityP1 != null && typeBaselineP10 != null && typeBaselineP10 > 0
      ? (technicalComplexityP1 - typeBaselineP10) / typeBaselineP10
      : null;
  const p2DeviationRate =
    quantityComplexityP2 != null && comfortBaselineP20 > 0
      ? (quantityComplexityP2 - comfortBaselineP20) / comfortBaselineP20
      : null;

  const { riskLevel, riskTags } = computeRisk(row, {
    totalComplexity,
    dueBucket,
    waitingDays,
    qualityIssues,
    technicalComplexityP1,
    typeBaselineP10,
    quantityComplexityP2,
  });

  return {
    designStatus,
    totalComplexity,
    dueBucket,
    waitingDays,
    designCycleDays,
    parsedModelQuantity,
    technicalComplexityP1,
    typeBaselineP10,
    quantityComplexityP2,
    comfortBaselineP20,
    p1DeviationRate,
    p2DeviationRate,
    riskLevel,
    riskTags,
    qualityIssues,
  };
}

export function computeTypeBaselines(rows: RawProjectRow[]): Map<string, number> {
  const groups = new Map<string, number[]>();
  for (const row of rows) {
    if (!row.type) continue;
    const { technicalComplexityP1 } = computeP1(row);
    if (technicalComplexityP1 == null) continue;
    const list = groups.get(row.type) ?? [];
    list.push(technicalComplexityP1);
    groups.set(row.type, list);
  }
  const baselines = new Map<string, number>();
  for (const [type, values] of groups) {
    const avg = values.reduce((s, v) => s + v, 0) / values.length;
    baselines.set(type, avg);
  }
  return baselines;
}

export function enrichRow(
  row: RawProjectRow,
  typeBaselines: Map<string, number>,
  statsDate = getStatsDate()
): RawProjectRow & ComputedFields {
  const p10 = row.type ? typeBaselines.get(row.type) ?? null : null;
  return { ...row, ...computeFields(row, p10, statsDate) };
}

export function enrichAllRows(rows: RawProjectRow[], statsDate = getStatsDate()) {
  const baselines = computeTypeBaselines(rows);
  return rows.map((row) => enrichRow(row, baselines, statsDate));
}
