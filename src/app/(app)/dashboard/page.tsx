import Link from "next/link";
import { Activity, Flame, Sparkles, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { queryListings, statsForDashboard } from "@/lib/db";
import { ListingCard } from "@/components/listing-card";
import { ScrapeStatusWidget } from "@/components/scrape-status";

export default async function Dashboard() {
  const user = await requireUser();
  const [stats, top] = await Promise.all([
    statsForDashboard(),
    queryListings({ min_score: 75, limit: 6 }),
  ]);
  const trialDaysLeft = Math.max(0, Math.ceil((new Date(user.trial_ends_at).getTime() - Date.now()) / 86400_000));

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <header className="mb-8 flex items-end justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Bonjour, {user.dealership_name}</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {user.subscription_status === "trialing" ? (
              <>Essai gratuit · {trialDaysLeft} jour{trialDaysLeft !== 1 ? "s" : ""} restant{trialDaysLeft !== 1 ? "s" : ""}</>
            ) : (
              <>Plan {user.plan} · {user.subscription_status}</>
            )}
          </p>
        </div>
        {user.subscription_status === "trialing" && (
          <Link href="/settings" className="rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-400">
            Activer mon abonnement
          </Link>
        )}
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Kpi icon={<Activity size={16} />} label="Annonces suivies" value={stats.total.toLocaleString("fr-FR")} />
        <Kpi icon={<Sparkles size={16} />} label="Nouvelles (24h)" value={stats.fresh_24h.toLocaleString("fr-FR")} accent="rose" />
        <Kpi icon={<Flame size={16} />} label="Pépites détectées" value={stats.hot_deals.toLocaleString("fr-FR")} accent="emerald" />
        <Kpi icon={<TrendingUp size={16} />} label="Score moyen" value={`${stats.avg_score}/100`} />
      </section>

      <section className="mt-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">Scraper temps réel</h2>
        <ScrapeStatusWidget />
      </section>

      <section className="mt-10">
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-xl font-semibold">Top opportunités</h2>
          <Link href="/listings" className="text-sm text-neutral-400 hover:text-white">
            Voir toutes les annonces →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {top.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="mb-4 text-xl font-semibold">Activité par marque</h2>
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {stats.brands.map((b) => (
              <div key={b.brand} className="flex items-center justify-between rounded-lg bg-[var(--background)] px-4 py-3">
                <span className="font-medium">{b.brand}</span>
                <span className="font-mono text-sm text-neutral-400 tabular-nums">{b.n}</span>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Kpi({ icon, label, value, accent }: { icon: React.ReactNode; label: string; value: string; accent?: "rose" | "emerald" }) {
  const accentCls = accent === "rose" ? "text-rose-400" : accent === "emerald" ? "text-emerald-400" : "text-neutral-300";
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className={`flex items-center gap-2 text-xs uppercase tracking-wide ${accentCls}`}>
        {icon} {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
