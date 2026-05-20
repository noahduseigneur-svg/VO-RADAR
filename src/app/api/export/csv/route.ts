import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { queryListings } from "@/lib/db";

const COLS = [
  "id", "brand", "model", "version", "year", "mileage_km", "fuel", "gearbox", "power_hp",
  "price_eur", "market_value_eur", "delta_eur", "delta_pct", "score",
  "seller_kind", "region", "postal_code", "posted_at", "url",
] as const;

export async function GET(req: NextRequest): Promise<Response> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const rows = await queryListings({
    brand: sp.get("brand") ?? undefined,
    fuel: sp.get("fuel") ?? undefined,
    search: sp.get("search") ?? undefined,
    min_score: numParam(sp, "min_score"),
    max_price: numParam(sp, "max_price"),
    limit: 1000,
  });

  const header = COLS.join(",");
  const body = rows.map((r) =>
    COLS.map((c) => csvEscape((r as unknown as Record<string, unknown>)[c])).join(",")
  ).join("\n");
  const csv = `﻿${header}\n${body}\n`;

  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="vo-radar-${new Date().toISOString().slice(0, 10)}.csv"`,
    },
  });
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function numParam(sp: URLSearchParams, key: string): number | undefined {
  const v = sp.get(key);
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
