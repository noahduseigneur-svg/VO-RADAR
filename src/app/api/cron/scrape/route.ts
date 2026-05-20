import { NextResponse } from "next/server";

// Called by Vercel Cron every hour
export async function GET(req: Request) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { runScrapers } = await import("@/lib/scrapers");
  const result = await runScrapers({ limit: 300 });
  return NextResponse.json(result);
}
