import Link from "next/link";
import { RISK_COLORS, RISK_LABELS, RISK_TOOLTIPS } from "@/lib/types";
import { formatDate, formatNumber, isMissingField, MISSING_FIELD_LABEL } from "@/lib/format";

export function MissingValue({ className = "text-red-600" }: { className?: string }) {
  return <span className={className}>{MISSING_FIELD_LABEL}</span>;
}

export function DisplayText({
  value,
  className,
}: {
  value: string | null | undefined;
  className?: string;
}) {
  if (isMissingField(value)) return <MissingValue className={className} />;
  return <span className={className}>{value}</span>;
}

export function DisplayDate({ value }: { value: Date | string | null | undefined }) {
  if (isMissingField(value)) return <MissingValue />;
  return <>{formatDate(value)}</>;
}

export function DisplayNumber({
  value,
  digits = 1,
}: {
  value: number | null | undefined;
  digits?: number;
}) {
  if (value == null || Number.isNaN(value)) return <MissingValue />;
  return <>{formatNumber(value, digits)}</>;
}

export function StatCard({
  title,
  value,
  sub,
  href,
  disabled = false,
  alertHighlight = false,
}: {
  title: string;
  value: string | number;
  sub?: string;
  href?: string;
  disabled?: boolean;
  /** 数值大于 0 时用柔和警示样式突出，而非大红色圆圈 */
  alertHighlight?: boolean;
}) {
  const numericValue = typeof value === "number" ? value : Number(value);
  const showAlert = alertHighlight && Number.isFinite(numericValue) && numericValue > 0;

  const inner = (
    <>
      <div className="flex items-center gap-1.5 text-xs text-slate-500">
        {showAlert ? (
          <span
            className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500"
            aria-hidden
          />
        ) : null}
        <span>{title}</span>
      </div>
      <div
        className={`mt-1 text-2xl font-semibold tabular-nums ${
          showAlert ? "text-amber-700" : "text-slate-900"
        }`}
      >
        {value}
      </div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
      {showAlert ? <div className="mt-1 text-xs text-amber-700/80">点击查看明细</div> : null}
    </>
  );

  const cardClassName = showAlert
    ? "border-amber-200 bg-amber-50/70 hover:border-amber-300 hover:bg-amber-50"
    : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50";

  const isClickable = Boolean(href) && !disabled;

  if (isClickable) {
    return (
      <Link
        href={href!}
        className={`block rounded-lg border p-4 transition-colors ${cardClassName}`}
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className={`rounded-lg border p-4 ${
        disabled ? "cursor-default border-slate-200 bg-white opacity-75" : cardClassName
      }`}
      aria-disabled={disabled || undefined}
    >
      {inner}
    </div>
  );
}

export function RiskBadge({ level }: { level: string }) {
  const tooltip = RISK_TOOLTIPS[level];
  return (
    <span
      title={tooltip}
      className={`inline-flex items-center rounded border px-2 py-0.5 text-xs font-medium ${
        RISK_COLORS[level] ?? RISK_COLORS.green
      }`}
    >
      {RISK_LABELS[level] ?? level}
    </span>
  );
}

export function PageHeader({
  title,
  description,
  action,
  extra,
}: {
  title: string;
  description?: React.ReactNode;
  action?: React.ReactNode;
  extra?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          {extra}
        </div>
        {description ? <p className="mt-1 text-sm text-slate-500">{description}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
      {message}
    </div>
  );
}

export function TableWrap({ children }: { children: React.ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="min-w-full table-fixed text-sm [&_td]:align-middle [&_th]:align-middle">{children}</table>
    </div>
  );
}

export const TH = "px-3 py-2 text-left align-middle";
export const TD = "px-3 py-2 align-middle";
export const TH_NUM = "px-3 py-2 text-right align-middle tabular-nums";
export const TD_NUM = "px-3 py-2 text-right align-middle tabular-nums";
