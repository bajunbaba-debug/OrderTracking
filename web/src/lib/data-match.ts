import { prisma } from "@/lib/prisma";
import { getLatestImportBatch } from "@/lib/import-batch";
import { parseJsonArray } from "@/lib/project-service";

function unmatchedWhere(latestBatchId: string) {
  return {
    OR: [{ lastImportBatchId: "" }, { NOT: { lastImportBatchId: latestBatchId } }],
  } as const;
}

export async function getUnmatchedProjectItems() {
  const latest = await getLatestImportBatch();
  if (!latest) return { latest: null, items: [] };

  const items = await prisma.projectItem.findMany({
    where: unmatchedWhere(latest.id),
    orderBy: { updatedAt: "desc" },
  });

  return {
    latest,
    items: items.map((item) => ({
      ...item,
      riskTags: parseJsonArray(item.riskTags),
      qualityIssues: parseJsonArray(item.qualityIssues),
    })),
  };
}

export async function deleteUnmatchedProjectItems(options: { ids?: string[]; all?: boolean }) {
  const latest = await getLatestImportBatch();
  if (!latest) {
    return { count: 0 };
  }

  const baseWhere = unmatchedWhere(latest.id);

  if (options.all) {
    return prisma.projectItem.deleteMany({ where: baseWhere });
  }

  const ids = options.ids?.filter((id) => id.trim() !== "") ?? [];
  if (ids.length === 0) {
    return { count: 0 };
  }

  return prisma.projectItem.deleteMany({
    where: {
      AND: [{ id: { in: ids } }, baseWhere],
    },
  });
}
