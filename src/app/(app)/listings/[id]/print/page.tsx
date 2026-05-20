import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { getListing, getPriceHistory, getGarageSettings, getSellerActivity } from "@/lib/db";
import { computeMargin, estimateReconditioning } from "@/lib/margin";
import { computeProPrice } from "@/lib/pricing-pro";
import { estimateLiquidity } from "@/lib/liquidity";
import { fmtEUR, fmtKm, fmtDate } from "@/lib/utils";

export default async function PrintPage(props: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await props.params;
  const listing = await getListing(id);
  if (!listing) notFound();

  const [profile, seller, history] = await Promise.all([
    getGarageSettings(user.id),
    getSellerActivity(id),
    getPriceHistory(id),
  ]);

  const recon = estimateReconditioning(listing, profile);
  const margin = computeMargin(listing, profile, recon);
  const pricing = await computeProPrice({
    brand: listing.brand, model: listing.model, year: listing.year,
    mileage_km: listing.mileage_km, fuel: listing.fuel, gearbox: listing.gearbox,
    power_hp: listing.power_hp, body_type: listing.body_type,
    price_eur: listing.price_eur, title: listing.title, version: listing.version,
    engine_designation: listing.engine_designation, excludeId: listing.id,
  });
  const liq = estimateLiquidity(listing);

  const now = new Date().toLocaleDateString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <html lang="fr">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>Fiche VO — {listing.brand} {listing.model} {listing.year}</title>
        <style>{`
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 13px; color: #1a1a1a; background: white; line-height: 1.5; }
          .page { max-width: 800px; margin: 0 auto; padding: 24px; }
          h1 { font-size: 22px; font-weight: 700; }
          h2 { font-size: 13px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: #666; margin-bottom: 8px; }
          .header { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 2px solid #e5e5e5; padding-bottom: 16px; margin-bottom: 20px; }
          .badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 600; }
          .badge-green { background: #dcfce7; color: #15803d; }
          .badge-lime { background: #f7fee7; color: #4d7c0f; }
          .badge-amber { background: #fef9c3; color: #854d0e; }
          .badge-red { background: #fee2e2; color: #b91c1c; }
          .badge-gray { background: #f3f4f6; color: #374151; }
          .section { margin-bottom: 20px; }
          .grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
          .grid3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; }
          .grid4 { display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 8px; }
          .card { border: 1px solid #e5e5e5; border-radius: 8px; padding: 12px; }
          .card-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.06em; color: #9ca3af; margin-bottom: 3px; }
          .card-value { font-size: 18px; font-weight: 700; color: #111; }
          .card-sub { font-size: 11px; color: #9ca3af; margin-top: 2px; }
          .spec-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px solid #f3f4f6; font-size: 12px; }
          .spec-row:last-child { border-bottom: none; }
          .spec-label { color: #6b7280; }
          .spec-value { font-weight: 600; }
          .margin-box { border: 2px solid #e5e5e5; border-radius: 8px; padding: 14px; }
          .margin-box.good { border-color: #86efac; background: #f0fdf4; }
          .margin-box.bad { border-color: #fca5a5; background: #fef2f2; }
          .cost-row { display: flex; justify-content: space-between; padding: 3px 0; font-size: 12px; }
          .cost-row.total { font-weight: 700; border-top: 1px solid #e5e5e5; padding-top: 6px; margin-top: 4px; }
          .text-green { color: #16a34a; }
          .text-red { color: #dc2626; }
          .text-amber { color: #d97706; }
          .text-muted { color: #9ca3af; }
          .footer { border-top: 1px solid #e5e5e5; padding-top: 12px; font-size: 11px; color: #9ca3af; display: flex; justify-content: space-between; }
          .btn-print { display: inline-flex; align-items: center; gap: 8px; background: #111; color: white; border: none; padding: 10px 20px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; margin-bottom: 20px; }
          .btn-print:hover { background: #333; }
          @media print {
            .no-print { display: none !important; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            .page { padding: 0; }
          }
          .seller-alert { background: #fffbeb; border: 1px solid #fbbf24; border-radius: 6px; padding: 8px 12px; font-size: 12px; color: #92400e; }
        `}</style>
      </head>
      <body>
        <div className="page">
          {/* Print button — hidden on print */}
          <div className="no-print" style={{ marginBottom: 16 }}>
            <button className="btn-print" onClick={() => window.print()}>🖨 Imprimer / Enregistrer en PDF</button>
            <span style={{ marginLeft: 12, fontSize: 12, color: "#999" }}>Fiche générée le {now}</span>
          </div>

          {/* Header */}
          <div className="header">
            <div>
              <h1>{listing.brand} {listing.model} {listing.year}</h1>
              <div style={{ marginTop: 4, color: "#666", fontSize: 13 }}>{listing.version}</div>
              {listing.engine_designation && <div style={{ fontSize: 12, color: "#999" }}>{listing.engine_designation}</div>}
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 28, fontWeight: 700 }}>{fmtEUR(listing.price_eur)}</div>
              <div style={{ fontSize: 12, color: "#666" }}>Cote estimée : {fmtEUR(listing.market_value_eur)}</div>
              <div style={{ marginTop: 6, display: "flex", gap: 6, justifyContent: "flex-end", flexWrap: "wrap" }}>
                <span className={`badge ${
                  listing.score >= 85 ? "badge-green" :
                  listing.score >= 70 ? "badge-lime" :
                  listing.score >= 50 ? "badge-amber" : "badge-red"
                }`}>Score {listing.score}/100</span>
                <span className={`badge ${
                  liq.tier === "fast" ? "badge-green" :
                  liq.tier === "normal" ? "badge-lime" :
                  liq.tier === "slow" ? "badge-amber" : "badge-red"
                }`}>{liq.label} ~{liq.days_estimate}j</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 11, color: "#999" }}>Publiée {fmtDate(listing.posted_at)} · {listing.source}</div>
            </div>
          </div>

          {/* Seller alert */}
          {(seller.price_changes > 0 || seller.days_on_market > 30) && (
            <div className="seller-alert" style={{ marginBottom: 16 }}>
              {seller.price_changes > 0 && <span>⚡ Prix baissé {seller.price_changes}× depuis la mise en ligne — vendeur motivé. </span>}
              {seller.days_on_market > 30 && <span>⏱ En ligne depuis {seller.days_on_market} jours — marge de négociation probable. </span>}
            </div>
          )}

          {/* Specs + Pricing */}
          <div className="grid2 section">
            <div>
              <h2>Caractéristiques</h2>
              <div className="card" style={{ padding: 0 }}>
                {[
                  ["Kilométrage", fmtKm(listing.mileage_km)],
                  ["Carburant", listing.fuel],
                  ["Boîte", listing.gearbox],
                  ["Puissance", listing.power_hp ? `${listing.power_hp} ch` : "—"],
                  ["Carrosserie", listing.body_type],
                  ["Vendeur", listing.seller_kind],
                  listing.region ? ["Région", listing.region] : null,
                  listing.postal_code ? ["Code postal", listing.postal_code] : null,
                ].filter((r): r is [string, string] => Boolean(r)).map(([k, v]) => (
                  <div key={k} className="spec-row" style={{ padding: "6px 12px" }}>
                    <span className="spec-label">{k}</span>
                    <span className="spec-value capitalize">{v}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h2>Analyse pricing</h2>
              <div className="grid2" style={{ marginBottom: 8 }}>
                <div className="card">
                  <div className="card-label">Prix juste estimé</div>
                  <div className="card-value" style={{ fontSize: 16 }}>{fmtEUR(pricing.fair_price_eur)}</div>
                  <div className="card-sub">P25 {fmtEUR(pricing.p25_eur)} – P75 {fmtEUR(pricing.p75_eur)}</div>
                </div>
                <div className="card">
                  <div className="card-label">Écart vs prix juste</div>
                  <div className={`card-value ${listing.delta_eur < 0 ? "text-green" : "text-red"}`} style={{ fontSize: 16 }}>
                    {listing.delta_eur > 0 ? "+" : ""}{fmtEUR(listing.delta_eur)}
                  </div>
                  <div className="card-sub">{listing.delta_pct}% vs cote</div>
                </div>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>{pricing.confidence_label}</div>
              {pricing.options.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>Options détectées :</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {pricing.options.map((o) => (
                      <span key={o.key} className="badge badge-gray" style={{ fontSize: 10 }}>
                        {o.label} +{fmtEUR(o.delta_eur)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Engine + Crit'Air */}
          <div className="grid2 section">
            <div>
              <h2>Fiabilité moteur</h2>
              <div className={`card ${
                listing.engine_rating === "excellent" || listing.engine_rating === "good" ? "good" :
                listing.engine_rating === "risky" || listing.engine_rating === "avoid" ? "bad" : ""
              }`}>
                <span className={`badge ${
                  listing.engine_rating === "excellent" ? "badge-green" :
                  listing.engine_rating === "good" ? "badge-lime" :
                  listing.engine_rating === "risky" ? "badge-amber" :
                  listing.engine_rating === "avoid" ? "badge-red" : "badge-gray"
                }`}>{listing.engine_rating}</span>
                {listing.engine_designation && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#374151" }}>{listing.engine_designation}</div>
                )}
              </div>
            </div>
            <div>
              <h2>Crit&apos;Air / ZFE</h2>
              <div className="card">
                <div style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>
                  {listing.critair === 0 ? "⚡ Électrique" :
                   listing.critair === -1 ? "Non classé" :
                   `Crit'Air ${listing.critair}`}
                </div>
                <div style={{ fontSize: 11, color: listing.critair >= 3 ? "#b91c1c" : "#4d7c0f" }}>
                  {listing.critair >= 3 ? "⚠ Restrictions ZFE Paris/IDF depuis 2025" :
                   listing.critair === 2 ? "Autorisé ZFE actuellement" :
                   listing.critair <= 1 ? "✓ Aucune restriction ZFE" : ""}
                </div>
              </div>
            </div>
          </div>

          {/* Margin calculation */}
          <div className="section">
            <h2>Calcul de marge</h2>
            <div className={`margin-box ${margin.meets_target ? "good" : "bad"}`}>
              <div className="grid4" style={{ marginBottom: 14 }}>
                <div>
                  <div className="card-label">Prix achat</div>
                  <div className="card-value" style={{ fontSize: 15 }}>{fmtEUR(margin.buy_price_eur)}</div>
                </div>
                <div>
                  <div className="card-label">Prix de revient</div>
                  <div className="card-value" style={{ fontSize: 15 }}>{fmtEUR(margin.revient_eur)}</div>
                </div>
                <div>
                  <div className="card-label">Prix de vente estimé</div>
                  <div className="card-value" style={{ fontSize: 15 }}>{fmtEUR(margin.sell_price_eur)}</div>
                </div>
                <div>
                  <div className="card-label">Marge brute</div>
                  <div className={`card-value ${margin.gross_margin_eur >= 0 ? "text-green" : "text-red"}`} style={{ fontSize: 15 }}>
                    {margin.gross_margin_eur >= 0 ? "+" : ""}{fmtEUR(margin.gross_margin_eur)}
                  </div>
                </div>
              </div>
              <div className="grid2">
                <div>
                  {[
                    ["Transport", fmtEUR(margin.transport_eur)],
                    ["Reconditionnement estimé", fmtEUR(margin.recon_est_eur)],
                    ["Prépa + CT", fmtEUR(margin.prep_ct_eur)],
                    ["Frais fixes", fmtEUR(margin.fixed_costs_eur)],
                    ["Total coûts", fmtEUR(margin.total_costs_eur)],
                  ].map(([k, v], i) => (
                    <div key={k} className={`cost-row ${i === 4 ? "total" : ""}`}>
                      <span className={i === 4 ? "" : "text-muted"}>{k}</span>
                      <span>{v}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", justifyContent: "flex-end" }}>
                  <div style={{ borderLeft: "2px solid #e5e5e5", paddingLeft: 16 }}>
                    <div className="card-label">Prix d&apos;achat maximum</div>
                    <div className={`card-value ${margin.meets_target ? "text-green" : "text-red"}`} style={{ fontSize: 22 }}>
                      {fmtEUR(margin.max_buy_price_eur)}
                    </div>
                    <div style={{ fontSize: 11, marginTop: 4, color: "#6b7280" }}>
                      pour atteindre {fmtEUR(profile.target_margin_eur)} de marge cible
                    </div>
                    <div style={{ marginTop: 8 }}>
                      <span className={`badge ${margin.meets_target ? "badge-green" : "badge-red"}`}>
                        {margin.verdict_label}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Price history */}
          {history.length > 1 && (
            <div className="section">
              <h2>Historique de prix</h2>
              <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                {history.map((h, i) => (
                  <div key={i} style={{ fontSize: 12, color: "#374151" }}>
                    <span style={{ color: "#9ca3af" }}>{fmtDate(h.observed_at)}</span>
                    {" "}<strong>{fmtEUR(h.price_eur)}</strong>
                    {i > 0 && (
                      <span className={history[i].price_eur < history[i - 1].price_eur ? "text-green" : "text-red"} style={{ marginLeft: 4, fontSize: 11 }}>
                        {history[i].price_eur < history[i - 1].price_eur ? "▼" : "▲"}
                        {fmtEUR(Math.abs(history[i].price_eur - history[i - 1].price_eur))}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="footer">
            <span>VO Radar · {user.dealership_name}</span>
            <span>Fiche générée le {now} · {listing.url ? <a href={listing.url} style={{ color: "#3b82f6" }}>Voir l&apos;annonce originale</a> : listing.source}</span>
          </div>
        </div>
        <script dangerouslySetInnerHTML={{ __html: `
          document.querySelector('.btn-print')?.addEventListener('click', () => window.print());
        `}} />
      </body>
    </html>
  );
}
