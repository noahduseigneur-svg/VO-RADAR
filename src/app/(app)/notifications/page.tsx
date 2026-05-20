import Link from "next/link";
import { Bell, CheckCircle2 } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listAlertHits, markHitsSeen } from "@/lib/db";
import { ScoreBadge } from "@/components/score-badge";
import { fmtDate, fmtEUR, fmtKm } from "@/lib/utils";

export default async function NotificationsPage() {
  const user = await requireUser();
  const hits = await listAlertHits(user.id, 100);
  // Mark all as seen on view
  await markHitsSeen(user.id);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <header className="mb-6 flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-lg bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20">
          <Bell size={18} />
        </span>
        <div>
          <h1 className="text-3xl font-semibold">Notifications</h1>
          <p className="mt-1 text-sm text-neutral-400">Toutes vos alertes matchées, des plus récentes aux plus anciennes.</p>
        </div>
      </header>

      {hits.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-10 text-center text-neutral-400">
          Aucune notification. Vos alertes vous préviendront ici dès qu&rsquo;une annonce match.
        </div>
      ) : (
        <ul className="space-y-3">
          {hits.map((h) => (
            <li key={h.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-rose-400">
                    <Bell size={12} /> {h.rule_name}
                  </div>
                  <Link href={`/listings/${h.listing.id}`} className="mt-1 block font-medium text-neutral-100 hover:underline">
                    {h.listing.brand} {h.listing.model} <span className="text-neutral-400">{h.listing.version}</span>
                  </Link>
                  <div className="mt-1 text-xs text-neutral-500">
                    {h.listing.year} · {fmtKm(h.listing.mileage_km)} · {h.listing.fuel} · {fmtDate(h.notified_at)}
                    {h.email_sent_at && <span className="ml-2 inline-flex items-center gap-1 text-emerald-400"><CheckCircle2 size={11} /> email envoyé</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <ScoreBadge score={h.listing.score} withLabel={false} />
                  <div className="text-sm font-medium tabular-nums">{fmtEUR(h.listing.price_eur)}</div>
                  <div className={`text-xs ${h.listing.delta_eur > 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {h.listing.delta_eur > 0 ? "+" : ""}{fmtEUR(h.listing.delta_eur)}
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
