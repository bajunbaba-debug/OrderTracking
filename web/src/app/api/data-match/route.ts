import { NextRequest, NextResponse } from "next/server";
import { assertCanWriteApi } from "@/lib/auth/server";
import { deleteUnmatchedProjectItems, getUnmatchedProjectItems } from "@/lib/data-match";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const result = await getUnmatchedProjectItems();
    return NextResponse.json({ ...result, count: result.items.length });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "数据匹配加载失败" },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const denied = await assertCanWriteApi();
    if (denied) return denied;

    const body = (await request.json().catch(() => ({}))) as { ids?: unknown; all?: unknown };
    if (body.all === true) {
      const result = await deleteUnmatchedProjectItems({ all: true });
      return NextResponse.json({ ok: true, deletedCount: result.count });
    }

    const ids = Array.isArray(body.ids)
      ? body.ids.filter((id): id is string => typeof id === "string" && id.trim() !== "")
      : [];
    if (ids.length === 0) {
      return NextResponse.json({ error: "请选择需要删除的数据" }, { status: 400 });
    }

    const result = await deleteUnmatchedProjectItems({ ids });
    return NextResponse.json({ ok: true, deletedCount: result.count });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "删除失败" },
      { status: 500 }
    );
  }
}
