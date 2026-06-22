import { NextResponse } from "next/server";
import { getQualityItems } from "@/lib/analytics";

export async function GET() {
  return NextResponse.json(await getQualityItems());
}
