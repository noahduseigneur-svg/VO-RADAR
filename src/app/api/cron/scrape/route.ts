import { NextResponse } from "next/server";
import { purgeOldListings, getPendingPriceDropAlerts, getListingsGoneForWatching, type PriceDropAlert, type ListingGoneAlert } from "@/lib/db";

export const maxDuration = 60; // Vercel Hobby max

// Called by Vercel Cron every day
export async function GET(req: Request) {
  const secret = req.headers.get("authorization");
  if (secret !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { runScrapers } = await import("@/lib/scrapers");
  const { processNewListingsForAlerts } = await import("@/lib/matcher");

  const freshSince = new Date().toISOString();
  const batchLimit = Number(process.env.SCRAPE_BATCH_SIZE ?? 500);
  // Slot matin (5h) : voitures uniquement pour rester dans les 60s Vercel Hobby
  const result = await runScrapers({ limit: batchLimit, vehicleType: "car" });

  // Matching alertes instantané dès la fin du scrape
  const alertResult = await processNewListingsForAlerts(freshSince).catch((e) => {
    console.error("[cron/scrape] alert matching failed:", e);
    return { hits: 0, emails_sent: 0 };
  });

  // 1. Price drop alerts
  const priceDropAlerts = await getPendingPriceDropAlerts(freshSince).catch(() => [] as PriceDropAlert[]);
  // Grouper par user_id, max 1 email par user
  const priceDropByUser = new Map<string, PriceDropAlert[]>();
  for (const alert of priceDropAlerts) {
    const existing = priceDropByUser.get(alert.user_id) ?? [];
    existing.push(alert);
    priceDropByUser.set(alert.user_id, existing);
  }
  let priceDropEmailsSent = 0;
  for (const [, alerts] of priceDropByUser) {
    const first = alerts[0];
    const ok = await sendPriceDropEmail(first.email, alerts);
    if (ok) priceDropEmailsSent++;
  }

  // 2. Listing gone alerts (seulement dans le cron du matin — heure UTC 6-10)
  const hourUtc = new Date().getUTCHours();
  let goneEmailsSent = 0;
  if (hourUtc >= 6 && hourUtc < 10) {
    const goneAlerts = await getListingsGoneForWatching(48).catch(() => [] as ListingGoneAlert[]);
    // Grouper par user_id
    const goneByUser = new Map<string, ListingGoneAlert[]>();
    for (const alert of goneAlerts) {
      const existing = goneByUser.get(alert.user_id) ?? [];
      existing.push(alert);
      goneByUser.set(alert.user_id, existing);
    }
    for (const [, alerts] of goneByUser) {
      const first = alerts[0];
      const ok = await sendGoneEmail(first.email, alerts);
      if (ok) goneEmailsSent++;
    }
  }

  // Nettoyer les annonces non-vues depuis plus de 90 jours
  const purged = await purgeOldListings(90);

  return NextResponse.json({
    ...result,
    purged,
    alerts: alertResult,
    price_drop_alerts: priceDropEmailsSent,
    gone_alerts: goneEmailsSent,
  });
}

async function sendPriceDropEmail(to: string, alerts: PriceDropAlert[]): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "VO Radar <alertes@vo-radar.app>";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const subject = `[VO Radar] ${alerts.length} baisse${alerts.length > 1 ? "s" : ""} de prix détectée${alerts.length > 1 ? "s" : ""}`;

  const items = alerts
    .map(
      (a) =>
        `<tr>
          <td style="padding:12px 16px;border-bottom:1px solid #eee;">
            <div style="font-weight:600;color:#111;">${escHtml(a.brand)} ${escHtml(a.model)}</div>
          </td>
          <td style="padding:12px 16px;text-align:right;border-bottom:1px solid #eee;">
            <div style="font-size:13px;color:#888;text-decoration:line-through;">${fmtEurSimple(a.old_price)}</div>
            <div style="font-weight:700;color:#16a34a;">${fmtEurSimple(a.new_price)}</div>
            <div style="font-size:12px;color:#16a34a;">−${fmtEurSimple(a.old_price - a.new_price)}</div>
          </td>
          <td style="padding:12px 16px;text-align:right;border-bottom:1px solid #eee;">
            <a href="${appUrl}/listings/${escHtml(a.listing_id)}" style="background:#e11d48;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;font-size:13px;">Voir</a>
          </td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f6f7;margin:0;padding:24px;">
  <table cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:24px 24px 0;">
      <h1 style="margin:0;font-size:22px;color:#111;">${alerts.length} baisse${alerts.length > 1 ? "s" : ""} de prix</h1>
      <p style="color:#666;margin-top:8px;font-size:14px;">Des véhicules que vous suivez ont vu leur prix baisser.</p>
    </td></tr>
    <tr><td style="padding:16px 8px;"><table cellpadding="0" cellspacing="0" width="100%">${items}</table></td></tr>
    <tr><td style="padding:24px;background:#fafafa;color:#888;font-size:12px;text-align:center;">VO Radar — <a href="${appUrl}/settings" style="color:#888;">Gérer mes préférences</a></td></tr>
  </table>
</body></html>`;

  if (!key) {
    console.log(`\n[price-drop demo] to=${to} — ${alerts.length} alert(s)`);
    alerts.forEach((a) =>
      console.log(`   ${a.brand} ${a.model} : ${fmtEurSimple(a.old_price)} → ${fmtEurSimple(a.new_price)}`),
    );
    return true;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    console.error("[cron/scrape] price-drop Resend failed:", res.status);
    return false;
  }
  return true;
}

async function sendGoneEmail(to: string, alerts: ListingGoneAlert[]): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "VO Radar <alertes@vo-radar.app>";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const subject = `[VO Radar] ${alerts.length} annonce${alerts.length > 1 ? "s" : ""} disparue${alerts.length > 1 ? "s" : ""} de votre suivi`;

  const items = alerts
    .map(
      (a) =>
        `<tr>
          <td style="padding:12px 16px;border-bottom:1px solid #eee;">
            <div style="font-weight:600;color:#111;">${escHtml(a.brand)} ${escHtml(a.model)}</div>
          </td>
          <td style="padding:12px 16px;text-align:right;border-bottom:1px solid #eee;color:#666;">
            ${fmtEurSimple(a.price_eur)}
          </td>
        </tr>`
    )
    .join("");

  const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f6f7;margin:0;padding:24px;">
  <table cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:24px 24px 0;">
      <h1 style="margin:0;font-size:22px;color:#111;">${alerts.length} annonce${alerts.length > 1 ? "s" : ""} disparue${alerts.length > 1 ? "s" : ""}</h1>
      <p style="color:#666;margin-top:8px;font-size:14px;">Ces véhicules de votre suivi ne sont plus disponibles depuis plus de 48h.</p>
    </td></tr>
    <tr><td style="padding:16px 8px;"><table cellpadding="0" cellspacing="0" width="100%">${items}</table></td></tr>
    <tr><td style="padding:24px;background:#fafafa;color:#888;font-size:12px;text-align:center;">VO Radar — <a href="${appUrl}/pipeline" style="color:#888;">Voir mon pipeline</a></td></tr>
  </table>
</body></html>`;

  if (!key) {
    console.log(`\n[listing-gone demo] to=${to} — ${alerts.length} alert(s)`);
    alerts.forEach((a) =>
      console.log(`   ${a.brand} ${a.model} : ${fmtEurSimple(a.price_eur)}`),
    );
    return true;
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html }),
  });
  if (!res.ok) {
    console.error("[cron/scrape] listing-gone Resend failed:", res.status);
    return false;
  }
  return true;
}

function fmtEurSimple(eur: number): string {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(eur);
}

function escHtml(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}
