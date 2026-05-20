import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { getScrapeStatus } from "@/lib/scrapers";
import { countListingsBySource } from "@/lib/db";

export async function GET(): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const status = getScrapeStatus();
  const counts = await countListingsBySource();
  const totalInDb = counts.reduce((a, b) => a + b.n, 0);

  return NextResponse.json({
    status,
    total_in_db: totalInDb,
    by_source: counts,
  });
}
