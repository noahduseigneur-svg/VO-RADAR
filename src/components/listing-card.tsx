import Link from "next/link";
import React from "react";
import { Calendar, Fuel, Gauge, User, Building2, Sparkles } from "lucide-react";
import { ScoreBadge } from "./score-badge";
import { SaveButton } from "./save-button";
import { EngineBadge } from "./engine-badge";
import { CritAirBadge } from "./critair-badge";
import { CompareCheckbox } from "./compare-bar";
import { DealStatusButton } from "./deal-status";
import { fmtDate, fmtEUR, fmtKm } from "@/lib/utils";
import type { Listing } from "@/lib/types";
import type { DealStatus } from "@/lib/db";
import { daysOnMarket } from "@/lib/db";

const COUNTRY_BADGES: Record<string, { flag: string; short: string; color: string }> = {
  "Belgique":   { flag: "🇧🇪", short: "BE", color: "bg-yellow-500/20 text-yellow-300" },
  "Allemagne":  { flag: "🇩🇪", short: "DE", color: "bg-yellow-400/20 text-yellow-200" },
  "Pays-Bas":   { flag: "🇳🇱", short: "NL", color: "bg-orange-500/20 text-orange-300" },
  "Luxembourg": { flag: "🇱🇺", short: "LU", color: "bg-sky-500/20 text-sky-300" },
  "Espagne":    { flag: "🇪🇸", short: "ES", color: "bg-red-500/20 text-red-300" },
  "Italie":     { flag: "🇮🇹", short: "IT", color: "bg-green-500/20 text-green-300" },
};

const SOURCE_BADGES: Record<string, { label: string; color: string }> = {
  "mobilede":   { label: "Mobile.de",   color: "bg-blue-500/20 text-blue-300" },
  "marktplaats": { label: "Marktplaats", color: "bg-orange-500/20 text-orange-300" },
  "autoscout24": { label: "AutoScout24", color: "bg-violet-500/20 text-violet-300" },
  "leboncoin":   { label: "LeBonCoin",  color: "bg-orange-400/20 text-orange-200" },
  "lacentrale":  { label: "La Centrale", color: "bg-cyan-500/20 text-cyan-300" },
};

const BRAND_COLORS: Record<string, string> = {
  BMW: "bg-gradient-to-br from-blue-800 to-blue-950",
  MERCEDES: "bg-gradient-to-br from-gray-700 to-gray-900",
  "MERCEDES-BENZ": "bg-gradient-to-br from-gray-700 to-gray-900",
  VOLKSWAGEN: "bg-gradient-to-br from-blue-600 to-blue-800",
  VW: "bg-gradient-to-br from-blue-600 to-blue-800",
  AUDI: "bg-gradient-to-br from-red-700 to-red-900",
  PEUGEOT: "bg-gradient-to-br from-blue-700 to-indigo-900",
  RENAULT: "bg-gradient-to-br from-yellow-500 to-yellow-700",
  CITROEN: "bg-gradient-to-br from-red-600 to-red-800",
  FORD: "bg-gradient-to-br from-blue-500 to-blue-700",
  TOYOTA: "bg-gradient-to-br from-red-500 to-red-700",
  DACIA: "bg-gradient-to-br from-blue-400 to-blue-600",
  OPEL: "bg-gradient-to-br from-yellow-600 to-yellow-800",
  SKODA: "bg-gradient-to-br from-green-600 to-green-800",
  SEAT: "bg-gradient-to-br from-red-600 to-orange-700",
  FIAT: "bg-gradient-to-br from-red-500 to-red-700",
  HYUNDAI: "bg-gradient-to-br from-blue-600 to-sky-800",
  KIA: "bg-gradient-to-br from-red-700 to-red-900",
  NISSAN: "bg-gradient-to-br from-red-600 to-red-800",
  HONDA: "bg-gradient-to-br from-red-600 to-red-800",
  MAZDA: "bg-gradient-to-br from-red-700 to-red-900",
  VOLVO: "bg-gradient-to-br from-blue-700 to-blue-900",
  LAND_ROVER: "bg-gradient-to-br from-green-700 to-green-900",
  "LAND ROVER": "bg-gradient-to-br from-green-700 to-green-900",
  PORSCHE: "bg-gradient-to-br from-amber-700 to-amber-900",
};

const SOURCE_LOGO_BADGE: Record<string, React.ReactNode> = {
  autoscout24: <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-500 text-white shadow">AS24</span>,
  leboncoin: <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-400 text-white shadow">LBC</span>,
  lacentrale: <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-600 text-white shadow">LC</span>,
  mobilede: <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-500 text-white shadow">M.de</span>,
  marktplaats: <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-700 text-white shadow">MP</span>,
  aramis: <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-purple-600 text-white shadow">ARAM</span>,
  bymycar: <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-600 text-white shadow">BMC</span>,
  spoticar: <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-yellow-500 text-black shadow">SPOT</span>,
  ebay: <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-400 text-white shadow">eBay</span>,
};

export function ListingCard({
  listing,
  savedInitial = false,
  dealStatus = null,
  isNew = false,
  onSelect,
  selected = false,
}: {
  listing: Listing;
  savedInitial?: boolean;
  dealStatus?: DealStatus | null;
  isNew?: boolean;
  onSelect?: (id: string, selected: boolean) => void;
  selected?: boolean;
}) {
  const gain = listing.delta_eur;
  const countryBadge = listing.region ? COUNTRY_BADGES[listing.region] : null;
  const sourceBadge = listing.source ? SOURCE_BADGES[listing.source.toLowerCase()] : null;
  const sourceLogoBadge = listing.source ? SOURCE_LOGO_BADGE[listing.source.toLowerCase()] : null;
  const brandColor = BRAND_COLORS[listing.brand?.toUpperCase() ?? ""] ?? "bg-gradient-to-br from-slate-600 to-slate-800";
  return (
    <article className="group relative rounded-xl border border-[var(--border)] bg-[var(--card)] overflow-hidden transition-all duration-200 hover:border-neutral-600 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-black/40 fade-in-up">
      {isNew && (
        <span className="absolute -top-2 left-3 z-10 inline-flex items-center gap-1 rounded-full bg-rose-500 px-2 py-0.5 text-[10px] font-semibold text-white shadow">
          <Sparkles size={9} /> Nouveau
        </span>
      )}

      {/* Zone image */}
      <div className="relative h-40 bg-gray-100 dark:bg-gray-800 overflow-hidden">
        {listing.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.photo_url}
            alt={listing.title}
            className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
            loading="lazy"
            onError={(e) => {
              const img = e.target as HTMLImageElement;
              img.style.display = "none";
              const fallback = img.parentElement?.querySelector("[data-fallback]") as HTMLElement | null;
              if (fallback) fallback.style.opacity = "1";
            }}
          />
        ) : null}
        {/* Fallback gradient avec initiales */}
        <div
          data-fallback
          className={`absolute inset-0 flex flex-col items-center justify-center ${brandColor} transition-opacity`}
          style={{ opacity: listing.photo_url ? 0 : 1 }}
        >
          <span className="text-white text-3xl font-bold opacity-80">{listing.brand?.slice(0, 2).toUpperCase()}</span>
          <span className="text-white text-xs opacity-60 mt-1">{listing.brand}</span>
        </div>
        {/* Badge source logo en haut à droite */}
        {sourceLogoBadge && (
          <div className="absolute top-2 right-2">
            {sourceLogoBadge}
          </div>
        )}
        {/* Badge pays en bas à gauche */}
        {countryBadge && !onSelect && (
          <div className="absolute bottom-2 left-2">
            <span className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium ${countryBadge.color} backdrop-blur-sm`}>
              {countryBadge.flag} {countryBadge.short}
            </span>
          </div>
        )}
        {/* Checkbox de sélection bulk */}
        {onSelect && (
          <div className="absolute bottom-2 left-2 z-10">
            <input
              type="checkbox"
              checked={selected}
              onChange={(e) => onSelect(listing.id, e.target.checked)}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 cursor-pointer accent-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
              style={selected ? { opacity: 1 } : undefined}
              aria-label="Sélectionner cette annonce"
            />
          </div>
        )}
      </div>

      <div className="p-4">
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
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex items-center gap-1.5">
            {sourceBadge && (
              <span className={`inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium ${sourceBadge.color}`}>
                {sourceBadge.label}
              </span>
            )}
            <SaveButton listingId={listing.id} initial={savedInitial} />
            <ScoreBadge score={listing.score} />
          </div>
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
              <span className="ml-1 text-neutral-600">· {listing.comparables_n} comp.</span>
            )}
          </div>
        </div>
        <div className={`rounded-lg px-2.5 py-1.5 text-right text-sm font-semibold tabular-nums ${
          gain > 0
            ? "bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-500/20"
            : "bg-rose-500/15 text-rose-300 ring-1 ring-rose-500/20"
        }`}>
          {gain > 0 ? "+" : ""}{fmtEUR(gain)}
          <div className="text-[10px] font-medium opacity-70">{listing.delta_pct}%</div>
        </div>
      </div>

      <footer className="mt-3 flex items-center justify-between text-xs text-neutral-500">
        <span className="flex items-center gap-1.5">
          {fmtDate(listing.posted_at)}
          {(() => {
            const days = daysOnMarket(listing);
            if (days < 3) return null;
            const cls =
              days > 30
                ? "bg-rose-500/20 text-rose-400"
                : days >= 15
                ? "bg-amber-500/20 text-amber-300"
                : "bg-neutral-700/60 text-neutral-400";
            return (
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>
                {days}j
              </span>
            );
          })()}
        </span>
        <div className="flex items-center gap-2">
          <CompareCheckbox listingId={listing.id} />
          <Link href={`/listings/${listing.id}`} className="font-medium text-neutral-300 hover:text-white">
            Détails →
          </Link>
        </div>
      </footer>
      </div>
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
