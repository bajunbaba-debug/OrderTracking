"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";

const TABS = [
  { href: "/members", label: "成员" },
  { href: "/contracts", label: "合同" },
  { href: "/types", label: "类型" },
];

function getActiveTabIndex(pathname: string) {
  return TABS.findIndex((tab) => pathname.startsWith(tab.href));
}

export function AnalysisTabs() {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;

    const activeIndex = getActiveTabIndex(pathname);
    if (activeIndex < 0) {
      indicator.style.opacity = "0";
      return;
    }

    const activeEl = itemRefs.current[activeIndex];
    if (!activeEl) return;

    const navRect = nav.getBoundingClientRect();
    const elRect = activeEl.getBoundingClientRect();
    indicator.style.opacity = "1";
    indicator.style.width = `${elRect.width}px`;
    indicator.style.transform = `translateX(${elRect.left - navRect.left}px)`;
  }, [pathname]);

  return (
    <div className="mb-4 flex items-center gap-2">
      <span className="mr-2 text-sm font-medium text-slate-500">分析</span>
      <nav ref={navRef} className="main-nav relative inline-flex gap-0.5 rounded-lg bg-slate-100 p-1">
        <span ref={indicatorRef} className="main-nav-indicator" aria-hidden="true" />
        {TABS.map((tab, index) => {
          const active = pathname.startsWith(tab.href);
          return (
            <Link
              key={tab.href}
              ref={(el) => {
                itemRefs.current[index] = el;
              }}
              href={tab.href}
              className={
                active
                  ? "main-nav-link main-nav-link-active rounded-md px-3 py-1.5 text-sm !text-white hover:!text-white focus:!text-white focus-visible:!text-white visited:!text-white"
                  : "main-nav-link rounded-md px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 focus-visible:text-slate-800"
              }
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
