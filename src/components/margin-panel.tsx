"use client";

import { useState, useTransition } from "react";
import { TrendingUp, Euro, Truck, Wrench, Settings, Save, AlertTriangle, CheckCircle } from "lucide-react";
import type { Listing } from "@/lib/types";
import type { GarageProfile } from "@/lib/margin";
import { computeMargin, estimateReconditioning } from "@/lib/margin";
import { fmtEUR } from "@/lib/utils";
import { useToast } from "./toast";

export function MarginPanel({
  listing,
  profile,
}: {
  listing: Listing;
  profile: GarageProfile;
}) {
  const reconDefault = estimateReconditioning(listing, profile);
  const [recon, setRecon] = useState(reconDefault);
  const [saving, startSave] = useTransition();
  const toast = useToast();

  const result = computeMargin(listing, profile, recon);

  const save = () => {
    startSave(async () => {
      try {
        const res = await fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listing_id: listing.id,
            status: "to_call",
            target_price_eur: result.max_buy_price_eur,
            max_offer_eur: result.max_buy_price_eur,
          }),
        });
        if (res.ok) toast.show("success", "Ajouté au pipeline — prix max enregistré");
        else toast.show("error", "Erreur d'enregistrement");
      } catch {
        toast.show("error", "Erreur réseau");
      }
    });
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <header className="mb-5 flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <TrendingUp size={16} className="text-emerald-400" />
          Calculateur de marge
        </h2>
        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset
          ${result.verdict === "excellent" ? "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" :
            result.verdict === "good" ? "bg-lime-500/15 text-lime-300 ring-lime-500/30" :
            result.verdict === "tight" ? "bg-amber-500/15 text-amber-300 ring-amber-500/30" :
            "bg-rose-500/15 text-rose-300 ring-rose-500/30"}`}
        >
          {result.verdict === "loss" ? <AlertTriangle size={11} /> : <CheckCircle size={11} />}
          {result.verdict_label}
        </span>
      </header>

      {/* Main verdict */}
      <div className="mb-5 grid gap-3 sm:grid-cols-4">
        <MiniCard
          label="Prix achat"
          value={fmtEUR(result.buy_price_eur)}
          icon={<Euro size={12} />}
        />
        <MiniCard
          label="Prix de revient"
          value={fmtEUR(result.revient_eur)}
          icon={<Settings size={12} />}
          muted
        />
        <MiniCard
          label="Prix de vente estimé"
          value={fmtEUR(result.sell_price_eur)}
          icon={<TrendingUp size={12} />}
          accent="blue"
        />
        <MiniCard
          label="Marge brute"
          value={fmtEUR(result.gross_margin_eur)}
          icon={result.meets_target ? <CheckCircle size={12} /> : <AlertTriangle size={12} />}
          accent={result.verdict === "excellent" ? "emerald" : result.verdict === "good" ? "lime" : result.verdict === "tight" ? "amber" : "rose"}
        />
      </div>

      {/* Breakdown */}
      <div className="mb-5 rounded-lg bg-[var(--background)] p-3">
        <div className="mb-2 text-[11px] uppercase tracking-wide text-neutral-400">Décomposition des coûts</div>
        <div className="space-y-1.5 text-sm">
          <CostRow icon={<Euro size={12} />} label="Prix d'achat" value={fmtEUR(result.buy_price_eur)} />
          <CostRow icon={<Truck size={12} />} label="Transport" value={`+ ${fmtEUR(result.transport_eur)}`} muted />
          <CostRow
            icon={<Wrench size={12} />}
            label={`Reconditionnement estimé${listing.engine_rating === "risky" ? " ⚠" : listing.engine_rating === "avoid" ? " ⛔" : ""}`}
            value={`+ ${fmtEUR(result.recon_est_eur)}`}
            muted
          />
          <CostRow icon={<Settings size={12} />} label="Prépa + CT" value={`+ ${fmtEUR(result.prep_ct_eur)}`} muted />
          <CostRow icon={<Settings size={12} />} label="Frais fixes" value={`+ ${fmtEUR(result.fixed_costs_eur)}`} muted />
          <div className="border-t border-[var(--border)] pt-1.5">
            <CostRow label="Prix de revient total" value={fmtEUR(result.revient_eur)} bold />
          </div>
          <div className="border-t border-[var(--border)] pt-1.5">
            <CostRow label="Prix de vente estimé (cote marché)" value={fmtEUR(result.sell_price_eur)} />
            <CostRow
              label="= Marge brute"
              value={`${result.gross_margin_eur >= 0 ? "+" : ""}${fmtEUR(result.gross_margin_eur)}`}
              accent={result.gross_margin_eur >= 0 ? "emerald" : "rose"}
              bold
            />
          </div>
        </div>
      </div>

      {/* Recon slider */}
      <div className="mb-5">
        <div className="mb-1.5 flex items-baseline justify-between">
          <label className="text-xs uppercase tracking-wide text-neutral-400">
            Reconditionnement (ajustable)
          </label>
          <span className="font-mono text-sm tabular-nums">{fmtEUR(recon)}</span>
        </div>
        <input
          type="range"
          min={0}
          max={8000}
          step={100}
          value={recon}
          onChange={(e) => setRecon(Number(e.target.value))}
          className="w-full accent-emerald-500"
        />
        {listing.engine_rating === "avoid" && (
          <p className="mt-1 text-xs text-rose-400">⛔ Moteur à risque élevé — surcoût de 1 500€ inclus dans l&apos;estimation</p>
        )}
        {listing.engine_rating === "risky" && (
          <p className="mt-1 text-xs text-amber-400">⚠ Moteur risqué — surcoût de 800€ inclus dans l&apos;estimation</p>
        )}
      </div>

      {/* Max buy price */}
      <div className={`mb-4 rounded-lg p-4 ${result.meets_target ? "border border-emerald-500/30 bg-emerald-500/5" : "border border-rose-500/30 bg-rose-500/5"}`}>
        <div className="text-xs uppercase tracking-wide text-neutral-400 mb-1">
          Prix d&apos;achat maximum (pour atteindre {fmtEUR(profile.target_margin_eur)} de marge)
        </div>
        <div className={`text-3xl font-semibold tabular-nums ${result.meets_target ? "text-emerald-300" : "text-rose-300"}`}>
          {fmtEUR(result.max_buy_price_eur)}
        </div>
        {result.meets_target ? (
          <p className="mt-1 text-xs text-emerald-400">
            ✓ Prix actuel sous le max — tu peux négocier jusqu&apos;à {fmtEUR(listing.price_eur - result.max_buy_price_eur)} de remise supplémentaire.
          </p>
        ) : (
          <p className="mt-1 text-xs text-rose-400">
            ✗ Prix actuel {fmtEUR(listing.price_eur - result.max_buy_price_eur)} au-dessus du max — marge insuffisante sans négociation.
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
        >
          <Save size={14} />
          Sauvegarder + pipeline "À appeler"
        </button>
        <a
          href={`/listings/${listing.id}/print`}
          target="_blank"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm hover:border-neutral-600"
        >
          🖨 Imprimer la fiche
        </a>
      </div>
    </div>
  );
}

function MiniCard({ label, value, icon, accent, muted }: {
  label: string; value: string;
  icon?: React.ReactNode;
  accent?: "emerald" | "lime" | "amber" | "rose" | "blue";
  muted?: boolean;
}) {
  const textColor =
    accent === "emerald" ? "text-emerald-300" :
    accent === "lime" ? "text-lime-300" :
    accent === "amber" ? "text-amber-300" :
    accent === "rose" ? "text-rose-300" :
    accent === "blue" ? "text-sky-300" :
    muted ? "text-neutral-400" : "text-neutral-200";
  return (
    <div className="rounded-lg bg-[var(--background)] p-3">
      <div className="flex items-center gap-1 text-[11px] uppercase tracking-wide text-neutral-500 mb-0.5">
        {icon}{label}
      </div>
      <div className={`text-lg font-semibold tabular-nums ${textColor}`}>{value}</div>
    </div>
  );
}

function CostRow({ label, value, icon, muted, accent, bold }: {
  label: string; value: string;
  icon?: React.ReactNode;
  muted?: boolean;
  accent?: "emerald" | "rose";
  bold?: boolean;
}) {
  const textColor =
    accent === "emerald" ? "text-emerald-400" :
    accent === "rose" ? "text-rose-400" :
    muted ? "text-neutral-500" : "text-neutral-200";
  return (
    <div className={`flex items-center justify-between ${bold ? "font-medium" : ""}`}>
      <span className={`flex items-center gap-1.5 ${muted ? "text-neutral-500" : "text-neutral-300"}`}>
        {icon}{label}
      </span>
      <span className={`font-mono tabular-nums text-sm ${textColor}`}>{value}</span>
    </div>
  );
}
