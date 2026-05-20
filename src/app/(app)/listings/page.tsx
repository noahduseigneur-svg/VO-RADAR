import Link from "next/link";
import { Download, Sparkles } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { dealStatusMapForListings, getDistinctRegions, getUserState, queryListings, recordListingsView, getBrands, getSavedListingIds, countFreshSince } from "@/lib/db";
import type { ListingSort } from "@/lib/db";
import { ListingCard } from "@/components/listing-card";

const FUELS = ["essence", "diesel", "hybride", "electrique", "gpl"];
const BODIES = ["citadine", "berline", "break", "suv", "monospace", "cabriolet", "coupe"];
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
    brand?: string; fuel?: string; body_type?: string; min_score?: string;
    max_price?: string; min_price?: string; search?: string; hide_risky?: string;
    max_critair?: string; since_last?: string; region?: string;
    max_km?: string; min_year?: string; max_year?: string;
    seller_kind?: string; sort?: string;
  }>;
}) {
  const user = await requireUser();
  const sp = await props.searchParams;

  const state = await getUserState(user.id);
  const prevVisit = state.last_listings_view;
  await recordListingsView(user.id);

  const sinceLast = sp.since_last === "1";
  const sort = (SORT_OPTIONS.find((o) => o.value === sp.sort)?.value) ?? "score_desc";

  const filters = {
    brand: sp.brand,
    fuel: sp.fuel,
    body_type: sp.body_type,
    min_score: sp.min_score ? Number(sp.min_score) : 0,
    max_price: sp.max_price ? Number(sp.max_price) : undefined,
    min_price: sp.min_price ? Number(sp.min_price) : undefined,
    max_mileage: sp.max_km ? Number(sp.max_km) : undefined,
    min_year: sp.min_year ? Number(sp.min_year) : undefined,
    max_year: sp.max_year ? Number(sp.max_year) : undefined,
    region: sp.region || undefined,
    seller_kind: sp.seller_kind || undefined,
    search: sp.search,
    hide_risky_engines: sp.hide_risky === "1",
    max_critair: sp.max_critair ? Number(sp.max_critair) : undefined,
    sort,
    limit: 60,
  };
  let listings = await queryListings(filters);
  if (sinceLast && prevVisit) {
    listings = listings.filter((l) => l.fetched_at > prevVisit);
  }

  const [brands, regions, savedSet, dealMap] = await Promise.all([
    getBrands(),
    getDistinctRegions(),
    getSavedListingIds(user.id),
    dealStatusMapForListings(user.id, listings.map((l) => l.id)),
  ]);

  const csvHref = "/api/export/csv?" + new URLSearchParams(
    Object.fromEntries(Object.entries(sp).filter(([, v]) => v != null && v !== "")) as Record<string, string>
  ).toString();

  const freshSinceLast = prevVisit ? await countFreshSince(prevVisit) : 0;

  const activeFilterCount = [
    sp.brand, sp.fuel, sp.body_type, sp.region, sp.seller_kind,
    sp.max_km, sp.min_year, sp.max_year, sp.max_price, sp.min_price,
    sp.min_score && sp.min_score !== "0" ? sp.min_score : null,
    sp.hide_risky === "1" ? "1" : null,
    sp.max_critair,
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

      <form method="GET" className="mb-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
        {sinceLast && <input type="hidden" name="since_last" value="1" />}

        {/* Row 1 — search + brand + carburant + carrosserie + score */}
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          <input
            name="search"
            defaultValue={sp.search ?? ""}
            placeholder="Marque, modèle…"
            className="col-span-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-rose-500 focus:outline-none md:col-span-1"
          />
          <select name="brand" defaultValue={sp.brand ?? ""} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
            <option value="">Toutes marques</option>
            {brands.map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
          <select name="fuel" defaultValue={sp.fuel ?? ""} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
            <option value="">Tous carburants</option>
            {FUELS.map((f) => <option key={f} value={f} className="capitalize">{f}</option>)}
          </select>
          <select name="body_type" defaultValue={sp.body_type ?? ""} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
            <option value="">Toutes carrosseries</option>
            {BODIES.map((b) => <option key={b} value={b} className="capitalize">{b}</option>)}
          </select>
          <select name="min_score" defaultValue={sp.min_score ?? "0"} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
            {SCORE_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>

        {/* Row 2 — localisation + année + km + prix + vendeur */}
        <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-5">
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

        {/* Row 3 — ZFE + options + tri + bouton */}
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <select name="max_critair" defaultValue={sp.max_critair ?? ""} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
            {ZFE_TIERS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input type="checkbox" name="hide_risky" value="1" defaultChecked={sp.hide_risky === "1"} className="accent-rose-500" />
            Cacher moteurs à risque
          </label>
          <label className="flex items-center gap-2 text-sm text-neutral-300">
            <input type="checkbox" name="since_last" value="1" defaultChecked={sinceLast} className="accent-rose-500" />
            Depuis ma dernière visite
          </label>
          <div className="ml-auto flex items-center gap-2">
            <select name="sort" defaultValue={sort} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
              {SORT_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            {activeFilterCount > 0 && (
              <Link href="/listings" className="rounded-lg border border-[var(--border)] px-3 py-2 text-sm text-neutral-400 hover:text-white">
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
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {listings.map((l) => (
            <ListingCard
              key={l.id}
              listing={l}
              savedInitial={savedSet.has(l.id)}
              dealStatus={dealMap.get(l.id) ?? null}
              isNew={prevVisit ? l.fetched_at > prevVisit : false}
            />
          ))}
        </div>
      )}
    </div>
  );
}
