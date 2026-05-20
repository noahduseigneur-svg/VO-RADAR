import { NextResponse } from "next/server";

export const maxDuration = 60; // Vercel Hobby max

// Called by Vercel Cron every day
export async function GET(req: Request) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { runScrapers } = await import("@/lib/scrapers");
  const result = await runScrapers({ limit: 300 });
  return NextResponse.json(result);
}
