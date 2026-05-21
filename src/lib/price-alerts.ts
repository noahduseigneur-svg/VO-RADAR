/**
 * Email helpers for price drop alerts and "listing gone" notifications.
 * Uses the same Resend pattern as notifier.ts.
 */
import { fmtEUR } from "./utils";
import type { PriceDropAlert, ListingGoneAlert } from "./db";

const FROM = process.env.RESEND_FROM ?? "VO Radar <alertes@vo-radar.app>";

async function sendEmail(to: string, subject: string, html: string, text: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`📧 [demo — no RESEND] to=${to} subject=${subject}`);
    return true;
  }
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to, subject, html, text }),
  });
  return res.ok;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

// ─── Price drop alert ────────────────────────────────────────────────────────

export async function sendPriceDropBatch(
  email: string,
  drops: PriceDropAlert[]
): Promise<boolean> {
  const subject = `[VO Radar] ${drops.length} baisse${drops.length > 1 ? "s" : ""} de prix sur vos annonces suivies`;

  const rows = drops.map((d) => {
    const diff = d.new_price - d.old_price;
    return `<tr>
      <td style="padding:10px 16px;border-bottom:1px solid #eee;">
        <div style="font-weight:600;color:#111;">${esc(d.brand)} ${esc(d.model)}</div>
      </td>
      <td style="padding:10px 16px;text-align:right;border-bottom:1px solid #eee;">
        <span style="text-decoration:line-through;color:#999;">${fmtEUR(d.old_price)}</span>
        → <strong style="color:#111;">${fmtEUR(d.new_price)}</strong>
        <div style="color:#0a7a3f;font-size:12px;">${fmtEUR(diff)} (${Math.round((diff / d.old_price) * 100)}%)</div>
      </td>
      <td style="padding:10px 16px;text-align:right;border-bottom:1px solid #eee;">
        <a href="${esc(d.url)}" style="background:#e11d48;color:#fff;padding:6px 12px;border-radius:6px;text-decoration:none;font-size:13px;">Voir</a>
      </td>
    </tr>`;
  }).join("");

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f6f7;margin:0;padding:24px;">
  <table cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:24px 24px 0;"><h1 style="margin:0;font-size:22px;color:#111;">📉 Baisse${drops.length > 1 ? "s" : ""} de prix</h1>
      <p style="color:#666;font-size:14px;">Des annonces que vous suivez viennent de baisser de prix.</p>
    </td></tr>
    <tr><td style="padding:16px 8px;"><table cellpadding="0" cellspacing="0" width="100%">${rows}</table></td></tr>
    <tr><td style="padding:24px;background:#fafafa;color:#888;font-size:12px;text-align:center;">VO Radar</td></tr>
  </table></body></html>`;

  const text = drops.map((d) => `${d.brand} ${d.model}: ${fmtEUR(d.old_price)} → ${fmtEUR(d.new_price)} | ${d.url}`).join("\n");

  return sendEmail(email, subject, html, text);
}

// ─── Listing gone alert ──────────────────────────────────────────────────────

export async function sendListingGoneBatch(
  email: string,
  gone: ListingGoneAlert[]
): Promise<boolean> {
  const subject = `[VO Radar] ${gone.length} annonce${gone.length > 1 ? "s" : ""} de votre liste semble${gone.length > 1 ? "nt" : ""} vendue${gone.length > 1 ? "s" : ""}`;

  const items = gone.map((g) => `<li style="padding:4px 0;">${esc(g.brand)} ${esc(g.model)} — ${fmtEUR(g.price_eur)}</li>`).join("");

  const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f6f6f7;margin:0;padding:24px;">
  <table cellpadding="0" cellspacing="0" width="100%" style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;">
    <tr><td style="padding:24px;"><h1 style="margin:0 0 12px;font-size:22px;color:#111;">🔴 Annonces peut-être vendues</h1>
      <p style="color:#666;font-size:14px;">Ces annonces n'ont pas été vues depuis plus de 48h — elles sont peut-être vendues :</p>
      <ul style="margin:16px 0;padding-left:20px;color:#111;">${items}</ul>
      <p style="color:#666;font-size:13px;">Connectez-vous à votre pipeline pour mettre à jour leur statut.</p>
    </td></tr>
    <tr><td style="padding:16px 24px;background:#fafafa;color:#888;font-size:12px;text-align:center;">VO Radar</td></tr>
  </table></body></html>`;

  const text = gone.map((g) => `${g.brand} ${g.model} — ${fmtEUR(g.price_eur)}`).join("\n");

  return sendEmail(email, subject, html, text);
}
