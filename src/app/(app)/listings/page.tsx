import Link from "next/link";
import { Download, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { dealStatusMapForListings, getDistinctRegions, getDistinctSources, getRegionStats, getUserState, queryListings, recordListingsView, getBrands, getSavedListingIds, countFreshSince, FOREIGN_REGIONS, getModelsForBrand, getSavedSearches } from "@/lib/db";
import type { ListingSort } from "@/lib/db";
import { ListingsWithBulk } from "@/components/listings-with-bulk";
import { SavedSearchesBar } from "@/components/saved-searches-bar";

const FUELS = ["essence", "diesel", "hybride", "electrique", "gpl"];
const BODIES = ["citadine", "berline", "break", "suv", "monospace", "cabriolet", "coupe"];
const MOTO_TYPES = ["roadster", "trail", "sportive", "custom", "scooter", "enduro", "tourisme", "naked", "autre"] as const;
const SCORE_TIERS = [
  { label: "Tous scores", value: "0" },
  { label: "Correct+ (50+)", value: "50" },
  { label: "Bonne affaire (70+)", value: "70" },
  { label: "Pépites (85+)", value: "85" },
];
const ZFE_TIERS = [
  { label: "Tous Crit'Air", value: "" },
  { label: "ZFE Paris OK (≤2)", value: "2" },
  { label: "ZFE Lyon OK (≤3)", value: "3" },
];
const SORT_OPTIONS: { label: string; value: ListingSort }[] = [
  { label: "Meilleur score", value: "score_desc" },
  { label: "Meilleure affaire", value: "delta_desc" },
  { label: "Prix croissant", value: "price_asc" },
  { label: "Prix décroissant", value: "price_desc" },
  { label: "Plus récent", value: "date_desc" },
  { label: "Moins de km", value: "mileage_asc" },
];
const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2009 }, (_, i) => CURRENT_YEAR - i);

export default async function ListingsPage(props: {
  searchParams: Promise<{
    brand?: string; model?: string; fuel?: string; body_type?: string; min_score?: string;
    max_price?: string; min_price?: string; search?: string; hide_risky?: string;
    max_critair?: string; since_last?: string; region?: string;
    max_km?: string; min_year?: string; max_year?: string;
    seller_kind?: string; sort?: string; source?: string; country?: string;
    vehicle_type?: string; moto_type?: string; min_cc?: string; max_cc?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await props.searchParams;

  const state = await getUserState(user.id);
  const prevVisit = state.last_listings_view;
  await recordListingsView(user.id);

  const sinceLast = sp.since_last === "1";
  const sort = (SORT_OPTIONS.find((o) => o.value === sp.sort)?.value) ?? "score_desc";

  const isMoto = sp.vehicle_type === "moto";
  const filters = {
    brand: sp.brand,
    model: sp.model || undefined,
    fuel: sp.fuel,
    body_type: isMoto ? undefined : sp.body_type,
    min_score: sp.min_score ? Number(sp.min_score) : 0,
    max_price: sp.max_price ? Number(sp.max_price) : undefined,
    min_price: sp.min_price ? Number(sp.min_price) : undefined,
    max_mileage: sp.max_km ? Number(sp.max_km) : undefined,
    min_year: sp.min_year ? Number(sp.min_year) : undefined,
    max_year: sp.max_year ? Number(sp.max_year) : undefined,
    region: sp.region || undefined,
    country: sp.country || undefined,
    source: sp.source || undefined,
    seller_kind: sp.seller_kind || undefined,
    search: sp.search,
    hide_risky_engines: sp.hide_risky === "1",
    max_critair: sp.max_critair ? Number(sp.max_critair) : undefined,
    vehicle_type: sp.vehicle_type || undefined,
    moto_type: isMoto ? (sp.moto_type || undefined) : undefined,
    min_cylindree: isMoto && sp.min_cc ? Number(sp.min_cc) : undefined,
    max_cylindree: isMoto && sp.max_cc ? Number(sp.max_cc) : undefined,
    sort,
    limit: 60,
  };
  let listings = await queryListings(filters);
  if (sinceLast && prevVisit) {
    listings = listings.filter((l) => l.fetched_at > prevVisit);
  }

  const vt = isMoto ? "moto" : "car";
  const [brands, regions, sources, regionStats, savedSet, dealMap, models, savedSearches] = await Promise.all([
    getBrands(vt),
    getDistinctRegions(),
    getDistinctSources(vt),
    getRegionStats(vt),
    getSavedListingIds(user.id),
    dealStatusMapForListings(user.id, listings.map((l) => l.id)),
    sp.brand ? getModelsForBrand(sp.brand, vt) : Promise.resolve([] as string[]),
    getSavedSearches(user.id),
  ]);

  const csvHref = "/api/export/csv?" + new URLSearchParams(
    Object.fromEntries(Object.entries(sp).filter(([, v]) => v != null && v !== "")) as Record<string, string>
  ).toString();

  const freshSinceLast = prevVisit ? await countFreshSince(prevVisit, vt) : 0;

  const activeFilterCount = [
    sp.brand, sp.model, sp.fuel, isMoto ? sp.moto_type : sp.body_type,
    sp.region, sp.seller_kind, sp.source, sp.country,
    sp.max_km, sp.min_year, sp.max_year, sp.max_price, sp.min_price,
    sp.min_score && sp.min_score !== "0" ? sp.min_score : null,
    sp.hide_risky === "1" ? "1" : null,
    sp.max_critair,
    isMoto ? (sp.min_cc || sp.max_cc || undefined) : undefined,
  ].filter(Boolean).length;

  return (
    <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold">Annonces VO</h1>
          <p className="mt-1 text-sm text-neutral-400">
            {listings.length} annonce{listings.length !== 1 ? "s" : ""}
            {activeFilterCount > 0 && <span className="ml-1 text-rose-400">· {activeFilterCount} filtre{activeFilterCount > 1 ? "s" : ""} actif{activeFilterCount > 1 ? "s" : ""}</span>}
          </p>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-neutral-500">
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-neutral-500" />
              {regionStats.total.toLocaleString("fr-FR")} au total
            </span>
            {FOREIGN_REGIONS.filter((r) => regionStats.byRegion[r]).map((r) => {
              const FLAGS: Record<string, string> = {
                "Belgique": "🇧🇪", "Allemagne": "🇩🇪", "Pays-Bas": "🇳🇱",
                "Luxembourg": "🇱🇺", "Espagne": "🇪🇸", "Italie": "🇮🇹",
              };
              const SHORTS: Record<string, string> = {
                "Belgique": "BE", "Allemagne": "DE", "Pays-Bas": "NL",
                "Luxembourg": "LU", "Espagne": "ES", "Italie": "IT",
              };
              return (
                <span key={r} className="flex items-center gap-0.5">
                  {FLAGS[r]} {regionStats.byRegion[r].toLocaleString("fr-FR")} {SHORTS[r]}
                </span>
              );
            })}
          </div>
        </div>
        <Link
          href={csvHref}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-1.5 text-sm text-neutral-300 hover:border-neutral-600 hover:text-white"
        >
          <Download size={14} /> Export CSV
        </Link>
      </header>

      {freshSinceLast > 0 && !sinceLast && (
        <Link
          href="/listings?since_last=1"
          className="mb-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm text-rose-200 hover:border-rose-500/50"
        >
          <Sparkles size={14} />
          {freshSinceLast} annonce{freshSinceLast !== 1 ? "s" : ""} ajoutée{freshSinceLast !== 1 ? "s" : ""} depuis votre dernière visite — cliquez pour filtrer
        </Link>
      )}

      <SavedSearchesBar
        searches={savedSearches}
        currentParams={new URLSearchParams(Object.fromEntries(Object.entries(sp).filter(([,v]) => v != null && v !== "")) as Record<string,string>).toString()}
      />

      <form method="GET" className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        {sinceLast && <input type="hidden" name="since_last" value="1" />}

        {/* Toggle Voitures / Motos */}
        <div className="mb-3 pb-3 border-b border-[var(--border)] flex items-center gap-2">
          {[
            { value: "", label: "🚗 Voitures" },
            { value: "moto", label: "🏍️ Motos" },
          ].map(({ value, label }) => {
            const active = (sp.vehicle_type ?? "") === value;
            // Reset moto-specific params when switching
            const params = new URLSearchParams(
              Object.fromEntries(
                Object.entries(sp)
                  .filter(([k, v]) => k !== "vehicle_type" && k !== "moto_type" && k !== "min_cc" && k !== "max_cc" && k !== "body_type" && v != null && v !== "")
              ) as Record<string, string>
            );
            if (value) params.set("vehicle_type", value);
            return (
              <Link
                key={value}
                href={`/listings?${params.toString()}`}
                className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-rose-500 text-white shadow-sm"
                    : "border border-[var(--border)] text-neutral-400 hover:border-neutral-500 hover:text-white"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Presets rapides */}
        <div className="mb-3 pb-3 border-b border-[var(--border)] flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-neutral-500 mr-1">Recherche rapide :</span>
          {(isMoto ? [
            { label: "🔥 Pépites", params: { min_score: "85" } },
            { label: "🏁 Sportives", params: { moto_type: "sportive" } },
            { label: "🧭 Trails", params: { moto_type: "trail" } },
            { label: "⚡ Électriques", params: { fuel: "electrique" } },
            { label: "💰 <8k€", params: { max_price: "8000" } },
            { label: "🤝 Particuliers", params: { seller_kind: "particulier" } },
          ] : [
            { label: "🔥 Pépites", params: { min_score: "85" } },
            { label: "⚡ Électriques", params: { fuel: "electrique" } },
            { label: "💰 <15k€", params: { max_price: "15000" } },
            { label: "🚙 SUV récents", params: { body_type: "suv", min_year: "2019" } },
            { label: "🤝 Particuliers", params: { seller_kind: "particulier" } },
            { label: "🌍 Étranger", params: { country: "etranger" } },
          ]).map(({ label, params }) => {
            const newParams = new URLSearchParams(
              Object.fromEntries(
                Object.entries({ ...Object.fromEntries(Object.entries(sp).filter(([, v]) => v != null && v !== "")), ...params })
              ) as Record<string, string>
            );
            const isActive = Object.entries(params).every(([k, v]) => (sp as Record<string, string>)[k] === v);
            return (
              <Link
                key={label}
                href={`/listings?${newParams.toString()}`}
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                  isActive
                    ? "bg-rose-500/15 border border-rose-500/50 text-rose-300"
                    : "border border-[var(--border)] bg-[var(--background)] text-neutral-400 hover:border-neutral-500 hover:text-white"
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Filtre pays — pills visuels (voitures seulement, les motos sont uniquement FR) */}
        {!isMoto && (
          <div className="mb-3 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-medium text-neutral-500 mr-1">Pays :</span>
            {[
              { value: "", label: "Tous", flag: "🌍" },
              { value: "france", label: "France", flag: "🇫🇷" },
              { value: "etranger", label: "Étranger", flag: "🌐" },
              { value: "Belgique", label: "BE", flag: "🇧🇪" },
              { value: "Allemagne", label: "DE", flag: "🇩🇪" },
              { value: "Pays-Bas", label: "NL", flag: "🇳🇱" },
              { value: "Luxembourg", label: "LU", flag: "🇱🇺" },
              { value: "Espagne", label: "ES", flag: "🇪🇸" },
              { value: "Italie", label: "IT", flag: "🇮🇹" },
            ].map(({ value, label, flag }) => {
              const active = (sp.country ?? "") === value;
              const params = new URLSearchParams(
                Object.fromEntries(Object.entries(sp).filter(([k, v]) => k !== "country" && v != null && v !== "")) as Record<string, string>
              );
              if (value) params.set("country", value);
              return (
                <Link
                  key={value}
                  href={`/listings?${params.toString()}`}
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-rose-500 text-white"
                      : "border border-[var(--border)] bg-[var(--background)] text-neutral-400 hover:border-neutral-500 hover:text-white"
                  }`}
                >
                  {flag} {label}
                  {active && value && (
                    <span className="ml-0.5 opacity-70">×</span>
                  )}
                </Link>
              );
            })}
          </div>
        )}

        {/* Hidden vehicle_type to preserve across filter changes */}
        {isMoto && <input type="hidden" name="vehicle_type" value="moto" />}

        {/* Row 1 — search + brand + model? + carburant + carrosserie/type + score */}
        <div className={`grid grid-cols-1 gap-2 sm:grid-cols-2 ${sp.brand && models.length > 0 ? "md:grid-cols-6" : "md:grid-cols-5"}`}>
          <input
            name="search"
            defaultValue={sp.search ?? ""}
            placeholder={isMoto ? "Marque, modèle moto…" : "Marque, modèle…"}
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-rose-500 focus:outline-none sm:col-span-2 md:col-span-1"
          />
          <select name="brand" defaultValue={sp.brand ?? ""} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
            <option value="">Toutes marques</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          {sp.brand && models.length > 0 && (
            <select name="model" defaultValue={sp.model ?? ""} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <option value="">Tous modèles</option>
              {models.map((m) => <option key={m} value={m}>{m}</option>)}
            </select>
          )}
          <select name="fuel" defaultValue={sp.fuel ?? ""} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
            <option value="">Tous carburants</option>
            {FUELS.map((f) => <option key={f} value={f} className="capitalize">{f}</option>)}
          </select>
          {isMoto ? (
            <select name="moto_type" defaultValue={sp.moto_type ?? ""} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <option value="">Tous types</option>
              {MOTO_TYPES.map((t) => <option key={t} value={t} className="capitalize">{t}</option>)}
            </select>
          ) : (
            <select name="body_type" defaultValue={sp.body_type ?? ""} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              <option value="">Toutes carrosseries</option>
              {BODIES.map((b) => <option key={b} value={b} className="capitalize">{b}</option>)}
            </select>
          )}
          <select name="min_score" defaultValue={sp.min_score ?? "0"} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
            {SCORE_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Row 1b — cylindrée (motos seulement) */}
        {isMoto && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-neutral-500">Cylindrée :</span>
            {[
              { label: "Toutes", min: "", max: "" },
              { label: "< 125 cc", min: "", max: "125" },
              { label: "125–500 cc", min: "125", max: "500" },
              { label: "500–900 cc", min: "500", max: "900" },
              { label: "> 900 cc", min: "900", max: "" },
            ].map(({ label, min, max }) => {
              const active = (sp.min_cc ?? "") === min && (sp.max_cc ?? "") === max;
              const params = new URLSearchParams(
                Object.fromEntries(
                  Object.entries(sp).filter(([k, v]) => k !== "min_cc" && k !== "max_cc" && v != null && v !== "")
                ) as Record<string, string>
              );
              if (min) params.set("min_cc", min);
              if (max) params.set("max_cc", max);
              return (
                <Link
                  key={label}
                  href={`/listings?${params.toString()}`}
                  className={`rounded-full px-2.5 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "bg-rose-500/15 border border-rose-500/50 text-rose-300"
                      : "border border-[var(--border)] text-neutral-400 hover:border-neutral-500 hover:text-white"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>
        )}

        {/* Row 2 — localisation + année + km + prix + vendeur */}
        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-5">
          <select name="region" defaultValue={sp.region ?? ""} className={`rounded-lg border px-3 py-2 text-sm ${sp.region ? "border-rose-500/50 bg-rose-500/5" : "border-[var(--border)] bg-[var(--background)]"}`}>
            <option value="">Toutes régions</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <div className="flex gap-1">
            <select name="min_year" defaultValue={sp.min_year ?? ""} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm">
              <option value="">Année min</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select name="max_year" defaultValue={sp.max_year ?? ""} className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm">
              <option value="">Année max</option>
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <input
            name="max_km"
            type="number"
            min={0}
            step={10000}
            defaultValue={sp.max_km ?? ""}
            placeholder="Km max"
            className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
          />
          <div className="flex gap-1">
            <input
              name="min_price"
              type="number"
              min={0}
              step={500}
              defaultValue={sp.min_price ?? ""}
              placeholder="Prix min €"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm focus:border-rose-500 focus:outline-none"
            />
            <input
              name="max_price"
              type="number"
              min={0}
              step={500}
              defaultValue={sp.max_price ?? ""}
              placeholder="Prix max €"
              className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm focus:border-rose-500 focus:outline-none"
            />
          </div>
          <select name="seller_kind" defaultValue={sp.seller_kind ?? ""} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
            <option value="">Pro + particulier</option>
            <option value="pro">Professionnel</option>
            <option value="particulier">Particulier</option>
          </select>
        </div>

        {/* Row 3 — source + ZFE + options + tri + bouton */}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select name="source" defaultValue={sp.source ?? ""} className={`rounded-lg border px-3 py-2 text-sm ${sp.source ? "border-rose-500/50 bg-rose-500/5" : "border-[var(--border)] bg-[var(--background)]"}`}>
            <option value="">Toutes sources</option>
            {sources.map((s) => (
              <option key={s} value={s}>{
                s === "mobilede" ? "Mobile.de" :
                s === "marktplaats" ? "Marktplaats" :
                s === "autoscout24" ? "AutoScout24" :
                s === "autoscout24-moto" ? "AutoScout24 Moto" :
                s === "leboncoin" ? "LeBonCoin" :
                s === "leboncoin-moto" ? "LeBonCoin Moto" :
                s === "lacentrale" ? "La Centrale" :
                s === "lacentrale-moto" ? "La Centrale Moto" :
                s
              }</option>
            ))}
          </select>
          {/* Crit'Air + moteurs à risque : voitures uniquement */}
          {!isMoto && (
            <>
              <select name="max_critair" defaultValue={sp.max_critair ?? ""} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
                {ZFE_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
              <label className="flex items-center gap-2 text-sm text-neutral-300">
                <input type="checkbox" name="hide_risky" value="1" defaultChecked={sp.hide_risky === "1"} className="accent-rose-500" />
                Cacher moteurs à risque
              </label>
            </>
          )}
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input type="checkbox" name="since_last" value="1" defaultChecked={sinceLast} className="accent-rose-500" />
            Depuis ma dernière visite
          </label>
          <div className="ml-auto flex items-center gap-2">
            <select name="sort" defaultValue={sort} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {activeFilterCount > 0 && (
              <Link
                href={isMoto ? "/listings?vehicle_type=moto" : "/listings"}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-neutral-400 hover:text-white"
              >
                Réinitialiser
              </Link>
            )}
            <button type="submit" className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200">
              Filtrer
            </button>
          </div>
        </div>
      </form>

      {listings.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-10 text-center text-neutral-400">
          {sinceLast
            ? "Aucune nouvelle annonce depuis votre dernière visite. Revenez plus tard."
            : "Aucune annonce ne correspond à ces filtres."}
        </div>
      ) : (
        <ListingsWithBulk
          listings={listings}
          savedIds={Array.from(savedSet)}
          dealStatuses={Object.fromEntries(dealMap) as Record<string, import("@/lib/db").DealStatus>}
          prevVisit={prevVisit ?? null}
        />
      )}
    </div>
  );
}
