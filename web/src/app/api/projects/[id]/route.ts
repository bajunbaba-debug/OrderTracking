import { NextRequest, NextResponse } from "next/server";
import { assertCanWriteApi } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { dbRecordToRawRow, mergeProjectBody } from "@/lib/project-input";
import { serializeProject, upsertProject } from "@/lib/project-service";
import { formatValidationErrors, validateProjectRow } from "@/lib/project-validation";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const item = await prisma.projectItem.findUnique({ where: { id } });
  if (!item) {
    return NextResponse.json({ error: "未找到项目" }, { status: 404 });
  }
  return NextResponse.json(serializeProject(item));
}

export async function PUT(request: NextRequest, { params }: Params) {
  const denied = await assertCanWriteApi();
  if (denied) return denied;

  const { id } = await params;
  const existing = await prisma.projectItem.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "未找到项目" }, { status: 404 });
  }

  const body = await request.json();
  const row = mergeProjectBody(dbRecordToRawRow(existing), body);

  const bodyKeys = Object.keys(body as Record<string, unknown>);
  const isMarkCompleteOnly =
    bodyKeys.length === 1 && bodyKeys[0] === "designCompleteDate";
  const isEstimateOnly =
    bodyKeys.length === 1 && bodyKeys[0] === "estimatedComplexity";

  if (isEstimateOnly) {
    const raw = (body as Record<string, unknown>).estimatedComplexity;
    const num =
      raw === null || raw === undefined || raw === "" ? Number.NaN : Number(raw);
    if (!Number.isFinite(num) || num <= 0) {
      return NextResponse.json(
        { error: "预计(工作日)必须是大于 0 的有效数字" },
        { status: 400 }
      );
    }
  }

  if (!isMarkCompleteOnly && !isEstimateOnly) {
    const validation = validateProjectRow(row);
    if (!validation.ok) {
      return NextResponse.json(
        { error: formatValidationErrors(validation.errors) },
        { status: 400 }
      );
    }
  }

  const updated = await upsertProject(id, row);
  return NextResponse.json(updated);
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const denied = await assertCanWriteApi();
  if (denied) return denied;

  const { id } = await params;
  await prisma.projectItem.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
