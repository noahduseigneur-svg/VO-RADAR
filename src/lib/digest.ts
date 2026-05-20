import { listDigestUsers, getTopListingsSince, matchListingsForRule, listAlerts } from "./db";
import type { Listing, User } from "./types";
import { fmtEUR, fmtKm } from "./utils";
import { estimateLiquidity } from "./liquidity";

export interface DigestResult {
  emails_sent: number;
  emails_skipped: number;
  users_processed: number;
}

export async function sendDailyDigests(sinceHours = 24): Promise<DigestResult> {
  const since = new Date(Date.now() - sinceHours * 3600_000).toISOString();
  const users = await listDigestUsers();

  let sent = 0;
  let skipped = 0;

  for (const user of users) {
    const listings = await buildDigestListings(user.id, since);
    if (listings.length === 0) { skipped++; continue; }

    const result = await sendDigestEmail({ user, listings, sinceHours });
    if (result.ok) sent++;
    else skipped++;
  }

  return { emails_sent: sent, emails_skipped: skipped, users_processed: users.length };
}

async function buildDigestListings(userId: string, since: string): Promise<Listing[]> {
  const top = await getTopListingsSince(since, 12);
  if (top.length > 0) return top;

  const alerts = await listAlerts(userId);
  if (alerts.length === 0) return [];
  return matchListingsForRule(alerts[0], 8);
}

interface DigestPayload {
  user: User;
  listings: Listing[];
  sinceHours: number;
}

async function sendDigestEmail(payload: DigestPayload): Promise<{ ok: boolean }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "VO Radar <digest@vo-radar.app>";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  const html = renderDigestHtml(payload, appUrl);
  const subject = `🔍 VO Radar — ${payload.listings.length} opportunité${payload.listings.length > 1 ? "s" : ""} du jour`;

  if (!key) {
    console.log(`\n📧 [digest demo] to=${payload.user.email} — ${payload.listings.length} listings`);
    payload.listings.slice(0, 3).forEach((l) =>
      console.log(`   ${l.brand} ${l.model} ${l.year} | ${fmtEUR(l.price_eur)} | score ${l.score}`),
    );
    return { ok: true };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: payload.user.email, subject, html }),
  });
  if (!res.ok) {
    console.error("[digest] Resend failed:", res.status);
    return { ok: false };
  }
  return { ok: true };
}

function scoreColor(score: number): string {
  if (score >= 85) return "#16a34a";
  if (score >= 70) return "#4d7c0f";
  if (score >= 50) return "#d97706";
  return "#dc2626";
}

function scoreLabel(score: number): string {
  if (score >= 85) return "Pépite";
  if (score >= 70) return "Bonne affaire";
  if (score >= 50) return "Correct";
  return "Surcôté";
}

function escape(s: string): string {
  return String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function renderDigestHtml(p: DigestPayload, appUrl: string): string {
  const cards = p.listings.map((l) => {
    const liq = estimateLiquidity(l);
    const deltaPositive = l.delta_eur > 0;
    const liqColor = liq.tier === "fast" ? "#16a34a" : liq.tier === "normal" ? "#4d7c0f" : liq.tier === "slow" ? "#d97706" : "#dc2626";

    return `
    <table cellpadding="0" cellspacing="0" width="100%" style="margin-bottom:12px;border:1px solid #e5e5e5;border-radius:10px;overflow:hidden;background:#fff;">
      <tr>
        <td style="padding:16px;">
          <!-- Header row -->
          <table cellpadding="0" cellspacing="0" width="100%">
            <tr>
              <td>
                <div style="font-size:16px;font-weight:700;color:#111;">${escape(l.brand)} ${escape(l.model)} <span style="color:#666;font-weight:400;">${l.year}</span></div>
                <div style="font-size:13px;color:#666;margin-top:3px;">${escape(l.version ?? "")} · ${fmtKm(l.mileage_km)} · ${l.fuel}</div>
              </td>
              <td style="text-align:right;white-space:nowrap;">
                <span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${scoreColor(l.score)}22;color:${scoreColor(l.score)};font-size:12px;font-weight:600;">${scoreLabel(l.score)} ${l.score}</span>
              </td>
            </tr>
          </table>
          <!-- Price row -->
          <table cellpadding="0" cellspacing="0" width="100%" style="margin-top:12px;">
            <tr>
              <td style="width:33%;text-align:center;border-right:1px solid #f0f0f0;">
                <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Prix</div>
                <div style="font-size:20px;font-weight:700;color:#111;margin-top:2px;">${fmtEUR(l.price_eur)}</div>
              </td>
              <td style="width:33%;text-align:center;border-right:1px solid #f0f0f0;">
                <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">vs Cote</div>
                <div style="font-size:18px;font-weight:700;color:${deltaPositive ? "#16a34a" : "#dc2626"};margin-top:2px;">${deltaPositive ? "+" : ""}${fmtEUR(l.delta_eur)}</div>
                <div style="font-size:11px;color:#9ca3af;">${l.delta_pct}%</div>
              </td>
              <td style="width:33%;text-align:center;">
                <div style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:0.05em;">Liquidité</div>
                <div style="font-size:14px;font-weight:600;color:${liqColor};margin-top:2px;">${liq.label}</div>
                <div style="font-size:11px;color:#9ca3af;">~${liq.days_estimate} jours</div>
              </td>
            </tr>
          </table>
          <!-- CTA -->
          <div style="margin-top:14px;">
            <a href="${appUrl}/listings/${l.id}" style="display:inline-block;background:#e11d48;color:#fff;padding:9px 20px;border-radius:7px;text-decoration:none;font-size:13px;font-weight:600;">
              Voir l'annonce →
            </a>
            ${l.engine_rating === "avoid" ? '<span style="margin-left:10px;font-size:12px;color:#dc2626;">⛔ Moteur à risque</span>' :
              l.engine_rating === "risky" ? '<span style="margin-left:10px;font-size:12px;color:#d97706;">⚠ Moteur risqué</span>' : ""}
          </div>
        </td>
      </tr>
    </table>`;
  }).join("");

  const today = new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });

  return `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f6f6f7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table cellpadding="0" cellspacing="0" width="100%" style="background:#f6f6f7;padding:24px 16px;">
    <tr><td align="center">
      <table cellpadding="0" cellspacing="0" width="600" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#e11d48;border-radius:12px 12px 0 0;padding:24px 28px;">
          <div style="color:#fff;font-size:22px;font-weight:800;">VO Radar</div>
          <div style="color:rgba(255,255,255,0.8);font-size:14px;margin-top:4px;">Digest du ${today}</div>
        </td></tr>

        <!-- Intro -->
        <tr><td style="background:#fff;padding:20px 28px 8px;">
          <p style="margin:0;font-size:15px;color:#374151;">
            Bonjour <strong>${escape(p.user.dealership_name)}</strong>,
            voici les <strong>${p.listings.length} meilleures opportunités</strong>
            détectées ces dernières ${p.sinceHours} heures.
          </p>
        </td></tr>

        <!-- Listings -->
        <tr><td style="background:#fff;padding:12px 28px 20px;">
          ${cards}
        </td></tr>

        <!-- CTA global -->
        <tr><td style="background:#fff;padding:0 28px 28px;text-align:center;">
          <a href="${appUrl}/listings" style="display:inline-block;background:#111;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-size:14px;font-weight:600;">
            Voir toutes les annonces →
          </a>
        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#f3f4f6;border-radius:0 0 12px 12px;padding:16px 28px;text-align:center;font-size:12px;color:#9ca3af;">
          VO Radar · <a href="${appUrl}/settings" style="color:#9ca3af;">Gérer mes préférences</a>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
