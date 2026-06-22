"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/members", label: "成员" },
  { href: "/contracts", label: "合同" },
  { href: "/types", label: "类型" },
];

export function AnalysisTabs() {
  const pathname = usePathname();

  return (
    <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-3">
      <span className="mr-2 text-sm font-medium text-slate-500">分析</span>
      {TABS.map((tab) => {
        const active = pathname.startsWith(tab.href);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`rounded px-3 py-1.5 text-sm ${
              active
                ? "bg-slate-900 text-white"
                : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
