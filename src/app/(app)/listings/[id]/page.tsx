import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Calendar, Fuel, Gauge, MapPin, User as UserIcon, Building2, Cog, Zap, Clock, TrendingDown, ExternalLink } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getDealEntry, getListing, getPriceHistory, isListingSaved, getGarageSettings, getSellerActivity, getVehicleCheck, getSimilarListings } from "@/lib/db";
import { fmtDate, fmtEUR, fmtKm } from "@/lib/utils";
import { ScoreBadge } from "@/components/score-badge";
import { EngineBadge } from "@/components/engine-badge";
import { CritAirBadge } from "@/components/critair-badge";
import { PriceSparkline } from "@/components/price-spark";
import { SaveButton } from "@/components/save-button";
import { InsightsPanel } from "@/components/insights-panel";
import { DealStatusButton } from "@/components/deal-status";
import { PricingProPanel } from "@/components/pricing-pro-panel";
import { LiquidityBadge } from "@/components/liquidity-badge";
import { MarginPanel } from "@/components/margin-panel";
import { VehicleCheckPanel } from "@/components/vehicle-check-panel";
import { SimilarListings } from "@/components/similar-listings";

const BRAND_GRADIENTS: Record<string, string> = {
  BMW: "from-blue-900 to-blue-950",
  MERCEDES: "from-gray-700 to-gray-950",
  "MERCEDES-BENZ": "from-gray-700 to-gray-950",
  AUDI: "from-red-800 to-red-950",
  VOLKSWAGEN: "from-blue-700 to-blue-950",
  PEUGEOT: "from-blue-800 to-indigo-950",
  RENAULT: "from-yellow-600 to-yellow-800",
  VOLVO: "from-blue-800 to-blue-950",
  PORSCHE: "from-amber-700 to-amber-950",
};

export default async function ListingDetailPage(props: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await props.params;
  const listing = await getListing(id);
  if (!listing) notFound();

  const [history, saved, deal, profile, seller, vehicleCheck, similar] = await Promise.all([
    getPriceHistory(id),
    isListingSaved(user.id, id),
    getDealEntry(user.id, id),
    getGarageSettings(user.id),
    getSellerActivity(id),
    getVehicleCheck(user.id, id),
    getSimilarListings(id, listing.brand, listing.model, listing.price_eur, 4),
  ]);

  const brandGradient = BRAND_GRADIENTS[listing.brand?.toUpperCase() ?? ""] ?? "from-slate-700 to-slate-950";

  return (
    <div className="mx-auto max-w-5xl px-4 pb-12 sm:px-8">

      {/* Hero photo / gradient banner */}
      <div className="relative mb-0 -mx-4 sm:-mx-8 h-64 sm:h-80 overflow-hidden bg-neutral-900">
        {listing.photo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={listing.photo_url}
            alt={`${listing.brand} ${listing.model}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className={`absolute inset-0 bg-gradient-to-br ${brandGradient} flex flex-col items-center justify-center`}>
            <span className="text-white text-7xl font-extrabold opacity-20 select-none tracking-tight">
              {listing.brand?.slice(0, 2).toUpperCase()}
            </span>
          </div>
        )}
        {/* Gradient overlay at bottom for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--background)] via-transparent to-transparent" />
        {/* Back link over photo */}
        <div className="absolute top-4 left-4">
          <Link href="/listings" className="inline-flex items-center gap-2 rounded-full bg-black/50 backdrop-blur-sm px-3 py-1.5 text-sm text-white hover:bg-black/70 transition">
            <ArrowLeft size={14} /> Retour
          </Link>
        </div>
        {/* Source button over photo */}
        <div className="absolute top-4 right-4">
          <a
            href={listing.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-full bg-black/50 backdrop-blur-sm px-3 py-1.5 text-sm text-white hover:bg-black/70 transition"
          >
            <ExternalLink size={13} /> Voir l&rsquo;annonce
          </a>
        </div>
      </div>

      {/* Title bar (overlapping the hero bottom) */}
      <div className="relative z-10 -mt-10 mb-6 px-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)]/80 backdrop-blur-md p-5 flex flex-wrap items-start justify-between gap-4 shadow-xl">
          <div className="min-w-0">
            <h1 className="text-2xl sm:text-3xl font-semibold">{listing.brand} {listing.model}</h1>
            <p className="mt-1 text-neutral-400">{listing.version}</p>
            {listing.engine_designation && (
              <p className="mt-0.5 text-sm text-neutral-500">Motorisation : {listing.engine_designation}</p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <DealStatusButton listingId={listing.id} initial={deal?.status ?? null} />
            <SaveButton listingId={listing.id} initial={saved} />
            <ScoreBadge score={listing.score} />
          </div>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <EngineBadge rating={listing.engine_rating} />
        <CritAirBadge value={listing.critair} />
        <LiquidityBadge listing={listing} />
        {listing.body_type !== "inconnu" && (
          <span className="rounded-full bg-neutral-700/40 px-2 py-0.5 text-xs text-neutral-300 capitalize">
            {listing.body_type}
          </span>
        )}
      </div>

      {/* Seller activity alert */}
      {(seller.price_changes > 0 || seller.days_on_market > 30) && (
        <div className="mb-6 flex flex-wrap gap-3">
          {seller.price_changes > 0 && (
            <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              <TrendingDown size={14} />
              Prix baissé <strong>{seller.price_changes}×</strong> depuis la mise en ligne — vendeur motivé
            </div>
          )}
          {seller.days_on_market > 14 && (
            <div className="flex items-center gap-2 rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-2 text-sm text-neutral-300">
              <Clock size={14} />
              En ligne depuis <strong>{seller.days_on_market} jours</strong>
              {seller.days_on_market > 30 ? " — marge de négociation probable" : ""}
            </div>
          )}
        </div>
      )}

      <section className="mb-6 grid gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 md:grid-cols-2">
        <div className="flex items-baseline gap-2">
          <div className="text-4xl font-semibold tabular-nums">{fmtEUR(listing.price_eur)}</div>
          <div className={`text-sm font-medium ${listing.delta_eur > 0 ? "text-emerald-400" : "text-rose-400"}`}>
            {listing.delta_eur > 0 ? "+" : ""}{fmtEUR(listing.delta_eur)} <span className="text-neutral-500">({listing.delta_pct}%)</span>
          </div>
        </div>
        <div className="text-right text-sm text-neutral-400">
          <div>Cote estimée : <span className="text-neutral-200">{fmtEUR(listing.market_value_eur)}</span></div>
          <div>Publiée {fmtDate(listing.posted_at)}</div>
        </div>
      </section>

      <section className="mb-6 grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        <Spec icon={<Calendar size={14} />} label="Année" value={String(listing.year)} />
        <Spec icon={<Gauge size={14} />} label="Kilométrage" value={fmtKm(listing.mileage_km)} />
        <Spec icon={<Fuel size={14} />} label="Carburant" value={listing.fuel} />
        <Spec icon={<Cog size={14} />} label="Boîte" value={listing.gearbox} />
        <Spec icon={<Zap size={14} />} label="Puissance" value={listing.power_hp ? `${listing.power_hp} ch` : "—"} />
        <Spec icon={listing.seller_kind === "pro" ? <Building2 size={14} /> : <UserIcon size={14} />} label="Vendeur" value={listing.seller_kind} />
        {listing.region && <Spec icon={<MapPin size={14} />} label="Région" value={listing.region} />}
        {listing.postal_code && <Spec icon={<MapPin size={14} />} label="Code postal" value={listing.postal_code} />}
      </section>

      <section className="mb-6">
        <PricingProPanel listing={listing} />
      </section>

      <section className="mb-6">
        <MarginPanel listing={listing} profile={profile} />
      </section>

      <section className="mb-6">
        <VehicleCheckPanel listing={listing} initial={vehicleCheck} />
      </section>

      <InsightsPanel listing={listing} />

      {history.length > 0 && (
        <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
          <h2 className="mb-3 font-semibold">Historique de prix</h2>
          <PriceSparkline points={history} />
        </section>
      )}

      <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-semibold">Source de l&rsquo;annonce</h2>
          <p className="mt-1 text-sm text-neutral-400">
            Publiée sur <span className="text-neutral-200 capitalize">{listing.source}</span> · {fmtDate(listing.posted_at)}
          </p>
        </div>
        <a
          href={listing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200"
        >
          <ExternalLink size={14} /> Voir l&rsquo;annonce originale
        </a>
      </section>

      {similar.length > 0 && (
        <section className="mt-6">
          <SimilarListings listings={similar} currentPrice={listing.price_eur} />
        </section>
      )}
    </div>
  );
}

function Spec({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-neutral-500">{icon} {label}</div>
      <div className="mt-1 font-medium capitalize">{value}</div>
    </div>
  );
}
