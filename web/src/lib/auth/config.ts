import { hashPassword, verifyPassword } from "@/lib/auth/password";

function env(name: string, fallback?: string): string {
  const value = process.env[name];
  if (value) return value;
  return fallback ?? "";
}

export function getAuthSessionSecret(): string {
  const secret = process.env.AUTH_SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("生产环境必须设置 AUTH_SESSION_SECRET");
  }
  return "dev-session-secret-change-me";
}

const ADMIN_USERNAME = env("AUTH_ADMIN_USERNAME", "admin");
const ADMIN_PASSWORD_PLAIN = env("AUTH_ADMIN_PASSWORD", "tt996");
const ADMIN_PASSWORD_HASH = hashPassword(ADMIN_PASSWORD_PLAIN);

const MEMBER_PASSWORD_PLAIN = env("MEMBER_PASSWORD", "member123");
const MEMBER_PASSWORD_HASH = hashPassword(MEMBER_PASSWORD_PLAIN);

const GUEST_USERNAME = env("AUTH_GUEST_USERNAME", "guest");
const GUEST_PASSWORD_PLAIN = env("AUTH_GUEST_PASSWORD", "51955");
const GUEST_PASSWORD_HASH = hashPassword(GUEST_PASSWORD_PLAIN);

export function verifyAdminLogin(username: string, password: string): boolean {
  if (username !== ADMIN_USERNAME) return false;
  return verifyPassword(password, ADMIN_PASSWORD_HASH);
}

export function verifyMemberLogin(password: string): boolean {
  return verifyPassword(password, MEMBER_PASSWORD_HASH);
}

export function verifyGuestLogin(username: string, password: string): boolean {
  if (username !== GUEST_USERNAME) return false;
  return verifyPassword(password, GUEST_PASSWORD_HASH);
}

export function getAdminDisplayName(): string {
  return "管理员";
}

export { ADMIN_USERNAME, MEMBER_PASSWORD_PLAIN, GUEST_USERNAME };
