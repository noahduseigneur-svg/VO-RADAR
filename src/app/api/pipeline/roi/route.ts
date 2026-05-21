import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { updateDealROI } from "@/lib/db";

export async function PATCH(req: Request) {
  const user = await requireUser();
  const body = await req.json() as {
    listingId: string;
    price_eur_paid?: number | null;
    fees_eur?: number;
    price_sold_eur?: number | null;
    sold_at?: string | null;
  };
  if (!body.listingId) return NextResponse.json({ error: "Missing listingId" }, { status: 400 });
  await updateDealROI(user.id, body.listingId, body);
  return NextResponse.json({ ok: true });
}
