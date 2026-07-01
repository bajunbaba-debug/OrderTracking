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

const IMPORT_DISPLAY_TIME_ZONE = "Asia/Shanghai";
const DATE_TIME_PARTS = new Intl.DateTimeFormat("zh-CN", {
  timeZone: IMPORT_DISPLAY_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hour12: false,
});

export function formatDateTimeToSecond(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";

  const parts = Object.fromEntries(
    DATE_TIME_PARTS.formatToParts(date).map((part) => [part.type, part.value])
  );
  const y = parts.year;
  const m = parts.month;
  const d = parts.day;
  const hh = parts.hour;
  const mm = parts.minute;
  const ss = parts.second;
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
