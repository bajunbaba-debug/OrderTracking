"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLayoutEffect, useRef } from "react";
import { ContentFadeTransition } from "@/components/ContentFadeTransition";
import { AuthBar } from "@/components/timeline/AuthBar";

const NAV_ITEMS = [
  { href: "/", label: "总览" },
  { href: "/projects", label: "明细" },
  { href: "/members", label: "分析", match: ["/members", "/contracts", "/types"] },
  { href: "/timeline", label: "订单时间流", match: ["/timeline", "/risks"] },
];

function isNavActive(pathname: string, item: (typeof NAV_ITEMS)[number]) {
  if (item.href === "/") return pathname === "/";
  if (item.match) return item.match.some((p) => pathname.startsWith(p));
  return pathname.startsWith(item.href);
}

function getActiveNavIndex(pathname: string) {
  return NAV_ITEMS.findIndex((item) => isNavActive(pathname, item));
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const navRef = useRef<HTMLElement>(null);
  const indicatorRef = useRef<HTMLSpanElement>(null);
  const itemRefs = useRef<(HTMLAnchorElement | null)[]>([]);

  useLayoutEffect(() => {
    const nav = navRef.current;
    const indicator = indicatorRef.current;
    if (!nav || !indicator) return;

    const activeIndex = getActiveNavIndex(pathname);
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-[1400px] items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-base font-semibold text-slate-900">订单项目分析系统</h1>
            <p className="text-xs text-slate-500">本地部署 · 订单项目管理</p>
          </div>
          <div className="flex items-center gap-4">
            <AuthBar />
            <nav ref={navRef} className="main-nav relative inline-flex gap-0.5 rounded-lg bg-slate-100 p-1">
            <span ref={indicatorRef} className="main-nav-indicator" aria-hidden="true" />
            {NAV_ITEMS.map((item, index) => {
              const active = isNavActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  ref={(el) => {
                    itemRefs.current[index] = el;
                  }}
                  href={item.href}
                  className={
                    active
                      ? "main-nav-link main-nav-link-active rounded-md px-3 py-1.5 text-sm !text-white hover:!text-white focus:!text-white focus-visible:!text-white visited:!text-white"
                      : "main-nav-link rounded-md px-3 py-1.5 text-sm text-slate-600 hover:text-slate-800 focus-visible:text-slate-800"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-[1400px] px-6 py-6">
        <ContentFadeTransition>{children}</ContentFadeTransition>
      </main>
    </div>
  );
}
