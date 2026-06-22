import Link from "next/link";
import { RISK_COLORS, RISK_LABELS, RISK_TOOLTIPS } from "@/lib/types";

export function StatCard({
  title,
  value,
  sub,
  href,
  disabled = false,
}: {
  title: string;
  value: string | number;
  sub?: string;
  href?: string;
  disabled?: boolean;
}) {
  const inner = (
    <>
      <div className="text-xs text-slate-500">{title}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-slate-900">{value}</div>
      {sub ? <div className="mt-1 text-xs text-slate-500">{sub}</div> : null}
    </>
  );

  const isClickable = Boolean(href) && !disabled;

  if (isClickable) {
    return (
      <Link
        href={href!}
        className="block rounded-lg border border-slate-200 bg-white p-4 transition-colors hover:border-slate-300 hover:bg-slate-50"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div
      className={`rounded-lg border border-slate-200 bg-white p-4 ${
        disabled ? "cursor-default opacity-75" : ""
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
  description?: string;
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
