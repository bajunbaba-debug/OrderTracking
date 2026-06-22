import { NextResponse } from "next/server";
import { getDashboardStats } from "@/lib/analytics";
import { APP_CONFIG } from "@/lib/config";

export async function GET() {
  const stats = await getDashboardStats();
  return NextResponse.json({ ...stats, statsDate: APP_CONFIG.statsDate });
}
