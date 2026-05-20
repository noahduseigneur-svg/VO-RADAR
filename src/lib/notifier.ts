import type { Listing, AlertRule } from "./types";
import { fmtEUR, fmtKm } from "./utils";

interface AlertEmail {
  to: string;
  dealershipName: string;
  ruleName: string;
  listings: Listing[];
}

export async function sendAlertEmail(payload: AlertEmail): Promise<{ ok: boolean; channel: "resend" | "console"; messageId?: string }> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM ?? "VO Radar <alertes@vo-radar.app>";

  const html = renderEmailHtml(payload);
  const text = renderEmailText(payload);
  const subject = `[VO Radar] ${payload.listings.length} nouvelle${payload.listings.length > 1 ? "s" : ""} opportunité${payload.listings.length > 1 ? "s" : ""} sur « ${payload.ruleName} »`;

  if (!key) {
    console.log(`\n📧 [demo email — no RESEND_API_KEY] to=${payload.to}`);
    console.log(`   subject: ${subject}`);
    console.log(`   ${payload.listings.length} listing(s)\n`);
    return { ok: true, channel: "console" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to: payload.to, subject, html, text }),
  });
  if (!res.ok) {
    console.error("Resend send failed:", res.status, await res.text());
    return { ok: false, channel: "resend" };
  }
  const data = (await res.json()) as { id?: string };
  return { ok: true, channel: "resend", messageId: data.id };
}

function renderEmailHtml(p: AlertEmail): string {
  const items = p.listings
    .map(
      (l) => `
      <tr>
        <td style="padding:12px 16px;border-bottom:1px solid #eee;">
          <div style="font-weight:600;color:#111;">${escape(l.brand)} ${escape(l.model)}</div>
          <div style="color:#666;font-size:13px;margin-top:2px;">${escape(l.version ?? "")} · ${l.year} · ${fmtKm(l.mileage_km)} · ${l.fuel}</div>
        </td>
        <td style="padding:12px 16px;text-align:right;border-bottom:1px solid #eee;">
          <div style="font-weight:600;color:#111;">${fmtEUR(l.price_eur)}</div>
          <div style="color:${l.delta_eur > 0 ? "#0a7a3f" : "#a03030"};font-size:12px;">${l.delta_eur > 0 ? "+" : ""}${fmtEUR(l.delta_eur)} vs cote</div>
          <div style="font-size:11px;color:#888;">Score ${l.score}/100</div>
        </td>
        <td style="padding:12px 16px;text-align:right;border-bottom:1px solid #eee;">
          <a href="${escape(l.url)}" style="background:#e11d48;color:#fff;padding:8px 14px;border-radius:6px;text-decoration:none;font-size:13px;">Voir</a>
        </td>
      </tr>`
    )
    .join("");

  return `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f6f7;margin:0;padding:24px;">
  <table cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:24px 24px 0;">
      <h1 style="margin:0;font-size:22px;color:#111;">${p.listings.length} opportunité${p.listings.length > 1 ? "s" : ""} sur « ${escape(p.ruleName)} »</h1>
      <p style="color:#666;margin-top:8px;font-size:14px;">Bonjour ${escape(p.dealershipName)}, vos alertes ont matché ${p.listings.length} nouvelle${p.listings.length > 1 ? "s" : ""} annonce${p.listings.length > 1 ? "s" : ""}.</p>
    </td></tr>
    <tr><td style="padding:16px 8px;"><table cellpadding="0" cellspacing="0" width="100%">${items}</table></td></tr>
    <tr><td style="padding:24px;background:#fafafa;color:#888;font-size:12px;text-align:center;">VO Radar — pour gérer vos alertes, connectez-vous à votre tableau de bord.</td></tr>
  </table>
</body></html>`;
}

function renderEmailText(p: AlertEmail): string {
  const lines = p.listings.map((l) => `- ${l.brand} ${l.model} (${l.year}, ${fmtKm(l.mileage_km)}) : ${fmtEUR(l.price_eur)} | score ${l.score} | ${l.url}`).join("\n");
  return `${p.listings.length} opportunité(s) sur « ${p.ruleName} »\n\n${lines}\n\n— VO Radar`;
}

function escape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

// Helper used by the scraper after upsert
export function buildEmailPayload(user: { email: string; dealership_name: string }, rule: AlertRule, listings: Listing[]): AlertEmail {
  return {
    to: user.email,
    dealershipName: user.dealership_name,
    ruleName: rule.name,
    listings,
  };
}
