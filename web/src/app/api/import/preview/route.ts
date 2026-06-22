import { NextRequest, NextResponse } from "next/server";
import { readExcelBuffer } from "@/lib/excel";

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const file = formData.get("file");
  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: "请上传 Excel 文件" }, { status: 400 });
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const preview = readExcelBuffer(buffer, file.name);
  return NextResponse.json(preview);
}
