import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  getAdminDisplayName,
  verifyAdminLogin,
  verifyGuestLogin,
  verifyMemberLogin,
} from "@/lib/auth/config";
import {
  clearSessionCookieOptions,
  encodeSessionToken,
  getSessionUser,
  sessionCookieOptions,
} from "@/lib/auth/session";
import type { AuthUser } from "@/lib/timeline/types";

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as {
      mode?: string;
      username?: string;
      password?: string;
    };
    const mode = body.mode ?? "password";
    let user: AuthUser | null = null;

    if (mode === "password") {
      const username = (body.username ?? "").trim();
      const password = body.password ?? "";
      if (!username || !password) {
        return NextResponse.json({ error: "请输入账号和密码" }, { status: 400 });
      }
      if (verifyAdminLogin(username, password)) {
        user = {
          id: "admin",
          name: getAdminDisplayName(),
          role: "admin",
          department: "管理部",
        };
      } else if (verifyGuestLogin(username, password)) {
        user = {
          id: "guest",
          name: "guest",
          role: "guest",
          department: "游客",
        };
      } else {
        const memberRow = await prisma.projectItem.findFirst({
          where: { owner: username },
          select: { owner: true },
        });
        if (memberRow && verifyMemberLogin(password)) {
          user = {
            id: `member-${username}`,
            name: username,
            role: "member",
            department: "设计部",
          };
        }
      }
      if (!user) {
        return NextResponse.json({ error: "账号或密码错误" }, { status: 401 });
      }
    } else {
      return NextResponse.json({ error: "不支持的登录方式" }, { status: 400 });
    }

    const token = encodeSessionToken(user);
    const res = NextResponse.json({ user });
    res.cookies.set(sessionCookieOptions(token));
    return res;
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "登录失败" },
      { status: 500 }
    );
  }
}

export async function GET() {
  const user = await getSessionUser();
  return NextResponse.json({ user });
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(clearSessionCookieOptions());
  return res;
}
