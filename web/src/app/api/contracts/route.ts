import { NextResponse } from "next/server";
import { getContractStats } from "@/lib/analytics";

export async function GET() {
  return NextResponse.json(await getContractStats());
}
