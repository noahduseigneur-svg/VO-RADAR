import { NextResponse } from "next/server";

export const maxDuration = 60;

// Second run journalier — midi — scrape + digest en un seul cron slot
// Vercel Hobby : 2 cron jobs max, chacun 1x/jour
// Slot 1 : /api/cron/scrape        → 5h00 (matin)
// Slot 2 : /api/cron/scrape-noon   → 12h00 (midi) scrape + digest
export async function GET(req: Request) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { runScrapers } = await import("@/lib/scrapers");
  const { sendDailyDigests } = await import("@/lib/digest");

  const batchLimit = Number(process.env.SCRAPE_BATCH_SIZE ?? 500);
  const [scrapeResult, digestResult] = await Promise.allSettled([
    runScrapers({ limit: batchLimit }),
    sendDailyDigests(12),
  ]);

  return NextResponse.json({
    scrape: scrapeResult.status === "fulfilled" ? scrapeResult.value : { error: String(scrapeResult.reason) },
    digest: digestResult.status === "fulfilled" ? digestResult.value : { error: String(digestResult.reason) },
  });
}
