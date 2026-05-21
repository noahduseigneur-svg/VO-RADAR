import Link from "next/link";
import { BarChart3, TrendingUp, Flame, Activity, Sparkles, AlertTriangle, BarChart2, Clock, MapPin, Fuel } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { rawQuery, getMonthlyPnL } from "@/lib/db";
import type { MonthlyPnL } from "@/lib/db";
import { fmtEUR } from "@/lib/utils";

interface BrandStat { brand: string; n: number; avg_price: number; avg_score: number; pepites: number }
interface DailyVolume { day: string; n: number }
interface ScoreBucket { bucket: string; n: number; cls: string }
interface RiskyEngine { brand: string; model: string; engine_designation: string | null; n: number }
interface SourceStat { source: string; n: number; avg_score: number; pct_pepites: number; avg_delta: number }
interface HourStat { h: string; n: number }
interface RegionStat { region: string; n: number; avg_delta: number; pepites: number }
interface FuelStat { fuel: string; n: number; avg_price: number; avg_score: number; avg_km: number }

export default async function AnalyticsPage() {
  const user = await requireUser();

  const [
    [{ n: total }],
    [{ n: lastFresh }],
    [{ n: hot }],
    [{ a: avgScoreRaw }],
    [{ n: risky }],
    brandStats,
    daily,
    [{ n: s85 }],
    [{ n: s70 }],
    [{ n: s50 }],
    [{ n: sLow }],
    riskyTop,
    bodies,
    fuels,
    sourceStats,
    hourStats,
    regionStats,
    fuelStats,
    monthlyPnl,
  ] = await Promise.all([
    rawQuery<{ n: number }>("SELECT COUNT(*) n FROM listings"),
    rawQuery<{ n: number }>("SELECT COUNT(*) n FROM listings WHERE fetched_at > datetime('now','-24 hours')"),
    rawQuery<{ n: number }>("SELECT COUNT(*) n FROM listings WHERE score >= 85"),
    rawQuery<{ a: number }>("SELECT COALESCE(AVG(score),0) a FROM listings"),
    rawQuery<{ n: number }>("SELECT COUNT(*) n FROM listings WHERE engine_rating IN ('risky','avoid')"),
    rawQuery<BrandStat>(`SELECT brand, COUNT(*) n, ROUND(AVG(price_eur)) avg_price, ROUND(AVG(score)) avg_score,
        SUM(CASE WHEN score >= 85 THEN 1 ELSE 0 END) pepites
        FROM listings GROUP BY brand HAVING n >= 2 ORDER BY n DESC LIMIT 12`),
    rawQuery<DailyVolume>(`SELECT date(fetched_at) day, COUNT(*) n FROM listings
        WHERE fetched_at > datetime('now','-14 days') GROUP BY day ORDER BY day ASC`),
    rawQuery<{ n: number }>("SELECT COUNT(*) n FROM listings WHERE score >= 85"),
    rawQuery<{ n: number }>("SELECT COUNT(*) n FROM listings WHERE score >= 70 AND score < 85"),
    rawQuery<{ n: number }>("SELECT COUNT(*) n FROM listings WHERE score >= 50 AND score < 70"),
    rawQuery<{ n: number }>("SELECT COUNT(*) n FROM listings WHERE score < 50"),
    rawQuery<RiskyEngine>(`SELECT brand, model, engine_designation, COUNT(*) n
        FROM listings WHERE engine_rating IN ('risky','avoid')
        GROUP BY brand, model, engine_designation ORDER BY n DESC LIMIT 8`),
    rawQuery<{ body_type: string; n: number }>("SELECT body_type, COUNT(*) n FROM listings GROUP BY body_type ORDER BY n DESC"),
    rawQuery<{ fuel: string; n: number }>("SELECT fuel, COUNT(*) n FROM listings GROUP BY fuel ORDER BY n DESC"),
    rawQuery<SourceStat>(`SELECT source, COUNT(*) n,
      ROUND(AVG(score)) avg_score,
      ROUND(100.0*SUM(CASE WHEN score>=85 THEN 1 ELSE 0 END)/COUNT(*),1) pct_pepites,
      ROUND(AVG(delta_pct),1) avg_delta
      FROM listings
      GROUP BY source
      ORDER BY avg_score DESC`),
    rawQuery<HourStat>(`SELECT strftime('%H', fetched_at) h, COUNT(*) n
      FROM listings
      WHERE fetched_at > datetime('now','-7 days')
      GROUP BY h ORDER BY h`),
    rawQuery<RegionStat>(`SELECT region, COUNT(*) n,
      ROUND(AVG(delta_pct),1) avg_delta,
      SUM(CASE WHEN score>=85 THEN 1 ELSE 0 END) pepites
      FROM listings
      WHERE region IS NOT NULL
      GROUP BY region
      HAVING n >= 3
      ORDER BY avg_delta ASC
      LIMIT 8`),
    rawQuery<FuelStat>(`SELECT fuel, COUNT(*) n,
      ROUND(AVG(price_eur)) avg_price,
      ROUND(AVG(score)) avg_score,
      ROUND(AVG(mileage_km)) avg_km
      FROM listings GROUP BY fuel ORDER BY n DESC`),
    getMonthlyPnL(user.id, 6),
  ]);

  const avgScore = Math.round(Number(avgScoreRaw));
  const scoreBuckets: ScoreBucket[] = [
    { bucket: "Pépites (85+)",    n: Number(s85),  cls: "bg-emerald-500" },
    { bucket: "Bonnes (70-84)",  n: Number(s70),  cls: "bg-lime-500" },
    { bucket: "Correct (50-69)", n: Number(s50),  cls: "bg-amber-500" },
    { bucket: "Surcôté (<50)",   n: Number(sLow), cls: "bg-rose-500" },
  ];

  const maxDaily = Math.max(1, ...daily.map((x) => x.n));
  const maxBrand = Math.max(1, ...brandStats.map((x) => x.n));
  const totalScoreBucket = Math.max(1, scoreBuckets.reduce((a, b) => a + b.n, 0));

  // Section A — source perf
  const sourceStatsMapped = sourceStats.map((s) => ({
    ...s,
    n: Number(s.n),
    avg_score: Number(s.avg_score),
    pct_pepites: Number(s.pct_pepites),
    avg_delta: Number(s.avg_delta),
  }));

  // Section B — hourly hunt window
  const hours24 = Array.from({ length: 24 }, (_, i) => {
    const hStr = i.toString().padStart(2, "0");
    const found = hourStats.find((x) => x.h === hStr);
    return { h: hStr, n: found ? Number(found.n) : 0 };
  });
  const maxHour = Math.max(1, ...hours24.map((x) => x.n));
  const picHour = hours24.reduce((best, cur) => (cur.n > best.n ? cur : best), hours24[0]).h;

  // Section C — regions
  const regionStatsMapped = regionStats.map((r) => ({
    ...r,
    n: Number(r.n),
    avg_delta: Number(r.avg_delta),
    pepites: Number(r.pepites),
  }));
  const maxRegionAbs = Math.max(1, ...regionStatsMapped.map((r) => Math.abs(r.avg_delta)));

  // Section D — fuel stats
  const fuelStatsMapped = fuelStats.map((f) => ({
    ...f,
    n: Number(f.n),
    avg_price: Number(f.avg_price),
    avg_score: Number(f.avg_score),
    avg_km: Number(f.avg_km),
  }));
  const totalFuel = Math.max(1, fuelStatsMapped.reduce((a, b) => a + b.n, 0));
  const fuelEmoji: Record<string, string> = {
    electrique: "⚡", diesel: "🛢️", essence: "⛽", hybride: "🔋", gpl: "🟡",
    "plug-in hybrid": "🔋", "mild hybrid": "🔋",
  };
  function getFuelEmoji(fuel: string) {
    const key = fuel.toLowerCase();
    for (const [k, v] of Object.entries(fuelEmoji)) {
      if (key.includes(k)) return v;
    }
    return "🚗";
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
      <header className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-semibold">
          <BarChart3 size={26} className="text-rose-400" /> Analytics
        </h1>
        <p className="mt-1 text-sm text-neutral-400">Vue d&rsquo;ensemble de votre base de données : tendances, marques, qualité.</p>
      </header>

      <section className="mb-6 grid gap-3 md:grid-cols-5">
        <Kpi icon={<Activity size={14} />} label="Total annonces" value={Number(total).toLocaleString("fr-FR")} />
        <Kpi icon={<Sparkles size={14} />} label="Fraîches 24h" value={Number(lastFresh).toLocaleString("fr-FR")} accent="rose" />
        <Kpi icon={<Flame size={14} />} label="Pépites" value={Number(hot).toLocaleString("fr-FR")} accent="emerald" />
        <Kpi icon={<TrendingUp size={14} />} label="Score moyen" value={`${avgScore}/100`} />
        <Kpi icon={<AlertTriangle size={14} />} label="Moteurs à risque" value={Number(risky).toLocaleString("fr-FR")} accent="amber" />
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="mb-4 font-semibold">Volume scrapé / jour (14 derniers jours)</h2>
          {daily.length === 0 ? (
            <p className="text-sm text-neutral-400">Pas encore de données journalières.</p>
          ) : (
            <div className="flex h-40 items-end gap-1.5">
              {daily.map((p) => {
                const h = Math.max(2, (p.n / maxDaily) * 100);
                return (
                  <div key={p.day} className="group flex flex-1 flex-col items-center">
                    <div className="text-[10px] text-neutral-500 opacity-0 group-hover:opacity-100">{p.n}</div>
                    <div className="w-full rounded-t bg-rose-500/70 transition hover:bg-rose-500" style={{ height: `${h}%` }} title={`${p.day}: ${p.n}`} />
                  </div>
                );
              })}
            </div>
          )}
          <div className="mt-2 flex justify-between text-[10px] text-neutral-500">
            <span>{daily[0]?.day ?? ""}</span>
            <span>{daily[daily.length - 1]?.day ?? ""}</span>
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="mb-4 font-semibold">Distribution des scores</h2>
          <div className="space-y-2">
            {scoreBuckets.map((b) => {
              const pct = (b.n / totalScoreBucket) * 100;
              return (
                <div key={b.bucket}>
                  <div className="flex items-center justify-between text-sm">
                    <span>{b.bucket}</span>
                    <span className="font-mono tabular-nums text-neutral-400">{b.n} ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-neutral-800">
                    <div className={`h-full ${b.cls}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 lg:col-span-2">
          <h2 className="mb-4 font-semibold">Top marques (volume + qualité)</h2>
          {brandStats.length === 0 ? (
            <p className="text-sm text-neutral-400">Pas encore assez de données.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-wide text-neutral-500">
                  <th className="pb-2 text-left">Marque</th>
                  <th className="pb-2 text-right">Annonces</th>
                  <th className="pb-2 text-right">Prix moy.</th>
                  <th className="pb-2 text-right">Score moy.</th>
                  <th className="pb-2 text-right">Pépites</th>
                  <th className="pb-2 pl-4 text-left">Volume</th>
                </tr>
              </thead>
              <tbody>
                {brandStats.map((b) => (
                  <tr key={b.brand} className="border-t border-[var(--border)]">
                    <td className="py-2 font-medium">{b.brand}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{b.n}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{fmtEUR(b.avg_price)}</td>
                    <td className="py-2 text-right">
                      <span className={b.avg_score >= 70 ? "text-emerald-400" : b.avg_score >= 50 ? "text-neutral-300" : "text-rose-400"}>
                        {b.avg_score}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{b.pepites}</td>
                    <td className="py-2 pl-4">
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
                        <div className="h-full bg-rose-500" style={{ width: `${(b.n / maxBrand) * 100}%` }} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="mb-4 font-semibold">Carrosseries</h2>
          <BarList items={bodies.map((b) => ({ label: b.body_type, n: b.n }))} />
        </section>

        <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
          <h2 className="mb-4 font-semibold">Carburants</h2>
          <BarList items={fuels.map((f) => ({ label: f.fuel, n: f.n }))} />
        </section>

        <section className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-5 lg:col-span-2">
          <h2 className="mb-4 flex items-center gap-2 font-semibold">
            <AlertTriangle size={14} className="text-amber-400" /> Motorisations à risque dans la base
          </h2>
          {riskyTop.length === 0 ? (
            <p className="text-sm text-neutral-400">Aucun moteur à risque détecté pour l&rsquo;instant.</p>
          ) : (
            <div className="space-y-2">
              {riskyTop.map((r, i) => (
                <Link
                  key={i}
                  href={`/listings?search=${encodeURIComponent(r.brand + " " + r.model)}`}
                  className="flex items-center justify-between rounded-lg bg-[var(--background)] px-3 py-2 text-sm hover:bg-neutral-800"
                >
                  <div>
                    <span className="font-medium">{r.brand} {r.model}</span>
                    <span className="ml-2 text-neutral-400">{r.engine_designation}</span>
                  </div>
                  <span className="font-mono tabular-nums text-amber-300">{r.n}</span>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* ── Section A : Performance par source ── */}
      <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <BarChart2 size={18} className="text-rose-400" /> Performance par source
        </h2>
        {sourceStatsMapped.length === 0 ? (
          <p className="text-sm text-neutral-400">Pas encore de données par source.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-neutral-500">
                <th className="pb-2 text-left">Source</th>
                <th className="pb-2 text-right">Annonces</th>
                <th className="pb-2 text-right">Score moy.</th>
                <th className="pb-2 text-right">% Pépites</th>
                <th className="pb-2 text-right">Delta vs cote</th>
                <th className="pb-2 pl-4 text-left">% Pépites (barre)</th>
              </tr>
            </thead>
            <tbody>
              {sourceStatsMapped.map((s) => {
                const badgeCls = sourceBadgeCls(s.source);
                return (
                  <tr key={s.source} className="border-t border-[var(--border)] even:bg-neutral-900/50">
                    <td className="py-2">
                      <span className={`rounded px-2 py-0.5 text-xs font-medium ${badgeCls}`}>{s.source}</span>
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{s.n.toLocaleString("fr-FR")}</td>
                    <td className="py-2 text-right">
                      <span className={s.avg_score >= 70 ? "text-emerald-400" : s.avg_score >= 50 ? "text-neutral-300" : "text-rose-400"}>
                        {s.avg_score}
                      </span>
                    </td>
                    <td className="py-2 text-right font-mono tabular-nums">{s.pct_pepites}%</td>
                    <td className={`py-2 text-right font-mono tabular-nums ${s.avg_delta < 0 ? "text-emerald-400" : "text-rose-400"}`}>
                      {s.avg_delta > 0 ? "+" : ""}{s.avg_delta}%
                    </td>
                    <td className="py-2 pl-4">
                      <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
                        <div className="h-full bg-emerald-500" style={{ width: `${s.pct_pepites}%` }} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Section B : Fenêtre de chasse optimale ── */}
      <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <Clock size={18} className="text-rose-400" /> Quand scraper ? (7 derniers jours)
        </h2>
        {hours24.every((x) => x.n === 0) ? (
          <p className="text-sm text-neutral-400">Pas encore de données sur 7 jours.</p>
        ) : (
          <>
            <p className="mb-4 text-sm text-neutral-400">
              Consultez VO Radar vers <span className="font-semibold text-rose-400">{parseInt(picHour, 10)}h</span> pour être le premier sur les nouvelles annonces.
            </p>
            <div className="flex h-32 items-end gap-0.5">
              {hours24.map((h) => {
                const pct = Math.max(2, (h.n / maxHour) * 100);
                const isPic = h.h === picHour;
                return (
                  <div key={h.h} className="group flex flex-1 flex-col items-center">
                    <div className="mb-0.5 text-[9px] text-neutral-500 opacity-0 group-hover:opacity-100">{h.n}</div>
                    <div
                      className={`w-full rounded-t transition ${isPic ? "bg-rose-500" : "bg-rose-500/30 hover:bg-rose-500/60"}`}
                      style={{ height: `${pct}%` }}
                      title={`${parseInt(h.h, 10)}h : ${h.n} annonces`}
                    />
                  </div>
                );
              })}
            </div>
            <div className="mt-1 flex justify-between text-[10px] text-neutral-500">
              <span>0h</span>
              <span>6h</span>
              <span>12h</span>
              <span>18h</span>
              <span>23h</span>
            </div>
          </>
        )}
      </section>

      {/* ── Section C : Top régions opportunités ── */}
      <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-1 flex items-center gap-2 font-semibold">
          <MapPin size={18} className="text-rose-400" /> Régions les plus compétitives
        </h2>
        <p className="mb-4 text-sm text-neutral-400">Régions où les voitures sont en moyenne sous leur cote de marché.</p>
        {regionStatsMapped.length === 0 ? (
          <p className="text-sm text-neutral-400">Pas encore assez de données régionales.</p>
        ) : (
          <div className="space-y-2">
            {regionStatsMapped.map((r) => {
              const barCls = r.avg_delta <= -5 ? "bg-emerald-500" : r.avg_delta < 0 ? "bg-lime-500" : "bg-rose-500";
              const barPct = Math.max(4, (Math.abs(r.avg_delta) / maxRegionAbs) * 100);
              return (
                <div key={r.region} className="flex items-center gap-3">
                  <span className="w-36 truncate text-xs text-neutral-300">{r.region}</span>
                  <div className="flex-1">
                    <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
                      <div className={`h-full ${barCls}`} style={{ width: `${barPct}%` }} />
                    </div>
                  </div>
                  <span className={`w-16 text-right font-mono text-xs tabular-nums ${r.avg_delta < 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {r.avg_delta > 0 ? "+" : ""}{r.avg_delta}%
                  </span>
                  <span className="w-10 text-right font-mono text-xs tabular-nums text-neutral-500">{r.n} ann.</span>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ── Section D : Répartition par énergie ── */}
      <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <Fuel size={18} className="text-rose-400" /> Répartition par énergie
        </h2>
        {fuelStatsMapped.length === 0 ? (
          <p className="text-sm text-neutral-400">Pas encore de données carburant.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-neutral-500">
                <th className="pb-2 text-left">Carburant</th>
                <th className="pb-2 text-right">Nb</th>
                <th className="pb-2 text-right">% total</th>
                <th className="pb-2 text-right">Prix moyen</th>
                <th className="pb-2 text-right">Km moyen</th>
                <th className="pb-2 text-right">Score moyen</th>
              </tr>
            </thead>
            <tbody>
              {fuelStatsMapped.map((f) => (
                <tr key={f.fuel} className="border-t border-[var(--border)] even:bg-neutral-900/50">
                  <td className="py-2 font-medium">
                    <span className="mr-2">{getFuelEmoji(f.fuel)}</span>{f.fuel}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums">{f.n.toLocaleString("fr-FR")}</td>
                  <td className="py-2 text-right font-mono tabular-nums text-neutral-400">{((f.n / totalFuel) * 100).toFixed(1)}%</td>
                  <td className="py-2 text-right font-mono tabular-nums">{fmtEUR(f.avg_price)}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{f.avg_km.toLocaleString("fr-FR")} km</td>
                  <td className="py-2 text-right">
                    <span className={f.avg_score >= 70 ? "text-emerald-400" : f.avg_score >= 50 ? "text-neutral-300" : "text-rose-400"}>
                      {f.avg_score}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Section E : P&L mensuel ── */}
      <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h2 className="mb-4 flex items-center gap-2 font-semibold">
          <TrendingUp size={18} className="text-emerald-400" /> P&amp;L mensuel
        </h2>
        {monthlyPnl.length === 0 ? (
          <p className="text-sm text-neutral-400">
            Aucune vente enregistrée — renseignez le prix de revente dans le pipeline pour suivre votre P&amp;L.
          </p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-neutral-500">
                <th className="pb-2 text-left">Mois</th>
                <th className="pb-2 text-right">Achats</th>
                <th className="pb-2 text-right">Revendus</th>
                <th className="pb-2 text-right">Investi</th>
                <th className="pb-2 text-right">Marge</th>
              </tr>
            </thead>
            <tbody>
              {monthlyPnl.map((m: MonthlyPnL) => (
                <tr key={m.month} className="border-t border-[var(--border)] even:bg-neutral-900/50">
                  <td className="py-2 font-medium">
                    {new Date(m.month + "-01").toLocaleString("fr-FR", { month: "short", year: "numeric" })}
                  </td>
                  <td className="py-2 text-right font-mono tabular-nums">{m.deals_won}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{m.deals_sold}</td>
                  <td className="py-2 text-right font-mono tabular-nums">{fmtEUR(m.invested_eur)}</td>
                  <td className={`py-2 text-right font-mono tabular-nums ${m.margin_eur > 0 ? "text-emerald-400" : "text-neutral-300"}`}>
                    {fmtEUR(m.margin_eur)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function sourceBadgeCls(source: string): string {
  const s = source.toLowerCase();
  if (s.includes("autoscout")) return "bg-orange-500/20 text-orange-300";
  if (s.includes("leboncoin")) return "bg-orange-600/20 text-orange-400";
  if (s.includes("lacentrale")) return "bg-blue-500/20 text-blue-300";
  if (s.includes("mobilede")) return "bg-blue-600/20 text-blue-300";
  if (s.includes("marktplaats")) return "bg-blue-800/20 text-blue-400";
  if (s.includes("aramisauto")) return "bg-purple-500/20 text-purple-300";
  if (s.includes("spoticar")) return "bg-teal-500/20 text-teal-300";
  return "bg-neutral-700/40 text-neutral-300";
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: "rose" | "emerald" | "amber" }) {
  const cls = accent === "rose" ? "text-rose-400" : accent === "emerald" ? "text-emerald-400" : accent === "amber" ? "text-amber-400" : "text-neutral-300";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className={`flex items-center gap-2 text-xs uppercase tracking-wide ${cls}`}>{icon} {label}</div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function BarList({ items }: { items: { label: string; n: number }[] }) {
  const max = Math.max(1, ...items.map((i) => i.n));
  return (
    <div className="space-y-1.5">
      {items.map((it) => (
        <div key={it.label} className="flex items-center gap-3">
          <span className="w-20 truncate text-xs capitalize text-neutral-400">{it.label}</span>
          <div className="flex-1">
            <div className="h-2 overflow-hidden rounded-full bg-neutral-800">
              <div className="h-full bg-rose-500" style={{ width: `${(it.n / max) * 100}%` }} />
            </div>
          </div>
          <span className="w-10 text-right font-mono text-xs tabular-nums text-neutral-300">{it.n}</span>
        </div>
      ))}
    </div>
  );
}
