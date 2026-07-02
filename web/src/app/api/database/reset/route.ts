import { NextRequest, NextResponse } from "next/server";
import { verifyAdminPassword } from "@/lib/auth/config";
import { assertAdminApi } from "@/lib/auth/server";
import { clearAllDatabase } from "@/lib/project-service";

export async function POST(request: NextRequest) {
  try {
    const denied = await assertAdminApi();
    if (denied) return denied;

    const body = (await request.json().catch(() => ({}))) as { password?: unknown };
    const password = typeof body.password === "string" ? body.password : "";
    if (!verifyAdminPassword(password)) {
      return NextResponse.json({ error: "管理员密码错误" }, { status: 401 });
    }

    await clearAllDatabase();
    return NextResponse.json({ ok: true, message: "数据库已清空" });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "删库失败" },
      { status: 500 }
    );
  }
}
