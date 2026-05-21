import Link from "next/link";
import { fmtEUR, fmtKm } from "@/lib/utils";
import type { Listing } from "@/lib/types";

export function SimilarListings({
  listings,
  currentPrice,
}: {
  listings: Listing[];
  currentPrice: number;
}) {
  if (listings.length === 0) return null;

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <h2 className="mb-1 font-semibold">Annonces similaires</h2>
      <p className="mb-4 text-xs text-neutral-500">Même modèle — les plus proches en prix</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {listings.map((l) => {
          const priceDiff = l.price_eur - currentPrice;
          return (
            <Link
              key={l.id}
              href={`/listings/${l.id}`}
              className="block rounded-lg border border-[var(--border)] bg-[var(--background)] overflow-hidden transition hover:border-neutral-600"
            >
              <div className="h-24 bg-neutral-800 overflow-hidden">
                {l.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={l.photo_url}
                    alt={`${l.brand} ${l.model}`}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-neutral-800">
                    <span className="text-neutral-600 text-lg font-bold">
                      {l.brand?.slice(0, 2).toUpperCase()}
                    </span>
                  </div>
                )}
              </div>
              <div className="p-3">
                <div className="text-sm font-medium truncate">
                  {l.brand} {l.model}
                </div>
                <div className="text-xs text-neutral-400 mt-0.5">
                  {l.year} · {fmtKm(l.mileage_km)}
                </div>
                <div className="mt-2 flex items-center justify-between gap-1">
                  <span className="font-semibold text-sm tabular-nums">
                    {fmtEUR(l.price_eur)}
                  </span>
                  <span
                    className={`text-xs font-medium tabular-nums ${
                      priceDiff > 0 ? "text-rose-400" : "text-emerald-400"
                    }`}
                  >
                    {priceDiff > 0 ? "+" : ""}
                    {fmtEUR(priceDiff)}
                  </span>
                </div>
                <div
                  className={`mt-0.5 text-[10px] ${
                    l.delta_eur > 0 ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  {l.delta_eur > 0 ? "Sous cote" : "Sur cote"} {Math.abs(l.delta_pct)}%
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      <p className="mt-3 text-xs text-neutral-500">
        Prix comparés à cette annonce ({fmtEUR(currentPrice)}) · différence en +/−
      </p>
    </div>
  );
}
