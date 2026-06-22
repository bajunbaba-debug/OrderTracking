export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (value == null || Number.isNaN(value)) return "-";
  return value.toFixed(digits).replace(/\.0$/, "");
}

/** 从 Date 或 ISO 字符串提取 yyyy-MM-dd（按 UTC 日历日，避免时区偏移） */
export function formatDate(value: Date | string | null | undefined): string {
  if (!value) return "-";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function formatDateInput(value: Date | string | null | undefined): string {
  if (!value) return "";
  const formatted = formatDate(value);
  return formatted === "-" ? "" : formatted;
}

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** 将 yyyy-MM-dd 转为 UTC 正午 Date，避免跨时区偏一天 */
export function parseDateInput(value: string): Date | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const match = trimmed.match(DATE_ONLY_RE);
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return Number.isNaN(date.getTime()) ? null : date;
}

/** 统一业务日期：Excel / 字符串 / Date 均归一化为 UTC 正午 */
export function normalizeBusinessDate(value: unknown): Date | null {
  if (value == null || value === "") return null;

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(
      Date.UTC(value.getFullYear(), value.getMonth(), value.getDate(), 12, 0, 0)
    );
  }

  const text = String(value).trim();
  const isoMatch = text.match(DATE_ONLY_RE);
  if (isoMatch) {
    return parseDateInput(isoMatch[0]);
  }

  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return null;
  return new Date(
    Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate(), 12, 0, 0)
  );
}

/** 当前日期的 yyyy-MM-dd（本地日历，用于标记完成等） */
export function todayDateInput(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}
