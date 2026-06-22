import { NextResponse } from "next/server";
import { getMemberStats } from "@/lib/analytics";

export async function GET() {
  return NextResponse.json(await getMemberStats());
}
