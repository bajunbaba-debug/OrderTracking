import { NextRequest, NextResponse } from "next/server";
import { getRiskItems } from "@/lib/analytics";

export async function GET(request: NextRequest) {
  const riskLevel = request.nextUrl.searchParams.get("riskLevel") ?? undefined;
  return NextResponse.json(await getRiskItems(riskLevel || undefined));
}
