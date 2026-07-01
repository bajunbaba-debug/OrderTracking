import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";

function isPublicPath(pathname: string): boolean {
  return pathname === "/login" || pathname.startsWith("/api/auth/session");
}

function readSessionRole(token: string | undefined): string {
  if (!token) return "";
  const [body] = token.split(".");
  if (!body) return "";
  try {
    const normalized = body.replace(/-/g, "+").replace(/_/g, "/");
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
    const payload = JSON.parse(atob(padded)) as { user?: { role?: string } };
    return payload.user?.role ?? "";
  } catch {
    return "";
  }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  const isLogin = pathname === "/login";
  const sessionRole = readSessionRole(sessionCookie);

  if (!sessionCookie && !isPublicPath(pathname) && !pathname.startsWith("/api/")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") {
      url.searchParams.set("from", pathname);
    }
    return NextResponse.redirect(url);
  }

  if (sessionCookie && isLogin) {
    const from = request.nextUrl.searchParams.get("from");
    const target =
      sessionRole === "guest"
        ? "/guest-export"
        : from &&
            from.startsWith("/") &&
            !from.startsWith("/login") &&
            from !== "/guest-export"
          ? from
          : "/";
    return NextResponse.redirect(new URL(target, request.url));
  }

  if (sessionCookie && pathname === "/guest-export" && sessionRole && sessionRole !== "guest") {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
