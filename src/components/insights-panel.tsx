import Link from "next/link";
import { AlertCircle, AlertTriangle, CheckCircle, Info, Search, TrendingDown, TrendingUp, Zap } from "lucide-react";
import type { Listing } from "@/lib/types";
import { identifyEngine } from "@/lib/reliability";
import { evaluateCritAir } from "@/lib/critair";
import { bodyTrend } from "@/lib/bodywork";
import { assessMileage, findComparables } from "@/lib/comparables";
import { scoreListingFull } from "@/lib/scoring";
import { estimateMarketValueDetailed } from "@/lib/pricing";
import { fmtEUR, fmtKm } from "@/lib/utils";

export async function InsightsPanel({ listing }: { listing: Listing }) {
  // Recompute everything fresh for the detail panel — gives us full breakdown
  const eng = identifyEngine(listing.brand, listing.model, listing.version, listing.engine_designation);
  const zfe = evaluateCritAir(listing.fuel, listing.year);
  const trend = bodyTrend(listing.body_type, listing.fuel);
  const km = assessMileage(listing.year, listing.mileage_km);
  const comp = await findComparables({
    brand: listing.brand, model: listing.model, year: listing.year,
    mileage_km: listing.mileage_km, fuel: listing.fuel, excludeId: listing.id,
  });
  const pricing = estimateMarketValueDetailed({
    brand: listing.brand, model: listing.model, year: listing.year,
    mileage_km: listing.mileage_km, fuel: listing.fuel, gearbox: listing.gearbox,
    power_hp: listing.power_hp, asking_price_eur: listing.price_eur,
  });
  const breakdown = scoreListingFull(
    {
      brand: listing.brand, model: listing.model, version: listing.version,
      engine_designation: listing.engine_designation, price_eur: listing.price_eur,
      seller_kind: listing.seller_kind, posted_at: listing.posted_at,
      photos_count: listing.photos_count, mileage_km: listing.mileage_km,
      year: listing.year, fuel: listing.fuel,
    },
    {
      market_value_eur: pricing.market_value_eur, market_confidence: pricing.confidence,
      comparables: comp, body_type: listing.body_type, mileage_assessment: km,
    },
  );

  return (
    <div className="space-y-4">
      {/* Titre principal */}
      <div className="flex items-center gap-2">
        <Zap size={18} className="text-rose-500 shrink-0" />
        <h1 className="text-lg font-bold tracking-tight">Analyse VO Radar</h1>
      </div>

      {/* Score breakdown */}
      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <Zap size={16} className="text-rose-400" /> Pourquoi ce score : {breakdown.score}/100
        </h2>
        <div className="space-y-1.5">
          <FactorRow label="Score de base" delta={50} neutral />
          {breakdown.factors.map((f, i) => (
            <FactorRow key={i} label={f.label} delta={f.delta} detail={f.detail} />
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-[var(--border)] pt-2">
            <span className="font-semibold">Total</span>
            <span className="font-mono font-semibold tabular-nums">{breakdown.score}/100</span>
          </div>
        </div>
      </section>

      {/* Engine reliability */}
      {eng.profile ? (
        <section className={`rounded-xl border p-6 ${
          eng.rating === "avoid" ? "border-rose-500/20 bg-rose-500/5" :
          eng.rating === "risky" ? "border-amber-500/20 bg-amber-500/5" :
          eng.rating === "excellent" || eng.rating === "good" ? "border-emerald-500/20 bg-emerald-500/5" :
          "border-neutral-700 bg-neutral-800/50"
        }`}>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            {eng.rating === "avoid" ? <AlertCircle size={16} className="text-rose-400" />
             : eng.rating === "risky" ? <AlertTriangle size={16} className="text-amber-400" />
             : eng.rating === "excellent" || eng.rating === "good" ? <CheckCircle size={16} className="text-emerald-400" />
             : <Info size={16} className="text-neutral-400" />}
            Fiabilité moteur
            <span className={`ml-auto rounded-full px-2 py-0.5 text-xs font-medium ${
              eng.rating === "avoid" ? "bg-rose-500/15 text-rose-300" :
              eng.rating === "risky" ? "bg-amber-500/15 text-amber-300" :
              eng.rating === "excellent" ? "bg-emerald-500/15 text-emerald-300" :
              eng.rating === "good" ? "bg-emerald-500/10 text-emerald-400" :
              "bg-[var(--background)] text-neutral-300"
            }`}>
              {eng.rating === "avoid" ? "À éviter"
               : eng.rating === "risky" ? "À surveiller"
               : eng.rating === "excellent" ? "Top"
               : eng.rating === "good" ? "Fiable"
               : eng.rating === "average" ? "Correct" : "?"}
            </span>
          </h2>
          {listing.engine_designation && (
            <p className="mb-3 text-sm text-neutral-300">
              <span className="text-neutral-500">Motorisation :</span> {listing.engine_designation}
            </p>
          )}
          {eng.profile.issues.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">Problèmes connus</div>
              <ul className="space-y-1 text-sm text-neutral-300">
                {eng.profile.issues.map((issue, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-1.5 inline-block h-1 w-1 shrink-0 rounded-full bg-rose-400" />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {eng.profile.inspect.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 text-xs uppercase tracking-wide text-neutral-500">À vérifier en inspection</div>
              <ul className="space-y-1 text-sm text-neutral-300">
                {eng.profile.inspect.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <Search size={11} className="mt-1 shrink-0 text-neutral-500" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-2 flex flex-wrap gap-3 text-xs">
            <Pill label={`Coût de réparation : ${costLabel(eng.profile.fix_cost)}`} />
            <Pill label={`Risque revente : ${riskLabel(eng.profile.resale_risk)}`} />
          </div>
          {eng.profile.notes && (
            <p className="mt-3 text-xs italic text-neutral-400">{eng.profile.notes}</p>
          )}
        </section>
      ) : (
        <section className="rounded-xl border border-neutral-700 bg-neutral-800/50 p-6">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <Info size={16} className="text-neutral-400" /> Fiabilité moteur
          </h2>
          <p className="text-sm text-neutral-400">
            Motorisation non profilée dans notre base. Vérifier manuellement les retours forums + carnet d&rsquo;entretien.
          </p>
        </section>
      )}

      {/* ZFE / Crit'Air */}
      <section className={`rounded-xl border p-6 ${
        zfe.critair <= 1 ? "border-emerald-500/20 bg-emerald-500/5" :
        zfe.critair >= 4 ? "border-rose-500/20 bg-rose-500/5" :
        "border-neutral-700 bg-neutral-800/50"
      }`}>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          <span className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded text-[10px] font-bold ${
            zfe.critair === 0 ? "bg-emerald-500" :
            zfe.critair === 1 ? "bg-violet-500" :
            zfe.critair === 2 ? "bg-amber-500" :
            zfe.critair === 3 ? "bg-orange-500" :
            zfe.critair >= 4 ? "bg-rose-500" : "bg-neutral-600"
          } text-white`}>
            {zfe.critair === -1 ? "NC" : zfe.critair}
          </span>
          Crit&rsquo;Air {zfe.critair === -1 ? "non classé" : zfe.critair} — Impact ZFE
        </h2>
        <div className="grid grid-cols-3 gap-2 text-sm">
          <ZfeStatus city="Paris / IDF" ok={zfe.paris_ok} />
          <ZfeStatus city="Lyon" ok={zfe.lyon_ok} />
          <ZfeStatus city="Autres ZFE" ok={zfe.major_cities_ok} />
        </div>
        {zfe.resale_warning && (
          <p className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
            ⚠ {zfe.resale_warning}
          </p>
        )}
      </section>

      {/* Carrosserie + marché */}
      <section className={`rounded-xl border p-6 ${
        trend.velocity === "fast" ? "border-emerald-500/20 bg-emerald-500/5" :
        trend.velocity === "slow" ? "border-rose-500/20 bg-rose-500/5" :
        "border-neutral-700 bg-neutral-800/50"
      }`}>
        <h2 className="mb-3 flex items-center gap-2 font-semibold">
          {trend.velocity === "fast" ? <TrendingUp size={16} className="text-emerald-400" />
           : trend.velocity === "slow" ? <TrendingDown size={16} className="text-rose-400" />
           : <Info size={16} className="text-neutral-400" />}
          Tendance marché — {listing.body_type}
        </h2>
        <p className="text-sm text-neutral-300">{trend.note || "Demande stable sur ce segment"}</p>
        <p className="mt-2 text-xs text-neutral-500">
          Rotation prévue : <span className="text-neutral-200">{trend.velocity === "fast" ? "rapide" : trend.velocity === "slow" ? "lente" : "normale"}</span>
        </p>
      </section>

      {/* Anomalie km */}
      {km.score_adjustment !== 0 && (
        <section className={`rounded-xl border p-6 ${
          km.status === "suspicious_low" || km.status === "very_high"
            ? "border-rose-500/20 bg-rose-500/5"
            : km.score_adjustment > 0
            ? "border-emerald-500/20 bg-emerald-500/5"
            : "border-neutral-700 bg-neutral-800/50"
        }`}>
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            {km.status === "suspicious_low" || km.status === "very_high"
              ? <AlertCircle size={16} className="text-rose-400" />
              : km.score_adjustment > 0
              ? <CheckCircle size={16} className="text-emerald-400" />
              : <Info size={16} className="text-neutral-400" />}
            Analyse kilométrage
          </h2>
          <p className="text-sm text-neutral-300">{km.note}</p>
          <p className="mt-2 text-xs text-neutral-500">
            Kilométrage observé : <span className="text-neutral-200">{fmtKm(listing.mileage_km)}</span> ·
            Attendu pour l&rsquo;âge : <span className="text-neutral-200">~{fmtKm(km.expected_km)}</span> ·
            Écart : <span className={km.delta_pct > 0 ? "text-rose-400" : "text-emerald-400"}>{km.delta_pct > 0 ? "+" : ""}{km.delta_pct}%</span>
          </p>
        </section>
      )}

      {/* Comparables */}
      {comp.n >= 3 && comp.median_eur ? (
        <section className={`rounded-xl border p-6 ${
          listing.price_eur < comp.median_eur
            ? "border-emerald-500/20 bg-emerald-500/5"
            : listing.price_eur > comp.median_eur * 1.1
            ? "border-rose-500/20 bg-rose-500/5"
            : "border-neutral-700 bg-neutral-800/50"
        }`}>
          <h2 className="mb-3 flex items-center gap-2 font-semibold">
            {listing.price_eur < comp.median_eur
              ? <CheckCircle size={16} className="text-emerald-400" />
              : listing.price_eur > comp.median_eur * 1.1
              ? <AlertCircle size={16} className="text-rose-400" />
              : <Search size={16} className="text-neutral-400" />}

            Comparables réels ({comp.n} annonces similaires)
          </h2>
          <div className="grid grid-cols-3 gap-3 text-sm">
            <PriceStat label="P25" value={comp.p25_eur ?? 0} muted />
            <PriceStat label="Médiane" value={comp.median_eur} highlight />
            <PriceStat label="P75" value={comp.p75_eur ?? 0} muted />
          </div>
          <p className="mt-3 text-xs text-neutral-400">
            Confiance : {comp.confidence === "high" ? "élevée" : comp.confidence === "medium" ? "moyenne" : "faible"} ·
            Cette annonce est à{" "}
            {listing.price_eur < comp.median_eur ? (
              <span className="text-emerald-400">{fmtEUR(comp.median_eur - listing.price_eur)} sous la médiane</span>
            ) : (
              <span className="text-rose-400">{fmtEUR(listing.price_eur - comp.median_eur)} au-dessus de la médiane</span>
            )}
          </p>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs text-neutral-400 hover:text-neutral-200">Voir les annonces similaires</summary>
            <ul className="mt-2 space-y-1.5 text-xs">
              {comp.comparables.slice(0, 6).map((c) => (
                <li key={c.id} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--background)] px-3 py-1.5">
                  <Link href={`/listings/${c.id}`} className="truncate text-neutral-300 hover:underline">
                    {c.brand} {c.model} {c.year} · {fmtKm(c.mileage_km)}
                  </Link>
                  <span className="font-mono tabular-nums">{fmtEUR(c.price_eur)}</span>
                </li>
              ))}
            </ul>
          </details>
        </section>
      ) : (
        <section className="rounded-xl border border-neutral-700 bg-neutral-800/50 p-6">
          <h2 className="mb-2 flex items-center gap-2 font-semibold">
            <Info size={16} className="text-neutral-400" /> Comparables
          </h2>
          <p className="text-sm text-neutral-400">
            Pas encore assez d&rsquo;annonces similaires en base pour calculer une médiane fiable. Plus de données arriveront avec le scraping continu.
          </p>
        </section>
      )}
    </div>
  );
}

function FactorRow({ label, delta, detail, neutral }: { label: string; delta: number; detail?: string; neutral?: boolean }) {
  const color = neutral ? "text-neutral-400" : delta > 0 ? "text-emerald-400" : delta < 0 ? "text-rose-400" : "text-neutral-400";
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <div className="min-w-0 flex-1">
        <div className="text-neutral-200">{label}</div>
        {detail && <div className="mt-0.5 text-xs text-neutral-500">{detail}</div>}
      </div>
      <div className={`shrink-0 font-mono tabular-nums ${color}`}>
        {delta > 0 ? "+" : ""}{delta}
      </div>
    </div>
  );
}

function ZfeStatus({ city, ok }: { city: string; ok: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-center text-xs ${ok ? "bg-emerald-500/10 text-emerald-300" : "bg-rose-500/10 text-rose-300"}`}>
      <div className="font-medium">{city}</div>
      <div className="mt-0.5">{ok ? "✓ Autorisé" : "✕ Banni"}</div>
    </div>
  );
}

function PriceStat({ label, value, highlight, muted }: { label: string; value: number; highlight?: boolean; muted?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 text-center ${highlight ? "bg-rose-500/10 ring-1 ring-rose-500/30" : "bg-[var(--background)]"}`}>
      <div className={`text-xs uppercase tracking-wide ${muted ? "text-neutral-500" : "text-neutral-400"}`}>{label}</div>
      <div className="mt-0.5 font-mono font-semibold tabular-nums">{fmtEUR(value)}</div>
    </div>
  );
}

function Pill({ label }: { label: string }) {
  return <span className="rounded-full bg-[var(--background)] px-2 py-1 text-neutral-300">{label}</span>;
}

function costLabel(c: "low" | "medium" | "high" | "engine-out"): string {
  return c === "low" ? "faible (< 500 €)"
       : c === "medium" ? "moyen (500-1 500 €)"
       : c === "high" ? "élevé (1 500-3 500 €)"
       : "moteur out (3 500 €+)";
}

function riskLabel(r: "low" | "medium" | "high"): string {
  return r === "low" ? "faible" : r === "medium" ? "moyen" : "élevé";
}
