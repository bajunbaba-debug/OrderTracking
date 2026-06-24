import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import type { AuthUser } from "@/lib/timeline/types";
import { SESSION_COOKIE_NAME } from "@/lib/auth/constants";
import { getAuthSessionSecret } from "@/lib/auth/config";

const SESSION_MAX_AGE_SEC = 60 * 60 * 24 * 7;

interface SessionPayload {
  user: AuthUser;
  exp: number;
}

function signPayload(payload: string): string {
  return createHmac("sha256", getAuthSessionSecret()).update(payload).digest("base64url");
}

export function encodeSessionToken(user: AuthUser): string {
  const payload: SessionPayload = {
    user,
    exp: Date.now() + SESSION_MAX_AGE_SEC * 1000,
  };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${signPayload(body)}`;
}

export function decodeSessionToken(token: string | undefined | null): AuthUser | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  const expected = signPayload(body);
  try {
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  } catch {
    return null;
  }
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as SessionPayload;
    if (!payload?.user?.role || payload.exp < Date.now()) return null;
    return payload.user;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  return decodeSessionToken(cookieStore.get(SESSION_COOKIE_NAME)?.value);
}

export function sessionCookieOptions(token: string) {
  return {
    name: SESSION_COOKIE_NAME,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SEC,
  };
}

export function clearSessionCookieOptions() {
  return {
    name: SESSION_COOKIE_NAME,
    value: "",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  };
}
