"use client";
import { useState, useTransition } from "react";
import { TrendingUp, TrendingDown, Save } from "lucide-react";
import { fmtEUR } from "@/lib/utils";

interface ROIData {
  price_eur_paid: number | null;
  fees_eur: number;
  price_sold_eur: number | null;
  sold_at: string | null;
}

export function ROITracker({
  listingId,
  listingPrice,
  initial,
}: {
  listingId: string;
  listingPrice: number;
  initial: ROIData;
}) {
  const [data, setData] = useState<ROIData>({
    price_eur_paid: initial.price_eur_paid ?? listingPrice,
    fees_eur: initial.fees_eur ?? 0,
    price_sold_eur: initial.price_sold_eur ?? null,
    sold_at: initial.sold_at ?? null,
  });
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  const totalCost = (data.price_eur_paid ?? 0) + (data.fees_eur ?? 0);
  const margin = data.price_sold_eur ? data.price_sold_eur - totalCost : null;
  const marginPct = margin !== null && totalCost > 0 ? Math.round((margin / totalCost) * 100) : null;

  const save = () => {
    startTransition(async () => {
      await fetch("/api/pipeline/roi", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, ...data }),
      });
      setSaved(true);
    });
  };

  return (
    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
      <div className="mb-4 flex items-center gap-2">
        <TrendingUp size={15} className="text-emerald-400" />
        <h2 className="font-semibold text-emerald-300">Suivi ROI</h2>
        {saved && <span className="ml-auto text-xs text-neutral-500">Sauvegardé ✓</span>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Prix payé (€)</span>
          <input
            type="number"
            value={data.price_eur_paid ?? ""}
            onChange={(e) => { setData({ ...data, price_eur_paid: e.target.value ? Number(e.target.value) : null }); setSaved(false); }}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-emerald-500/50 focus:outline-none"
            placeholder="Prix d'achat réel"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Frais totaux (€)</span>
          <input
            type="number"
            value={data.fees_eur}
            onChange={(e) => { setData({ ...data, fees_eur: Number(e.target.value) || 0 }); setSaved(false); }}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-emerald-500/50 focus:outline-none"
            placeholder="Transport + remise en état + CT..."
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Prix de revente (€)</span>
          <input
            type="number"
            value={data.price_sold_eur ?? ""}
            onChange={(e) => { setData({ ...data, price_sold_eur: e.target.value ? Number(e.target.value) : null }); setSaved(false); }}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-emerald-500/50 focus:outline-none"
            placeholder="Laisser vide si pas encore vendu"
          />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-neutral-500">Date de vente</span>
          <input
            type="date"
            value={data.sold_at ?? ""}
            onChange={(e) => { setData({ ...data, sold_at: e.target.value || null }); setSaved(false); }}
            className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-emerald-500/50 focus:outline-none"
          />
        </label>
      </div>

      {/* Résumé financier */}
      <div className="mt-4 rounded-lg bg-[var(--background)] p-3 text-sm">
        <div className="flex justify-between text-neutral-400">
          <span>Coût total acquisition</span>
          <span className="font-mono">{fmtEUR(totalCost)}</span>
        </div>
        {data.price_sold_eur && (
          <div className="flex justify-between text-neutral-400 mt-1">
            <span>Prix de revente</span>
            <span className="font-mono">{fmtEUR(data.price_sold_eur)}</span>
          </div>
        )}
        {margin !== null && (
          <div className={`flex justify-between mt-2 pt-2 border-t border-[var(--border)] font-semibold ${margin > 0 ? "text-emerald-400" : "text-rose-400"}`}>
            <span className="flex items-center gap-1">
              {margin > 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              Marge nette
            </span>
            <span className="font-mono">{fmtEUR(margin)} ({marginPct}%)</span>
          </div>
        )}
      </div>

      <button
        onClick={save}
        disabled={pending || saved}
        className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/20 border border-emerald-500/30 px-3 py-1.5 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30 disabled:opacity-40 transition"
      >
        <Save size={12} /> Sauvegarder
      </button>
    </div>
  );
}
