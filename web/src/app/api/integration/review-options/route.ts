import { NextResponse } from "next/server";
import { getReviewOptions } from "@/lib/dictionary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** B 站集成：返回审批工作台所需的下拉选项 */
export async function GET() {
  return NextResponse.json(await getReviewOptions());
}
