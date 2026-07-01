import { prisma } from "@/lib/prisma";

export type ImportSource = "local" | "api";

export interface ImportBatchSummary {
  id: string;
  importedAt: string;
  rowCount: number;
  mode: string;
  fileName: string;
  source: ImportSource;
  sourceLabel: string;
  displayText: string;
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

export function formatDateTimeToSecond(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  const hh = pad2(date.getHours());
  const mm = pad2(date.getMinutes());
  const ss = pad2(date.getSeconds());
  return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
}

export function getImportSource(mode: string): ImportSource {
  return mode === "api" || mode === "integration-api" ? "api" : "local";
}

export function getImportSourceLabel(mode: string): string {
  return getImportSource(mode) === "api" ? "通过 API 导入" : "本地批量导入";
}

export function toImportBatchSummary(batch: {
  id: string;
  importedAt: Date;
  rowCount: number;
  mode: string;
  fileName: string;
}): ImportBatchSummary {
  const sourceLabel = getImportSourceLabel(batch.mode);
  const importedAt = batch.importedAt.toISOString();
  return {
    id: batch.id,
    importedAt,
    rowCount: batch.rowCount,
    mode: batch.mode,
    fileName: batch.fileName,
    source: getImportSource(batch.mode),
    sourceLabel,
    displayText: `${formatDateTimeToSecond(batch.importedAt)} · ${sourceLabel}`,
  };
}

export async function getLatestImportBatch() {
  const batch = await prisma.importBatch.findFirst({
    orderBy: { importedAt: "desc" },
    select: {
      id: true,
      importedAt: true,
      rowCount: true,
      mode: true,
      fileName: true,
    },
  });

  return batch ? toImportBatchSummary(batch) : null;
}
