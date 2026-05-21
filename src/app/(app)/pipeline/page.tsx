import Link from "next/link";
import { Eye, Phone, Handshake, Award, X } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listDealsByStatus, type DealStatus, type DealWithListing } from "@/lib/db";
import { fmtEUR, fmtKm } from "@/lib/utils";
import { ScoreBadge } from "@/components/score-badge";
import { EngineBadge } from "@/components/engine-badge";

const COLUMNS: { status: DealStatus; label: string; icon: React.ReactNode; cls: string }[] = [
  { status: "watching",    label: "À surveiller", icon: <Eye size={14} />,       cls: "border-neutral-700" },
  { status: "to_call",     label: "À appeler",    icon: <Phone size={14} />,     cls: "border-amber-500/40" },
  { status: "negotiating", label: "En négo",      icon: <Handshake size={14} />, cls: "border-violet-500/40" },
  { status: "won",         label: "Acheté",       icon: <Award size={14} />,     cls: "border-emerald-500/40" },
  { status: "lost",        label: "Perdu",        icon: <X size={14} />,         cls: "border-rose-500/40" },
];

export default async function PipelinePage() {
  const user = await requireUser();
  const groups = await listDealsByStatus(user.id);
  const total = Object.values(groups).reduce((a, b) => a + b.length, 0);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Pipeline d&rsquo;achat</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {total} deal{total !== 1 ? "s" : ""}{" "}en cours. Glissez les étiquettes depuis n&rsquo;importe quelle annonce pour changer leur statut.
        </p>
      </header>

      {total === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-10 text-center text-neutral-400">
          Aucun deal dans votre pipeline. Sur n&rsquo;importe quelle annonce, cliquez sur « Statut deal » pour la suivre ici.
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-5">
          {COLUMNS.map((col) => (
            <Column key={col.status} {...col} deals={groups[col.status]} />
          ))}
        </div>
      )}
    </div>
  );
}

function Column({ status, label, icon, cls, deals }: { status: DealStatus; label: string; icon: React.ReactNode; cls: string; deals: DealWithListing[] }) {
  return (
    <div className={`rounded-xl border-2 bg-[var(--card)] ${cls}`}>
      <header className="border-b border-[var(--border)] p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-sm font-semibold">{icon} {label}</span>
          <span className="rounded-full bg-neutral-700/60 px-2 py-0.5 text-xs tabular-nums">{deals.length}</span>
        </div>
      </header>
      <div className="space-y-2 p-2">
        {deals.length === 0 ? (
          <p className="px-2 py-4 text-center text-xs text-neutral-500">Vide</p>
        ) : (
          deals.map((d) => <DealCard key={d.listing.id} deal={d} />)
        )}
      </div>
    </div>
  );
}

function DealCard({ deal }: { deal: DealWithListing }) {
  const l = deal.listing;
  return (
    <Link
      href={`/listings/${l.id}`}
      className="block rounded-lg border border-[var(--border)] bg-[var(--background)] overflow-hidden transition hover:border-neutral-600"
    >
      {/* Miniature photo */}
      <div className="h-20 bg-neutral-800 overflow-hidden relative">
        {l.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={l.photo_url}
            alt={`${l.brand} ${l.model}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span className="text-neutral-600 text-xl font-bold">{l.brand?.slice(0, 2).toUpperCase()}</span>
          </div>
        )}
        <div className="absolute top-1.5 right-1.5">
          <ScoreBadge score={l.score} withLabel={false} />
        </div>
      </div>
      <div className="p-2.5">
        <div className="flex items-start justify-between gap-1">
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium">{l.brand} {l.model}</div>
            <div className="truncate text-[11px] text-neutral-400">{l.version}</div>
          </div>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="font-mono font-semibold tabular-nums">{fmtEUR(l.price_eur)}</span>
          {deal.target_price_eur && (
            <span className="text-rose-400">Offre {fmtEUR(deal.target_price_eur)}</span>
          )}
        </div>
        <div className="mt-1 flex items-center justify-between text-[10px] text-neutral-500">
          <span>{l.year} · {fmtKm(l.mileage_km)}</span>
          <EngineBadge rating={l.engine_rating} compact />
        </div>
        {deal.note && (
          <div className="mt-2 truncate rounded bg-[var(--card)] px-2 py-1 text-[11px] text-neutral-300" title={deal.note}>
            {deal.note}
          </div>
        )}
      </div>
    </Link>
  );
}
