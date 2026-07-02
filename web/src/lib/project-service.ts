import { prisma } from "./prisma";
import { enrichRow, computeTypeBaselines, isEmpty } from "./calculations";
import { getStatsDate } from "./config";
import { parseExcelBuffer, parseExcelFile, type DictionaryEntry } from "./excel";
import { dbRecordToRawRow } from "./project-input";
import type { RawProjectRow } from "./types";

function toDbPayload(row: RawProjectRow & ReturnType<typeof enrichRow>, lastImportBatchId?: string) {
  return {
    sourceRowNumber: row.sourceRowNumber,
    uuid: row.uuid,
    ...(lastImportBatchId ? { lastImportBatchId } : {}),
    type: row.type,
    typeDetail: row.typeDetail,
    contractNo: row.contractNo,
    productionInstructionNo: row.productionInstructionNo,
    projectName: row.projectName,
    model: row.model,
    quantity: row.quantity,
    publishDate: row.publishDate,
    assignDate: row.assignDate,
    designCompleteDate: row.designCompleteDate,
    dueDate: row.dueDate,
    owner: row.owner,
    estimatedComplexity: row.estimatedComplexity,
    solutionOwner: row.solutionOwner,
    sales: row.sales,
    commonRemark: row.commonRemark,
    extraRemark: row.extraRemark,
    designStatus: row.designStatus,
    totalComplexity: row.totalComplexity,
    dueBucket: row.dueBucket,
    waitingDays: row.waitingDays,
    designCycleDays: row.designCycleDays,
    parsedModelQuantity: row.parsedModelQuantity,
    technicalComplexityP1: row.technicalComplexityP1,
    typeBaselineP10: row.typeBaselineP10,
    quantityComplexityP2: row.quantityComplexityP2,
    comfortBaselineP20: row.comfortBaselineP20,
    p1DeviationRate: row.p1DeviationRate,
    p2DeviationRate: row.p2DeviationRate,
    riskLevel: row.riskLevel,
    riskTags: JSON.stringify(row.riskTags),
    qualityIssues: JSON.stringify(row.qualityIssues),
  };
}

function dbItemToRawRow(
  item: NonNullable<Awaited<ReturnType<typeof prisma.projectItem.findFirst>>>
): RawProjectRow {
  return dbRecordToRawRow(item);
}

async function saveDictionaries(
  entries: DictionaryEntry[],
  tx: Pick<typeof prisma, "dictionary"> = prisma
) {
  await tx.dictionary.deleteMany();
  if (entries.length === 0) return;
  await tx.dictionary.createMany({
    data: entries.map((e) => ({
      category: e.category,
      value: e.value,
      parentValue: e.parentValue ?? "",
      sortOrder: e.sortOrder,
      enabled: true,
    })),
  });
}

export async function importProjects(
  projects: RawProjectRow[],
  dictionaries: DictionaryEntry[],
  fileName: string,
  mode: "reset" = "reset"
) {
  const importableProjects = projects.filter((row) => !isEmpty(row.uuid));
  const statsDate = getStatsDate();
  const baselines = computeTypeBaselines(importableProjects);
  const enriched = importableProjects.map((row) => enrichRow(row, baselines, statsDate));

  await prisma.$transaction(async (tx) => {
    await saveDictionaries(dictionaries, tx);
    const batch = await tx.importBatch.create({
      data: {
        fileName,
        rowCount: enriched.length,
        mode,
        note: mode === "reset" ? "按 UUID 覆盖并导入" : "",
      },
    });
    for (const row of enriched) {
      const existing = row.uuid
        ? await tx.projectItem.findFirst({
            where: { uuid: row.uuid },
            select: { id: true },
          })
        : null;
      const data = toDbPayload(row, batch.id);
      if (existing) {
        await tx.projectItem.update({ where: { id: existing.id }, data });
      } else {
        await tx.projectItem.create({ data });
      }
    }
    await tx.appConfig.upsert({
      where: { id: "default" },
      create: { id: "default", statsDate: process.env.STATS_DATE || "2026-06-18" },
      update: {},
    });
  });

  return { rowCount: enriched.length };
}

/** 清空 SQLite 中全部业务数据（项目、字典、导入批次、配置） */
export async function clearAllDatabase() {
  await prisma.$transaction([
    prisma.projectItem.deleteMany(),
    prisma.dictionary.deleteMany(),
    prisma.importBatch.deleteMany(),
    prisma.appConfig.deleteMany(),
  ]);
}

export async function importFromBuffer(buffer: Buffer, fileName: string) {
  const { projects, dictionaries } = parseExcelBuffer(buffer);
  return importProjects(projects, dictionaries, fileName);
}

export async function importFromFile(filePath: string) {
  const { projects, dictionaries, fileName } = parseExcelFile(filePath);
  return importProjects(projects, dictionaries, fileName);
}

export async function recalculateAllProjects() {
  const items = await prisma.projectItem.findMany();
  const rawRows = items.map((item) => dbItemToRawRow(item));
  const statsDate = getStatsDate();
  const baselines = computeTypeBaselines(rawRows);
  const enriched = rawRows.map((row) => enrichRow(row, baselines, statsDate));

  await prisma.$transaction(
    enriched.map((row, index) =>
      prisma.projectItem.update({
        where: { id: items[index].id },
        data: toDbPayload({ ...row, sourceRowNumber: items[index].sourceRowNumber ?? undefined }),
      })
    )
  );
}

export function parseJsonArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function serializeProject(item: Awaited<ReturnType<typeof prisma.projectItem.findFirst>>) {
  if (!item) return null;
  return {
    ...item,
    riskTags: parseJsonArray(item.riskTags),
    qualityIssues: parseJsonArray(item.qualityIssues),
  };
}

export async function upsertProject(id: string | null, data: RawProjectRow) {
  const targetId = id ?? (data.uuid
    ? (await prisma.projectItem.findFirst({
        where: { uuid: data.uuid },
        select: { id: true },
      }))?.id ?? null
    : null);
  const allItems = await prisma.projectItem.findMany();
  const baselineRows = allItems
    .filter((item) => (targetId ? item.id !== targetId : true))
    .map((item) => dbItemToRawRow(item));
  baselineRows.push(data);

  const statsDate = getStatsDate();
  const baselines = computeTypeBaselines(baselineRows);
  const enriched = enrichRow(data, baselines, statsDate);
  const payload = toDbPayload(enriched);

  if (targetId) {
    const updated = await prisma.projectItem.update({
      where: { id: targetId },
      data: payload,
    });
    return serializeProject(updated);
  }

  const created = await prisma.projectItem.create({ data: payload });
  return serializeProject(created);
}
