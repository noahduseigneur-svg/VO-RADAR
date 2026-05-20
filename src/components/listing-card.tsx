import Link from "next/link";
import { Calendar, Fuel, Gauge, MapPin, User, Building2, Sparkles } from "lucide-react";
import { ScoreBadge } from "./score-badge";
import { SaveButton } from "./save-button";
import { EngineBadge } from "./engine-badge";
import { CritAirBadge } from "./critair-badge";
import { CompareCheckbox } from "./compare-bar";
import { DealStatusButton } from "./deal-status";
import { fmtDate, fmtEUR, fmtKm } from "@/lib/utils";
import type { Listing } from "@/lib/types";
import type { DealStatus } from "@/lib/db";

export function ListingCard({
  listing,
  savedInitial = false,
  dealStatus = null,
  isNew = false,
}: {
  listing: Listing;
  savedInitial?: boolean;
  dealStatus?: DealStatus | null;
  isNew?: boolean;
}) {
  const gain = listing.delta_eur;
  return (
    <article className="group relative rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 transition hover:border-neutral-700">
      {isNew && (
        <span className="absolute -top-2 left-3 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          <Sparkles size={9} /> Nouveau
        </span>
      )}
      <header className="flex items-start justify-between gap-3">
        <Link href={`/listings/${listing.id}`} className="min-w-0 flex-1 hover:underline">
          <h3 className="truncate font-semibold text-neutral-100">
            {listing.brand} {listing.model}
          </h3>
          <p className="truncate text-sm text-neutral-400">{listing.version}</p>
          {listing.engine_designation && (
            <p className="mt-0.5 truncate text-xs text-neutral-500">{listing.engine_designation}</p>
          )}
        </Link>
        <div className="flex items-center gap-1.5">
          <SaveButton listingId={listing.id} initial={savedInitial} />
          <ScoreBadge score={listing.score} />
        </div>
      </header>

      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <EngineBadge rating={listing.engine_rating} />
        <CritAirBadge value={listing.critair} compact />
        {listing.body_type !== "inconnu" && (
          <span className="rounded-full bg-neutral-700/40 px-1.5 py-0.5 text-[10px] text-neutral-300 capitalize">
            {listing.body_type}
          </span>
        )}
        <DealStatusButton listingId={listing.id} initial={dealStatus} compact />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-neutral-400">
        <Spec icon={<Calendar size={13} />} label={String(listing.year)} />
        <Spec icon={<Gauge size={13} />} label={fmtKm(listing.mileage_km)} />
        <Spec icon={<Fuel size={13} />} label={listing.fuel} />
        <Spec icon={listing.seller_kind === "pro" ? <Building2 size={13} /> : <User size={13} />} label={listing.seller_kind} />
      </div>

      <div className="mt-4 flex items-end justify-between border-t border-[var(--border)] pt-3">
        <div>
          <div className="text-2xl font-semibold tabular-nums">{fmtEUR(listing.price_eur)}</div>
          <div className="text-xs text-neutral-500">
            Cote : {fmtEUR(listing.market_value_eur)}
            {listing.comparables_n >= 3 && listing.comparables_median_eur && (
              <span className="ml-1 text-neutral-600">· {listing.comparables_n} comp. médiane {fmtEUR(listing.comparables_median_eur)}</span>
            )}
          </div>
        </div>
        <div className={`text-right text-sm font-medium ${gain > 0 ? "text-emerald-400" : "text-rose-400"}`}>
          {gain > 0 ? "+" : ""}{fmtEUR(gain)}
          <div className="text-[10px] uppercase tracking-wide text-neutral-500">{listing.delta_pct}%</div>
        </div>
      </div>

      <footer className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span>{fmtDate(listing.posted_at)}</span>
        <div className="flex items-center gap-2">
          <CompareCheckbox listingId={listing.id} />
          <Link href={`/listings/${listing.id}`} className="font-medium text-neutral-300 hover:text-white">
            Détails →
          </Link>
        </div>
      </footer>
    </article>
  );
}

function Spec({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 truncate">
      <span className="text-neutral-500">{icon}</span>
      <span className="truncate capitalize">{label}</span>
    </div>
  );
}
