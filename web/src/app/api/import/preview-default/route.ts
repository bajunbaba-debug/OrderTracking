import { NextResponse } from "next/server";
import { readExcelFile } from "@/lib/excel";
import { DEFAULT_EXCEL_FILE } from "@/lib/paths";

export async function GET() {
  const preview = readExcelFile(DEFAULT_EXCEL_FILE);
  return NextResponse.json(preview);
}
