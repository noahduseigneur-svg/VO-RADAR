import { NextRequest, NextResponse } from "next/server";
import { runAllScrapers } from "@/lib/scrapers";

// Trigger via cron (Vercel cron, GitHub Actions, etc.).
// Protect with CRON_SECRET in production.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const expected = process.env.CRON_SECRET;
  if (expected) {
    const got = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
    if (got !== expected) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runAllScrapers();
  return NextResponse.json({ ok: true, result });
}

export const GET = POST;
