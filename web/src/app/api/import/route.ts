import { NextRequest, NextResponse } from "next/server";
import { importFromBuffer, importFromFile } from "@/lib/project-service";
import { DEFAULT_EXCEL_FILE } from "@/lib/paths";

export async function POST(request: NextRequest) {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "请上传 Excel 文件" }, { status: 400 });
    }
    const buffer = Buffer.from(await file.arrayBuffer());
    const result = await importFromBuffer(buffer, file.name);
    return NextResponse.json({
      ...result,
      mode: "reset",
      message: "已清空旧数据并重新导入",
    });
  }

  const body = await request.json().catch(() => ({}));
  if (body.source === "default") {
    const result = await importFromFile(DEFAULT_EXCEL_FILE);
    return NextResponse.json({
      ...result,
      mode: "reset",
      message: "已清空旧数据并重新导入",
    });
  }

  return NextResponse.json({ error: "无效导入请求" }, { status: 400 });
}
