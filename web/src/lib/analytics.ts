import { prisma } from "./prisma";
import { computeQualityIssues } from "./calculations";
import { dbRecordToRawRow } from "./project-input";
import { parseJsonArray } from "./project-service";
import { normalizeOwnerKey } from "./format";

type WorkloadItem = {
  estimatedComplexity: number | null;
  totalComplexity: number | null;
};

/** 负载统计以预计(工作日)为准，与明细列表求和一致 */
function itemWorkload(item: WorkloadItem): number {
  return item.estimatedComplexity ?? item.totalComplexity ?? 0;
}

export async function getAllProjectsSerialized() {
  const items = await prisma.projectItem.findMany({ orderBy: { updatedAt: "desc" } });
  return items.map((item) => {
    const qualityIssues = computeQualityIssues(dbRecordToRawRow(item));
    return {
      ...item,
      riskTags: parseJsonArray(item.riskTags),
      qualityIssues,
    };
  });
}

export async function getDashboardStats() {
  const items = await getAllProjectsSerialized();
  const incomplete = items.filter((i) => i.designStatus === "incomplete");
  const complete = items.filter((i) => i.designStatus === "complete");
  const qualityIssueCount = items.filter((i) => i.qualityIssues.length > 0).length;

  const sum = (list: typeof items) => list.reduce((s, i) => s + itemWorkload(i), 0);

  const ownerMap = new Map<string, { count: number; complexity: number }>();
  for (const item of incomplete) {
    const owner = normalizeOwnerKey(item.owner);
    const cur = ownerMap.get(owner) ?? { count: 0, complexity: 0 };
    cur.count += 1;
    cur.complexity += itemWorkload(item);
    ownerMap.set(owner, cur);
  }

  const completedOwnerMap = new Map<string, { count: number; complexity: number }>();
  for (const item of complete) {
    const owner = normalizeOwnerKey(item.owner);
    const cur = completedOwnerMap.get(owner) ?? { count: 0, complexity: 0 };
    cur.count += 1;
    cur.complexity += itemWorkload(item);
    completedOwnerMap.set(owner, cur);
  }

  const typeMap = new Map<string, { count: number; complexity: number }>();
  for (const item of incomplete) {
    const type = item.type || "未分类";
    const cur = typeMap.get(type) ?? { count: 0, complexity: 0 };
    cur.count += 1;
    cur.complexity += itemWorkload(item);
    typeMap.set(type, cur);
  }

  const chartOwners = [...ownerMap.entries()]
    .map(([owner, v]) => ({ owner, count: v.count, complexity: v.complexity }))
    .sort((a, b) => b.count - a.count || b.complexity - a.complexity)
    .slice(0, 8)
    .map((row) => row.owner);
  const chartOwnerSet = new Set(chartOwners);
  const chartTypeMap = new Map<string, Record<string, string | number>>();
  for (const item of incomplete) {
    const owner = normalizeOwnerKey(item.owner);
    if (!chartOwnerSet.has(owner)) continue;
    const type = item.type || "未分类";
    const cur = chartTypeMap.get(type) ?? { type };
    cur[owner] = Number(cur[owner] ?? 0) + 1;
    chartTypeMap.set(type, cur);
  }
  const memberTypeChartRows = [...chartTypeMap.values()]
    .map((row) => {
      for (const owner of chartOwners) row[owner] = Number(row[owner] ?? 0);
      return row;
    })
    .sort((a, b) => {
      const aTotal = chartOwners.reduce((sum, owner) => sum + Number(a[owner] ?? 0), 0);
      const bTotal = chartOwners.reduce((sum, owner) => sum + Number(b[owner] ?? 0), 0);
      return bTotal - aTotal;
    });

  return {
    totalCount: items.length,
    incompleteCount: incomplete.length,
    completeCount: items.length - incomplete.length,
    incompleteComplexity: sum(incomplete),
    dueIn7Count: incomplete.filter((i) => i.dueBucket === "7天内").length,
    dueIn7Complexity: sum(incomplete.filter((i) => i.dueBucket === "7天内")),
    dueIn814Count: incomplete.filter((i) => i.dueBucket === "8-14天").length,
    dueIn814Complexity: sum(incomplete.filter((i) => i.dueBucket === "8-14天")),
    missingDueCount: incomplete.filter((i) => i.dueBucket === "交期缺失").length,
    missingDueComplexity: sum(incomplete.filter((i) => i.dueBucket === "交期缺失")),
    qualityIssueCount,
    ownerRanking: [...ownerMap.entries()]
      .map(([owner, v]) => ({ owner, ...v }))
      .sort((a, b) => b.complexity - a.complexity),
    completedOwnerRanking: [...completedOwnerMap.entries()]
      .map(([owner, v]) => ({ owner, ...v }))
      .sort((a, b) => b.complexity - a.complexity),
    typeRanking: [...typeMap.entries()]
      .map(([type, v]) => ({ type, ...v }))
      .sort((a, b) => b.complexity - a.complexity),
    memberTypeChart: {
      owners: chartOwners,
      rows: memberTypeChartRows,
    },
  };
}

export async function getMemberStats(mode: "incomplete" | "all" = "incomplete") {
  const items = await getAllProjectsSerialized();
  const scoped = mode === "all" ? items : items.filter((i) => i.designStatus === "incomplete");
  const owners = new Map<
    string,
    {
      owner: string;
      count: number;
      complexity: number;
      incompleteCount: number;
      completeCount: number;
      overdue: number;
      due7: number;
      due814: number;
      due15plus: number;
      missingDue: number;
      typeDetails: Map<
        string,
        {
          type: string;
          count: number;
          complexity: number;
          incompleteCount: number;
          completeCount: number;
          p1Values: number[];
          p10Values: number[];
          p110Values: number[];
          p220Values: number[];
        }
      >;
    }
  >();

  const avg = (values: number[]) =>
    values.length > 0 ? values.reduce((s, n) => s + n, 0) / values.length : null;

  for (const item of scoped) {
    const owner = normalizeOwnerKey(item.owner);
    const cur = owners.get(owner) ?? {
      owner,
      count: 0,
      complexity: 0,
      incompleteCount: 0,
      completeCount: 0,
      overdue: 0,
      due7: 0,
      due814: 0,
      due15plus: 0,
      missingDue: 0,
      typeDetails: new Map(),
    };
    cur.count += 1;
    cur.complexity += itemWorkload(item);
    if (item.designStatus === "incomplete") {
      cur.incompleteCount += 1;
      const workload = itemWorkload(item);
      if (item.dueBucket === "已超期") cur.overdue += workload;
      else if (item.dueBucket === "7天内") cur.due7 += workload;
      else if (item.dueBucket === "8-14天") cur.due814 += workload;
      else if (item.dueBucket === "15天以上") cur.due15plus += workload;
      else if (item.dueBucket === "交期缺失") cur.missingDue += workload;
    } else {
      cur.completeCount += 1;
    }

    const type = item.type || "未分类";
    const typeCur = cur.typeDetails.get(type) ?? {
      type,
      count: 0,
      complexity: 0,
      incompleteCount: 0,
      completeCount: 0,
      p1Values: [],
      p10Values: [],
      p110Values: [],
      p220Values: [],
    };
    typeCur.count += 1;
    typeCur.complexity += itemWorkload(item);
    if (item.designStatus === "incomplete") typeCur.incompleteCount += 1;
    else typeCur.completeCount += 1;
    if (item.technicalComplexityP1 != null) typeCur.p1Values.push(item.technicalComplexityP1);
    if (item.typeBaselineP10 != null) typeCur.p10Values.push(item.typeBaselineP10);
    if (item.p1DeviationRate != null) typeCur.p110Values.push(item.p1DeviationRate);
    if (item.p2DeviationRate != null) typeCur.p220Values.push(item.p2DeviationRate);
    cur.typeDetails.set(type, typeCur);

    owners.set(owner, cur);
  }

  return [...owners.values()]
    .map((owner) => ({
      ...owner,
      typeRows: [...owner.typeDetails.values()]
        .map((type) => ({
          type: type.type,
          count: type.count,
          complexity: type.complexity,
          incompleteCount: type.incompleteCount,
          completeCount: type.completeCount,
          avgP1: avg(type.p1Values),
          p10: avg(type.p10Values),
          p110: avg(type.p110Values),
          p220: avg(type.p220Values),
        }))
        .sort((a, b) => b.complexity - a.complexity),
    }))
    .sort((a, b) => b.complexity - a.complexity);
}

export async function getRiskItems(riskLevel?: string) {
  const items = await getAllProjectsSerialized();
  let risks = items.filter(
    (i) =>
      i.designStatus === "incomplete" &&
      i.riskLevel !== "green" &&
      (i.riskTags.length > 0 || i.qualityIssues.length > 0)
  );
  if (riskLevel) {
    risks = risks.filter((i) => i.riskLevel === riskLevel);
  }
  return risks.sort((a, b) => {
    const order = ["red", "orange", "yellow", "algorithm", "data_anomaly"];
    return order.indexOf(a.riskLevel) - order.indexOf(b.riskLevel);
  });
}

export async function getContractStats() {
  const items = await getAllProjectsSerialized();
  const incomplete = items.filter((i) => i.designStatus === "incomplete");
  const map = new Map<
    string,
    {
      contractNo: string;
      projectName: string;
      incompleteCount: number;
      totalComplexity: number;
      earliestDue: Date | null;
      owners: Set<string>;
      types: Set<string>;
      ownerItems: Map<
        string,
        {
          id: string;
          projectName: string;
          model: string;
          totalComplexity: number;
          dueDate: Date | null;
          designStatus: string;
        }[]
      >;
    }
  >();

  for (const item of incomplete) {
    const key = item.contractNo || "(无合同号)";
    const cur = map.get(key) ?? {
      contractNo: key,
      projectName: item.projectName,
      incompleteCount: 0,
      totalComplexity: 0,
      earliestDue: null,
      owners: new Set<string>(),
      types: new Set<string>(),
      ownerItems: new Map(),
    };
    if (!cur.projectName && item.projectName) cur.projectName = item.projectName;
    cur.incompleteCount += 1;
    cur.totalComplexity += itemWorkload(item);
    if (item.dueDate) {
      if (!cur.earliestDue || item.dueDate < cur.earliestDue) cur.earliestDue = item.dueDate;
    }
    const owner = normalizeOwnerKey(item.owner);
    cur.owners.add(owner);
    if (item.type) cur.types.add(item.type);
    const list = cur.ownerItems.get(owner) ?? [];
    list.push({
      id: item.id,
      projectName: item.projectName,
      model: item.model,
      totalComplexity: itemWorkload(item),
      dueDate: item.dueDate,
      designStatus: item.designStatus,
    });
    cur.ownerItems.set(owner, list);
    map.set(key, cur);
  }

  return [...map.values()]
    .map((v) => ({
      contractNo: v.contractNo,
      projectName: v.projectName,
      incompleteCount: v.incompleteCount,
      totalComplexity: v.totalComplexity,
      earliestDue: v.earliestDue,
      ownerCount: v.owners.size,
      typeCount: v.types.size,
      ownerDetails: [...v.ownerItems.entries()].map(([owner, ownerItems]) => ({
        owner,
        items: ownerItems,
      })),
    }))
    .sort((a, b) => b.totalComplexity - a.totalComplexity);
}

export async function getTypeStats() {
  const items = await getAllProjectsSerialized();
  const map = new Map<
    string,
    {
      type: string;
      typeDetails: Set<string>;
      incompleteCount: number;
      incompleteComplexity: number;
      completeComplexity: number;
      p1Values: number[];
      p110Values: number[];
      p220Values: number[];
    }
  >();

  for (const item of items) {
    const key = item.type || "未分类";
    const cur = map.get(key) ?? {
      type: key,
      typeDetails: new Set<string>(),
      incompleteCount: 0,
      incompleteComplexity: 0,
      completeComplexity: 0,
      p1Values: [],
      p110Values: [],
      p220Values: [],
    };
    if (item.typeDetail) cur.typeDetails.add(item.typeDetail);
    if (item.designStatus === "incomplete") {
      cur.incompleteCount += 1;
      cur.incompleteComplexity += itemWorkload(item);
    } else {
      cur.completeComplexity += itemWorkload(item);
    }
    if (item.technicalComplexityP1 != null) cur.p1Values.push(item.technicalComplexityP1);
    if (item.p1DeviationRate != null) cur.p110Values.push(item.p1DeviationRate);
    if (item.p2DeviationRate != null) cur.p220Values.push(item.p2DeviationRate);
    map.set(key, cur);
  }

  const avg = (values: number[]) =>
    values.length > 0 ? values.reduce((s, n) => s + n, 0) / values.length : null;

  return [...map.values()]
    .map((v) => {
      const avgP1 = avg(v.p1Values);
      const p10 = avgP1;
      const p110 = avgP1 != null && p10 != null && p10 > 0 ? (avgP1 - p10) / p10 : null;

      return {
        type: v.type,
        typeDetail: [...v.typeDetails].join(" / "),
        incompleteCount: v.incompleteCount,
        incompleteComplexity: v.incompleteComplexity,
        completeComplexity: v.completeComplexity,
        avgP1,
        p10,
        p110,
        p220: avg(v.p220Values),
      };
    })
    .sort((a, b) => b.incompleteComplexity - a.incompleteComplexity);
}

export async function getQualityItems() {
  const items = await getAllProjectsSerialized();
  return items
    .filter((i) => i.qualityIssues.length > 0)
    .sort((a, b) => b.qualityIssues.length - a.qualityIssues.length);
}

export async function getDictionaries() {
  const items = await prisma.dictionary.findMany({
    where: { enabled: true },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });
  const grouped: Record<string, string[]> = {};
  const typeDetailByType: Record<string, string[]> = {};

  for (const item of items) {
    if (item.category === "typeDetail" && item.parentValue) {
      typeDetailByType[item.parentValue] = typeDetailByType[item.parentValue] ?? [];
      if (!typeDetailByType[item.parentValue].includes(item.value)) {
        typeDetailByType[item.parentValue].push(item.value);
      }
    } else {
      grouped[item.category] = grouped[item.category] ?? [];
      if (!grouped[item.category].includes(item.value)) {
        grouped[item.category].push(item.value);
      }
    }
  }

  return { ...grouped, typeDetailByType };
}
