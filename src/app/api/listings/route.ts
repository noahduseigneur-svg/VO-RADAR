import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { queryListings } from "@/lib/db";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const sp = req.nextUrl.searchParams;
  const listings = await queryListings({
    brand: sp.get("brand") ?? undefined,
    model: sp.get("model") ?? undefined,
    min_score: numParam(sp, "min_score"),
    max_price: numParam(sp, "max_price"),
    max_mileage: numParam(sp, "max_mileage"),
    min_year: numParam(sp, "min_year"),
    fuel: sp.get("fuel") ?? undefined,
    region: sp.get("region") ?? undefined,
    search: sp.get("search") ?? undefined,
    limit: numParam(sp, "limit") ?? 50,
    offset: numParam(sp, "offset") ?? 0,
  });
  return NextResponse.json({ listings });
}

function numParam(sp: URLSearchParams, key: string): number | undefined {
  const v = sp.get(key);
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}
