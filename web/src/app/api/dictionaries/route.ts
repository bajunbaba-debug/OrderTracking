import { NextRequest, NextResponse } from "next/server";
import { assertCanWriteApi } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { dictionaryCategoryWriteTargets, getDictionaries, normalizeDictionaryCategory } from "@/lib/dictionary";

export async function GET() {
  return NextResponse.json(await getDictionaries());
}

/** 新增或更新字典项 */
export async function POST(request: NextRequest) {
  const denied = await assertCanWriteApi();
  if (denied) return denied;

  const body = (await request.json()) as {
    category: string;
    value: string;
    parentValue?: string;
  };
  const category = normalizeDictionaryCategory(String(body.category ?? "").trim());
  const value = String(body.value ?? "").trim();
  const parentValue = String(body.parentValue ?? "").trim();

  if (!category || !value) {
    return NextResponse.json({ error: "分类与值不能为空" }, { status: 400 });
  }

  const categoryTargets = dictionaryCategoryWriteTargets(category);
  const existing = await prisma.dictionary.findFirst({
    where: { category: { in: categoryTargets }, value, parentValue },
  });
  if (existing) {
    await prisma.dictionary.update({
      where: { id: existing.id },
      data: { category, enabled: true },
    });
  } else {
    const maxOrder = await prisma.dictionary.aggregate({
      where: { category },
      _max: { sortOrder: true },
    });
    await prisma.dictionary.create({
      data: {
        category,
        value,
        parentValue,
        sortOrder: (maxOrder._max.sortOrder ?? 0) + 1,
        enabled: true,
      },
    });
  }

  return NextResponse.json(await getDictionaries());
}

/** 删除字典项（软删除） */
export async function DELETE(request: NextRequest) {
  const denied = await assertCanWriteApi();
  if (denied) return denied;

  const params = request.nextUrl.searchParams;
  const category = params.get("category");
  const value = params.get("value");
  const parentValue = params.get("parentValue") ?? "";

  if (!category || !value) {
    return NextResponse.json({ error: "缺少参数" }, { status: 400 });
  }

  await prisma.dictionary.updateMany({
    where: { category: { in: dictionaryCategoryWriteTargets(category) }, value, parentValue },
    data: { enabled: false },
  });

  return NextResponse.json(await getDictionaries());
}
