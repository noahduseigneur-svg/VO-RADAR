import { NextResponse } from "next/server";
import { requireUser } from "@/lib/auth";
import { getGarageSettings, saveGarageSettings } from "@/lib/db";
import type { GarageProfile } from "@/lib/margin";

export async function GET() {
  const user = await requireUser();
  return NextResponse.json(await getGarageSettings(user.id));
}

export async function PUT(req: Request) {
  const user = await requireUser();
  const body = await req.json() as Partial<GarageProfile>;

  const current = await getGarageSettings(user.id);
  const updated: GarageProfile = {
    transport_eur: Number(body.transport_eur ?? current.transport_eur),
    recon_base_eur: Number(body.recon_base_eur ?? current.recon_base_eur),
    recon_per_year_eur: Number(body.recon_per_year_eur ?? current.recon_per_year_eur),
    recon_per_10k_km_eur: Number(body.recon_per_10k_km_eur ?? current.recon_per_10k_km_eur),
    prep_ct_eur: Number(body.prep_ct_eur ?? current.prep_ct_eur),
    fixed_costs_eur: Number(body.fixed_costs_eur ?? current.fixed_costs_eur),
    target_margin_eur: Number(body.target_margin_eur ?? current.target_margin_eur),
  };

  await saveGarageSettings(user.id, updated);
  return NextResponse.json({ ok: true });
}
