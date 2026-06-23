"use client";

import Link from "next/link";
import { useState } from "react";

interface Props {
  count: number;
  messages: string[];
}

export function TimelineRiskFooter({ count, messages }: Props) {
  const [expanded, setExpanded] = useState(false);

  if (count <= 0) {
    return (
      <div className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-500">
        风险汇总：当前视图暂无时间流风险项
        <Link href="/risks" className="ml-2 text-blue-700 hover:underline">
          查看明细风险清单 →
        </Link>
      </div>
    );
  }

  return (
    <div className="shrink-0 rounded-lg border border-red-200 bg-red-50/80">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-xs text-red-900"
      >
        <span>
          <strong>风险汇总（{count}）</strong>
          {!expanded && messages[0] ? (
            <span className="ml-2 font-normal text-red-700/80">· {messages[0]}</span>
          ) : null}
        </span>
        <span className="shrink-0 text-red-600">{expanded ? "收起" : "展开"}</span>
      </button>
      {expanded ? (
        <div className="border-t border-red-200/60 px-3 pb-2 pt-1">
          <ul className="list-inside list-disc text-[11px] text-red-800">
            {messages.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
          <Link href="/risks" className="mt-2 inline-block text-[11px] text-blue-700 hover:underline">
            查看完整明细风险清单 →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
