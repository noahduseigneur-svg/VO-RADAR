import { NextResponse } from "next/server";
import { purgeOldListings } from "@/lib/db";

export const maxDuration = 60; // Vercel Hobby max

// Called by Vercel Cron every day
export async function GET(req: Request) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { runScrapers } = await import("@/lib/scrapers");
  // Configurable via SCRAPE_BATCH_SIZE (défaut 500 par source pour tenir dans 60s Vercel Hobby)
  const batchLimit = Number(process.env.SCRAPE_BATCH_SIZE ?? 500);
  const result = await runScrapers({ limit: batchLimit });

  // Nettoyer les annonces non-vues depuis plus de 90 jours
  const purged = await purgeOldListings(90);

  return NextResponse.json({ ...result, purged });
}
