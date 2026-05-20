import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getVehicleCheck, saveVehicleCheck } from "@/lib/db";
import type { VehicleCheck } from "@/lib/db";

export async function GET(req: Request) {
  const user = await requireUser();
  const { searchParams } = new URL(req.url);
  const listingId = searchParams.get("listing_id");
  if (!listingId) return NextResponse.json({ error: "missing listing_id" }, { status: 400 });
  return NextResponse.json(await getVehicleCheck(user.id, listingId) ?? {});
}

export async function PUT(req: Request) {
  const user = await requireUser();
  const body = await req.json() as Partial<VehicleCheck> & { listing_id: string };
  if (!body.listing_id) return NextResponse.json({ error: "missing listing_id" }, { status: 400 });
  await saveVehicleCheck(user.id, body.listing_id, body);
  return NextResponse.json({ ok: true });
}
