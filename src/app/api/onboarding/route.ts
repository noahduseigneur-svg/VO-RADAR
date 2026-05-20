import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { markOnboarded, createAlert } from "@/lib/db";
import { newId } from "@/lib/auth";
import type { AlertRule } from "@/lib/types";

// POST /api/onboarding — marque l'utilisateur comme onboardé + crée l'alerte optionnelle
export async function POST(req: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({})) as {
    alert?: {
      name: string;
      brand: string | null;
      model: string | null;
      max_price_eur: number | null;
      fuel: string | null;
      min_score: number;
    } | null;
  };

  if (body.alert) {
    const rule: AlertRule = {
      id: newId("alert_"),
      user_id: user.id,
      name: body.alert.name || "Ma première alerte",
      brand: body.alert.brand,
      model: body.alert.model,
      max_price_eur: body.alert.max_price_eur,
      max_mileage_km: null,
      min_year: null,
      fuel: body.alert.fuel as AlertRule["fuel"],
      min_score: body.alert.min_score ?? 70,
      region: null,
      active: 1,
      created_at: new Date().toISOString(),
    };
    await createAlert(rule).catch(() => {});
  }

  await markOnboarded(user.id);
  return NextResponse.json({ ok: true });
}
