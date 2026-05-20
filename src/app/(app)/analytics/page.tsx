import Link from "next/link";
import { BarChart3, TrendingUp, Flame, Activity, Sparkles, AlertTriangle } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { rawQuery } from "@/lib/db";
import { fmtEUR } from "@/lib/utils";

interface BrandStat { brand: string; n: number; avg_price: number; avg_score: number; pepites: number }
interface DailyVolume { day: string; n: number }
interface ScoreBucket { bucket: string; n: number; cls: string }
interface RiskyEngine { brand: string; model: string; engine_designation: string | null; n: number }

export default async function AnalyticsPage() {
  await requireUser();

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
    </div>
  );
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
