import { Activity, AlertTriangle, CheckCircle2, Clock, XCircle, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { rawQuery } from "@/lib/db";

interface ScraperStat {
  source: string;
  total: number;
  last_24h: number;
  last_48h: number;
  last_fetched_at: string | null;
  avg_price_eur: number | null;
  avg_score: number | null;
}

type RawStatRow = {
  source: string;
  total: number | bigint;
  last_24h: number | bigint;
  last_48h: number | bigint;
  last_fetched_at: string | null;
  avg_price_eur: number | null;
  avg_score: number | null;
};

const ALL_SCRAPERS = [
  "autoscout24",
  "leboncoin",
  "mobilede",
  "marktplaats",
  "lacentrale",
  "aramis",
  "bymycar",
  "spoticar",
  "ebay",
];

async function getScraperStats(): Promise<ScraperStat[]> {
  const rows = await rawQuery<RawStatRow>(`
    SELECT
      source,
      COUNT(*) AS total,
      SUM(CASE WHEN fetched_at > datetime('now', '-24 hours') THEN 1 ELSE 0 END) AS last_24h,
      SUM(CASE WHEN fetched_at > datetime('now', '-48 hours') THEN 1 ELSE 0 END) AS last_48h,
      MAX(fetched_at) AS last_fetched_at,
      AVG(price_eur) AS avg_price_eur,
      AVG(score) AS avg_score
    FROM listings
    GROUP BY source
    ORDER BY total DESC
  `);

  const bySource = new Map(
    rows.map((r) => [
      r.source,
      {
        source: r.source,
        total: Number(r.total),
        last_24h: Number(r.last_24h),
        last_48h: Number(r.last_48h),
        last_fetched_at: r.last_fetched_at,
        avg_price_eur: r.avg_price_eur != null ? Math.round(Number(r.avg_price_eur)) : null,
        avg_score: r.avg_score != null ? Math.round(Number(r.avg_score)) : null,
      } satisfies ScraperStat,
    ]),
  );

  // Ensure all known scrapers appear, even with zero data
  return ALL_SCRAPERS.map(
    (name) =>
      bySource.get(name) ?? {
        source: name,
        total: 0,
        last_24h: 0,
        last_48h: 0,
        last_fetched_at: null,
        avg_price_eur: null,
        avg_score: null,
      },
  );
}

type Status = "active" | "slow" | "inactive";

function getStatus(stat: ScraperStat): Status {
  if (stat.last_fetched_at === null) return "inactive";
  const age = Date.now() - new Date(stat.last_fetched_at).getTime();
  const hours = age / 3_600_000;
  if (hours <= 24) return "active";
  if (hours <= 72) return "slow";
  return "inactive";
}

function formatRelative(isoDate: string | null): string {
  if (!isoDate) return "jamais";
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 60) return `il y a ${mins} min`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  return `il y a ${days}j`;
}

function formatPrice(eur: number | null): string {
  if (eur == null) return "—";
  return eur.toLocaleString("fr-FR") + " €";
}

const STATUS_CONFIG: Record<Status, { label: string; icon: LucideIcon; dot: string; card: string }> = {
  active: {
    label: "Actif",
    icon: CheckCircle2,
    dot: "bg-emerald-500",
    card: "border-emerald-500/20",
  },
  slow: {
    label: "Peu actif",
    icon: AlertTriangle,
    dot: "bg-yellow-500",
    card: "border-yellow-500/20",
  },
  inactive: {
    label: "Inactif",
    icon: XCircle,
    dot: "bg-rose-500",
    card: "border-rose-500/20",
  },
};

export default async function AdminScrapersPage() {
  await requireUser();
  const stats = await getScraperStats();

  const active = stats.filter((s) => getStatus(s) === "active").length;
  const slow = stats.filter((s) => getStatus(s) === "slow").length;
  const inactive = stats.filter((s) => getStatus(s) === "inactive").length;
  const total24h = stats.reduce((sum, s) => sum + s.last_24h, 0);

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">Monitoring Scrapers</h1>
        <p className="mt-1 text-sm text-neutral-400">
          État de santé en temps réel des {ALL_SCRAPERS.length} sources de données
        </p>
      </header>

      {/* Summary KPIs */}
      <section className="mb-8 grid gap-3 sm:grid-cols-4">
        <Kpi
          icon={<CheckCircle2 size={16} className="text-emerald-400" />}
          label="Actifs"
          value={String(active)}
          accent="emerald"
        />
        <Kpi
          icon={<AlertTriangle size={16} className="text-yellow-400" />}
          label="Peu actifs"
          value={String(slow)}
          accent="yellow"
        />
        <Kpi
          icon={<XCircle size={16} className="text-rose-400" />}
          label="Inactifs"
          value={String(inactive)}
          accent="rose"
        />
        <Kpi
          icon={<Activity size={16} className="text-rose-400" />}
          label="Nouvelles 24h"
          value={total24h.toLocaleString("fr-FR")}
          accent="rose"
        />
      </section>

      {/* Scraper cards grid */}
      <section className="mb-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {stats.map((stat) => {
          const status = getStatus(stat);
          const cfg = STATUS_CONFIG[status];
          const Icon = cfg.icon;
          return (
            <div
              key={stat.source}
              className={`relative rounded-xl border bg-[var(--card)] p-5 ${cfg.card}`}
            >
              {/* Status dot */}
              <span
                className={`absolute right-4 top-4 h-2.5 w-2.5 rounded-full ${cfg.dot}`}
                title={cfg.label}
              />

              {/* Source name + status */}
              <div className="mb-3 flex items-center gap-2">
                <Icon size={15} className={status === "active" ? "text-emerald-400" : status === "slow" ? "text-yellow-400" : "text-rose-400"} />
                <span className="font-semibold capitalize">{stat.source}</span>
              </div>

              {/* New badge */}
              {stat.last_24h > 0 && (
                <div className="mb-3">
                  <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-400 ring-1 ring-rose-500/30">
                    +{stat.last_24h.toLocaleString("fr-FR")} dernières 24h
                  </span>
                </div>
              )}

              {/* Stats */}
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <StatItem label="Total DB" value={stat.total.toLocaleString("fr-FR")} />
                <StatItem label="Statut" value={cfg.label} />
                <StatItem
                  label="Dernière annonce"
                  value={formatRelative(stat.last_fetched_at)}
                  icon={<Clock size={11} className="text-neutral-500" />}
                />
                <StatItem label="Prix moyen" value={formatPrice(stat.avg_price_eur)} />
              </dl>
            </div>
          );
        })}
      </section>

      {/* Summary table */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">
          Tableau récapitulatif
        </h2>
        <div className="overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--card)]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[var(--border)] text-left text-xs uppercase tracking-wide text-neutral-500">
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3 text-right">Total</th>
                <th className="px-4 py-3 text-right">24h</th>
                <th className="px-4 py-3 text-right">48h</th>
                <th className="px-4 py-3 text-right">Prix moyen</th>
                <th className="px-4 py-3 text-right">Score moyen</th>
                <th className="px-4 py-3">Dernière MAJ</th>
                <th className="px-4 py-3">Statut</th>
              </tr>
            </thead>
            <tbody>
              {stats.map((stat, i) => {
                const status = getStatus(stat);
                const cfg = STATUS_CONFIG[status];
                return (
                  <tr
                    key={stat.source}
                    className={`border-b border-[var(--border)] last:border-0 ${i % 2 === 0 ? "" : "bg-neutral-900/30"}`}
                  >
                    <td className="px-4 py-3 font-medium capitalize">{stat.source}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-300">
                      {stat.total.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {stat.last_24h > 0 ? (
                        <span className="text-rose-400">+{stat.last_24h.toLocaleString("fr-FR")}</span>
                      ) : (
                        <span className="text-neutral-500">0</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-400">
                      {stat.last_48h.toLocaleString("fr-FR")}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-300">
                      {formatPrice(stat.avg_price_eur)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-neutral-300">
                      {stat.avg_score != null ? `${stat.avg_score}/100` : "—"}
                    </td>
                    <td className="px-4 py-3 text-neutral-400">
                      {formatRelative(stat.last_fetched_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ring-1 ${
                          status === "active"
                            ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30"
                            : status === "slow"
                            ? "bg-yellow-500/10 text-yellow-400 ring-yellow-500/30"
                            : "bg-rose-500/10 text-rose-400 ring-rose-500/30"
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                        {cfg.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Kpi({
  icon,
  label,
  value,
  accent,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  accent?: "rose" | "emerald" | "yellow";
}) {
  const accentCls =
    accent === "rose"
      ? "text-rose-400"
      : accent === "emerald"
      ? "text-emerald-400"
      : accent === "yellow"
      ? "text-yellow-400"
      : "text-neutral-300";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className={`flex items-center gap-2 text-xs uppercase tracking-wide ${accentCls}`}>
        {icon} {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function StatItem({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className="mt-0.5 flex items-center gap-1 font-medium tabular-nums">
        {icon}
        {value}
      </dd>
    </div>
  );
}
