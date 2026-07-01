import { NextResponse } from "next/server";
import { getLatestImportBatch } from "@/lib/import-batch";

export const dynamic = "force-dynamic";

export async function GET() {
  const latest = await getLatestImportBatch();
  return NextResponse.json({ latest });
}
