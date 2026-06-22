"use client";

import { usePathname } from "next/navigation";

/** 主内容区：pathname 变化时轻淡入 + 轻微上浮，无整页横滑 */
export function ContentFadeTransition({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="content-fade-in">
      {children}
    </div>
  );
}
