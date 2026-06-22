import { NextResponse } from "next/server";
import { getTypeStats } from "@/lib/analytics";

export async function GET() {
  return NextResponse.json(await getTypeStats());
}
