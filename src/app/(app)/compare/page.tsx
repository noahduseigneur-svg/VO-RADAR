import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Check, Minus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getListing } from "@/lib/db";
import { fmtEUR, fmtKm, fmtDate } from "@/lib/utils";
import { ScoreBadge } from "@/components/score-badge";
import { EngineBadge } from "@/components/engine-badge";
import { CritAirBadge } from "@/components/critair-badge";

export default async function ComparePage(props: { searchParams: Promise<{ ids?: string }> }) {
  await requireUser();
  const { ids } = await props.searchParams;
  const listingIds = (ids ?? "").split(",").filter(Boolean).slice(0, 4);
  if (listingIds.length < 2) notFound();

  const listingResults = await Promise.all(listingIds.map((id) => getListing(id)));
  const listings = listingResults.filter((l): l is NonNullable<typeof l> => l !== null);
  if (listings.length < 2) notFound();

  // Compute "best" per row to highlight
  const bestPrice = Math.min(...listings.map((l) => l.price_eur));
  const bestScore = Math.max(...listings.map((l) => l.score));
  const bestKm = Math.min(...listings.map((l) => l.mileage_km));
  const bestYear = Math.max(...listings.map((l) => l.year));

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <Link href="/listings" className="mb-4 inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white">
        <ArrowLeft size={14} /> Retour aux annonces
      </Link>
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Comparaison côte à côte</h1>
        <p className="mt-1 text-sm text-neutral-400">{listings.length} annonces · meilleur sur chaque ligne mis en vert</p>
      </header>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] border-separate border-spacing-0 text-sm">
          <thead>
            <tr>
              <th className="sticky left-0 bg-[var(--background)] py-3 pr-4 text-left text-xs uppercase tracking-wide text-neutral-500">Critère</th>
              {listings.map((l) => (
                <th key={l.id} className="border-b border-[var(--border)] px-4 py-3 text-left">
                  <Link href={`/listings/${l.id}`} className="hover:underline">
                    <div className="font-semibold">{l.brand} {l.model}</div>
                    <div className="text-xs text-neutral-400">{l.version}</div>
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <Row label="Prix" cells={listings.map((l) => ({ value: fmtEUR(l.price_eur), best: l.price_eur === bestPrice }))} />
            <Row label="Cote modèle" cells={listings.map((l) => ({ value: fmtEUR(l.market_value_eur) }))} />
            <Row label="Delta vs cote" cells={listings.map((l) => ({ value: `${l.delta_pct > 0 ? "+" : ""}${l.delta_pct}%`, accent: l.delta_pct > 0 ? "emerald" : "rose" }))} />
            <Row label="Année" cells={listings.map((l) => ({ value: String(l.year), best: l.year === bestYear }))} />
            <Row label="Kilométrage" cells={listings.map((l) => ({ value: fmtKm(l.mileage_km), best: l.mileage_km === bestKm }))} />
            <Row label="Carburant" cells={listings.map((l) => ({ value: l.fuel, capitalize: true }))} />
            <Row label="Boîte" cells={listings.map((l) => ({ value: l.gearbox, capitalize: true }))} />
            <Row label="Puissance" cells={listings.map((l) => ({ value: l.power_hp ? `${l.power_hp} ch` : "—" }))} />
            <Row label="Carrosserie" cells={listings.map((l) => ({ value: l.body_type, capitalize: true }))} />
            <Row label="Motorisation" cells={listings.map((l) => ({ value: l.engine_designation ?? "—", mono: true }))} />
            <Row label="Fiabilité moteur" cells={listings.map((l) => ({ component: <EngineBadge rating={l.engine_rating} /> }))} />
            <Row label="Crit'Air" cells={listings.map((l) => ({ component: <CritAirBadge value={l.critair} /> }))} />
            <Row label="Score VO Radar" cells={listings.map((l) => ({ component: <ScoreBadge score={l.score} />, best: l.score === bestScore }))} />
            <Row label="Vendeur" cells={listings.map((l) => ({ value: l.seller_kind, capitalize: true }))} />
            <Row label="Région" cells={listings.map((l) => ({ value: l.region ?? "—" }))} />
            <Row label="Publiée" cells={listings.map((l) => ({ value: fmtDate(l.posted_at) }))} />
            <Row label="Comparables" cells={listings.map((l) => ({ value: l.comparables_n > 0 ? `${l.comparables_n} (médiane ${l.comparables_median_eur ? fmtEUR(l.comparables_median_eur) : "?"})` : "—" }))} />
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface CellSpec {
  value?: string;
  component?: React.ReactNode;
  best?: boolean;
  accent?: "emerald" | "rose";
  capitalize?: boolean;
  mono?: boolean;
}

function Row({ label, cells }: { label: string; cells: CellSpec[] }) {
  return (
    <tr>
      <td className="sticky left-0 border-b border-[var(--border)] bg-[var(--background)] py-2.5 pr-4 text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </td>
      {cells.map((c, i) => (
        <td
          key={i}
          className={`border-b border-[var(--border)] px-4 py-2.5 ${
            c.best ? "bg-emerald-500/10 font-medium text-emerald-300" : ""
          } ${c.accent === "emerald" ? "text-emerald-400" : c.accent === "rose" ? "text-rose-400" : ""} ${c.mono ? "font-mono text-xs" : ""} ${c.capitalize ? "capitalize" : ""}`}
        >
          {c.component ?? c.value ?? <Minus size={12} className="text-neutral-600" />}
          {c.best && <Check size={11} className="ml-1.5 inline text-emerald-400" />}
        </td>
      ))}
    </tr>
  );
}
