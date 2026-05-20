import Link from "next/link";
import { Calculator, ChevronRight, Sparkles, Target, TrendingUp } from "lucide-react";
import type { Listing } from "@/lib/types";
import { computeProPrice } from "@/lib/pricing-pro";
import { fmtEUR, fmtKm } from "@/lib/utils";

export async function PricingProPanel({ listing }: { listing: Listing }) {
  const result = await computeProPrice({
    brand: listing.brand, model: listing.model, year: listing.year,
    mileage_km: listing.mileage_km, fuel: listing.fuel, gearbox: listing.gearbox,
    power_hp: listing.power_hp, body_type: listing.body_type,
    price_eur: listing.price_eur, title: listing.title, version: listing.version,
    engine_designation: listing.engine_designation, excludeId: listing.id,
  });

  const dealRoom = listing.price_eur - result.fair_price_eur;
  const dealPct = result.fair_price_eur > 0 ? (dealRoom / result.fair_price_eur) * 100 : 0;
  const verdict = dealPct <= -10 ? "excellent" : dealPct <= -3 ? "good" : dealPct <= 5 ? "fair" : "overpriced";

  const verdictMeta = {
    excellent: { label: "Excellente affaire", cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/40" },
    good:      { label: "Bon prix",            cls: "bg-lime-500/15 text-lime-300 ring-lime-500/40" },
    fair:      { label: "Prix correct",        cls: "bg-amber-500/15 text-amber-300 ring-amber-500/40" },
    overpriced:{ label: "Surcôté",             cls: "bg-rose-500/15 text-rose-300 ring-rose-500/40" },
  }[verdict];

  const conf = {
    calibrated_knn: { stars: 4, label: "Confiance élevée (vrais comparables)" },
    calibrated_anchor: { stars: 3, label: "Confiance moyenne" },
    anchor_only: { stars: 2, label: "Cote modèle interne" },
    fallback: { stars: 1, label: "Cote estimée (modèle non calibré)" },
  }[result.confidence];

  return (
    <section className="rounded-xl border border-rose-500/30 bg-gradient-to-br from-rose-500/[0.06] to-transparent p-6">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-semibold">
            <Target size={16} className="text-rose-400" />
            Analyse pricing pro
          </h2>
          <p className="mt-0.5 text-xs text-neutral-400">{result.confidence_label}</p>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${verdictMeta.cls}`}>
          <Sparkles size={11} /> {verdictMeta.label}
        </span>
      </header>

      <div className="mb-4 grid gap-3 sm:grid-cols-3">
        <PriceCard label="Prix vendeur" value={fmtEUR(listing.price_eur)} muted />
        <PriceCard
          label="Prix juste estimé"
          value={fmtEUR(result.fair_price_eur)}
          highlight
          sub={`P25 ${fmtEUR(result.p25_eur)} — P75 ${fmtEUR(result.p75_eur)}`}
        />
        <PriceCard
          label="Marge / écart"
          value={`${dealRoom > 0 ? "+" : ""}${fmtEUR(dealRoom)}`}
          accent={dealRoom < 0 ? "emerald" : "rose"}
          sub={`${dealPct > 0 ? "+" : ""}${dealPct.toFixed(1)}% vs prix juste`}
        />
      </div>

      <ConfidenceBar stars={conf.stars} label={conf.label} />

      {result.options.length > 0 && (
        <div className="mt-4 rounded-lg bg-[var(--card)] p-3">
          <div className="mb-2 text-xs uppercase tracking-wide text-neutral-400">
            Options & finitions détectées (+{fmtEUR(result.options_delta_eur)})
          </div>
          <div className="flex flex-wrap gap-1.5">
            {result.options.map((o) => (
              <span key={o.key} className="rounded-full bg-[var(--background)] px-2 py-0.5 text-[11px] text-neutral-300">
                {o.label} <span className="ml-0.5 text-rose-400">+{fmtEUR(o.delta_eur)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {result.seasonal_reason && (
        <div className="mt-3 flex items-center gap-2 text-xs text-neutral-400">
          <TrendingUp size={12} />
          <span>{result.seasonal_reason}</span>
        </div>
      )}

      <details className="mt-4">
        <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-200">
          <Calculator size={11} className="mr-1 inline" /> Voir la décomposition complète
        </summary>
        <div className="mt-2 space-y-1.5 rounded-lg bg-[var(--card)] p-3 text-xs">
          {result.breakdown.map((b, i) => (
            <div key={i} className="flex items-center justify-between">
              <span className="text-neutral-400">{b.label}</span>
              <span className="font-mono tabular-nums">{fmtEUR(b.delta_eur)}</span>
            </div>
          ))}
        </div>
      </details>

      {result.knn && result.knn.neighbors.length > 0 && (
        <details className="mt-3">
          <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-200">
            {result.knn.k} comparables réels (k-NN) — voir le détail
          </summary>
          <ul className="mt-2 space-y-1 rounded-lg bg-[var(--card)] p-2 text-xs">
            {result.knn.neighbors.slice(0, 6).map((n) => (
              <li key={n.listing.id}>
                <Link href={`/listings/${n.listing.id}`} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-[var(--background)]">
                  <span className="truncate text-neutral-300">
                    {n.listing.brand} {n.listing.model} {n.listing.year} · {fmtKm(n.listing.mileage_km)}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="font-mono tabular-nums">{fmtEUR(n.listing.price_eur)}</span>
                    <span className="text-[10px] text-neutral-500">sim. {(n.similarity * 100).toFixed(0)}%</span>
                    <ChevronRight size={11} className="text-neutral-500" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function PriceCard({ label, value, sub, accent, highlight, muted }: {
  label: string;
  value: string;
  sub?: string;
  accent?: "emerald" | "rose";
  highlight?: boolean;
  muted?: boolean;
}) {
  const accentCls = accent === "emerald" ? "text-emerald-300"
    : accent === "rose" ? "text-rose-300"
    : highlight ? "text-white"
    : muted ? "text-neutral-300"
    : "text-neutral-200";
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-rose-500/10 ring-1 ring-rose-500/30" : "bg-[var(--card)]"}`}>
      <div className="text-[11px] uppercase tracking-wide text-neutral-400">{label}</div>
      <div className={`mt-0.5 text-2xl font-semibold tabular-nums ${accentCls}`}>{value}</div>
      {sub && <div className="mt-0.5 text-[11px] text-neutral-500">{sub}</div>}
    </div>
  );
}

function ConfidenceBar({ stars, label }: { stars: number; label: string }) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex gap-0.5">
        {[1, 2, 3, 4].map((i) => (
          <span key={i} className={`h-1.5 w-6 rounded-full ${i <= stars ? "bg-rose-500" : "bg-neutral-800"}`} />
        ))}
      </div>
      <span className="text-xs text-neutral-400">{label}</span>
    </div>
  );
}
