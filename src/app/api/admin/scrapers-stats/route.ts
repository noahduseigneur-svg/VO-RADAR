import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { rawQuery } from "@/lib/db";

export interface ScraperStat {
  source: string;
  total: number;
  last_24h: number;
  last_48h: number;
  last_fetched_at: string | null;
  avg_price_eur: number | null;
  avg_score: number | null;
}

type RawStatRow = {
  source: string;
  total: number | bigint;
  last_24h: number | bigint;
  last_48h: number | bigint;
  last_fetched_at: string | null;
  avg_price_eur: number | null;
  avg_score: number | null;
};

export async function GET(): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const rows = await rawQuery<RawStatRow>(`
    SELECT
      source,
      COUNT(*) AS total,
      SUM(CASE WHEN fetched_at > datetime('now', '-24 hours') THEN 1 ELSE 0 END) AS last_24h,
      SUM(CASE WHEN fetched_at > datetime('now', '-48 hours') THEN 1 ELSE 0 END) AS last_48h,
      MAX(fetched_at) AS last_fetched_at,
      AVG(price_eur) AS avg_price_eur,
      AVG(score) AS avg_score
    FROM listings
    GROUP BY source
    ORDER BY total DESC
  `);

  const stats: ScraperStat[] = rows.map((r) => ({
    source: r.source,
    total: Number(r.total),
    last_24h: Number(r.last_24h),
    last_48h: Number(r.last_48h),
    last_fetched_at: r.last_fetched_at,
    avg_price_eur: r.avg_price_eur != null ? Math.round(Number(r.avg_price_eur)) : null,
    avg_score: r.avg_score != null ? Math.round(Number(r.avg_score)) : null,
  }));

  return NextResponse.json({ stats });
}
