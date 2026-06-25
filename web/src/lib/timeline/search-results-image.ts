import { formatDate } from "@/lib/format";
import { STATUS_LABELS } from "@/lib/timeline/schedule";
import type { TimelineSearchResult } from "@/lib/timeline/types";

const FONT_FAMILY =
  'system-ui, -apple-system, "PingFang SC", "Microsoft YaHei", "Segoe UI", sans-serif';

const TABLE_HEADERS = ["合同号", "负责人", "类型", "型号", "状态", "队列", "预计时段"] as const;

const COLUMN_MIN_WIDTHS = [72, 56, 48, 64, 56, 44, 128];

function formatQueueLabel(position: TimelineSearchResult["queuePosition"]): string {
  if (!position) return "—";
  return `${position.index + 1}/${position.total}`;
}

function searchResultToRow(result: TimelineSearchResult): string[] {
  return [
    result.contractNo || "—",
    result.owner || "—",
    result.type || "—",
    result.model || "—",
    STATUS_LABELS[result.status],
    formatQueueLabel(result.queuePosition),
    `${formatDate(result.startDate)} → ${formatDate(result.endDate)}`,
  ];
}

function truncateText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string {
  if (ctx.measureText(text).width <= maxWidth) return text;
  const ellipsis = "…";
  let truncated = text;
  while (truncated.length > 0 && ctx.measureText(truncated + ellipsis).width > maxWidth) {
    truncated = truncated.slice(0, -1);
  }
  return truncated.length > 0 ? truncated + ellipsis : ellipsis;
}

/** 将搜索结果表格渲染为 PNG 并写入剪贴板 */
export async function copySearchResultsTableAsImage(
  results: TimelineSearchResult[]
): Promise<void> {
  if (results.length === 0) return;
  if (typeof navigator === "undefined" || !navigator.clipboard?.write) {
    throw new Error("clipboard_unavailable");
  }

  const rows = results.map(searchResultToRow);
  const allRows = [TABLE_HEADERS.slice(), ...rows];

  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas_unavailable");

  const fontSize = 12;
  const headerFontSize = 12;
  const titleFontSize = 13;
  const paddingX = 10;
  const rowHeight = 30;
  const headerHeight = 32;
  const titleHeight = 36;
  const borderColor = "#e2e8f0";
  const headerBg = "#f8fafc";
  const textPrimary = "#0f172a";
  const textSecondary = "#475569";
  const textMuted = "#64748b";

  ctx.font = `${fontSize}px ${FONT_FAMILY}`;

  const colWidths = TABLE_HEADERS.map((header, colIndex) => {
    let max = ctx.measureText(header).width;
    for (const row of allRows) {
      max = Math.max(max, ctx.measureText(row[colIndex] ?? "").width);
    }
    return Math.max(COLUMN_MIN_WIDTHS[colIndex] ?? 48, max + paddingX * 2);
  });

  const tableWidth = colWidths.reduce((sum, width) => sum + width, 0);
  const tableHeight = headerHeight + rows.length * rowHeight;
  const totalWidth = tableWidth;
  const totalHeight = titleHeight + tableHeight + 12;

  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.ceil(totalWidth * dpr);
  canvas.height = Math.ceil(totalHeight * dpr);
  ctx.scale(dpr, dpr);

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, totalWidth, totalHeight);

  ctx.font = `600 ${titleFontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = textMuted;
  ctx.textBaseline = "middle";
  ctx.fillText(`搜索结果（共 ${results.length} 条处理项次）`, paddingX, titleHeight / 2);

  let y = titleHeight;

  ctx.font = `600 ${headerFontSize}px ${FONT_FAMILY}`;
  ctx.fillStyle = headerBg;
  ctx.fillRect(0, y, tableWidth, headerHeight);
  ctx.strokeStyle = borderColor;
  ctx.lineWidth = 1;
  ctx.strokeRect(0, y, tableWidth, headerHeight);

  let x = 0;
  for (let col = 0; col < TABLE_HEADERS.length; col += 1) {
    const colWidth = colWidths[col]!;
    ctx.fillStyle = textMuted;
    ctx.fillText(
      TABLE_HEADERS[col]!,
      x + paddingX,
      y + headerHeight / 2,
      colWidth - paddingX * 2
    );
    if (col > 0) {
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y + headerHeight);
      ctx.stroke();
    }
    x += colWidth;
  }

  y += headerHeight;
  ctx.font = `${fontSize}px ${FONT_FAMILY}`;

  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
    const row = rows[rowIndex]!;
    if (rowIndex % 2 === 1) {
      ctx.fillStyle = "#fafafa";
      ctx.fillRect(0, y, tableWidth, rowHeight);
    }

    ctx.strokeStyle = borderColor;
    ctx.strokeRect(0, y, tableWidth, rowHeight);

    x = 0;
    for (let col = 0; col < row.length; col += 1) {
      const colWidth = colWidths[col]!;
      const cellText = truncateText(ctx, row[col]!, colWidth - paddingX * 2);
      ctx.fillStyle = col === 0 ? textPrimary : col === 6 ? textMuted : textSecondary;
      ctx.fillText(cellText, x + paddingX, y + rowHeight / 2, colWidth - paddingX * 2);
      if (col > 0) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x, y + rowHeight);
        ctx.stroke();
      }
      x += colWidth;
    }
    y += rowHeight;
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/png");
  });
  if (!blob) throw new Error("image_encode_failed");

  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}
