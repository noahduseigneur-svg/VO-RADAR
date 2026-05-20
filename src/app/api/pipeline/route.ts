import { NextRequest, NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { clearDealStatus, setDealStatus, type DealStatus } from "@/lib/db";

const VALID: DealStatus[] = ["watching", "to_call", "negotiating", "won", "lost"];

export async function POST(req: NextRequest): Promise<NextResponse> {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as {
    listing_id?: string;
    status?: string;
    note?: string;
    target_price_eur?: number;
    max_offer_eur?: number;
    clear?: boolean;
  };
  if (!body.listing_id) return NextResponse.json({ error: "listing_id required" }, { status: 400 });

  if (body.clear) {
    await clearDealStatus(user.id, body.listing_id);
    return NextResponse.json({ ok: true, status: null });
  }

  if (!body.status || !VALID.includes(body.status as DealStatus)) {
    return NextResponse.json({ error: "invalid status" }, { status: 400 });
  }
  await setDealStatus(user.id, body.listing_id, body.status as DealStatus, {
    note: body.note ?? null,
    target_price_eur: body.target_price_eur ?? null,
    max_offer_eur: body.max_offer_eur ?? null,
  });
  return NextResponse.json({ ok: true, status: body.status });
}
