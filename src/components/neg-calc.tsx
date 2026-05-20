"use client";

import { useState, useTransition } from "react";
import { Calculator, Phone, Save } from "lucide-react";
import type { Listing } from "@/lib/types";
import { useToast } from "./toast";
import { fmtEUR } from "@/lib/utils";

export function NegotiationCalculator({
  listing,
  initialTarget,
  initialMax,
  initialNote,
}: {
  listing: Listing;
  initialTarget?: number | null;
  initialMax?: number | null;
  initialNote?: string | null;
}) {
  // Marge cible par défaut : 8% du prix vendeur (heuristique concession)
  const defaultMargin = Math.round(listing.price_eur * 0.08 / 100) * 100;
  const referencePrice = listing.comparables_median_eur ?? listing.market_value_eur;

  const [target, setTarget] = useState<number>(initialTarget ?? Math.max(1000, listing.price_eur - defaultMargin));
  const [marginNet, setMarginNet] = useState<number>(initialMax ? referencePrice - initialMax : defaultMargin + 1500);
  const [reconditioning, setReconditioning] = useState<number>(800);
  const [note, setNote] = useState<string>(initialNote ?? "");
  const [saving, startSave] = useTransition();
  const toast = useToast();

  // Prix d'achat max = cote/médiane - marge cible - reconditionnement
  const maxOffer = Math.max(0, referencePrice - marginNet - reconditioning);
  const discountVsAsked = Math.round(((listing.price_eur - target) / listing.price_eur) * 100);
  const headroomVsMax = maxOffer - target;

  const save = () => {
    startSave(async () => {
      try {
        const res = await fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listing_id: listing.id,
            status: "to_call",
            target_price_eur: target,
            max_offer_eur: maxOffer,
            note: note || null,
          }),
        });
        if (!res.ok) toast.show("error", "Erreur d'enregistrement");
        else toast.show("success", "Stratégie de négo sauvegardée");
      } catch {
        toast.show("error", "Erreur réseau");
      }
    });
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <h2 className="mb-4 flex items-center gap-2 font-semibold">
        <Calculator size={16} className="text-rose-400" />
        Calculateur de négociation
      </h2>

      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <Row label="Prix vendeur affiché" value={fmtEUR(listing.price_eur)} muted />
        <Row label="Référence (médiane comparables)" value={fmtEUR(referencePrice)} muted />
      </div>

      <div className="space-y-4">
        <Slider
          label="Prix d'offre initial"
          value={target}
          min={Math.max(0, listing.price_eur - listing.price_eur * 0.40)}
          max={listing.price_eur}
          step={100}
          onChange={setTarget}
          color="rose"
        >
          <span className="text-xs text-neutral-400">soit {discountVsAsked}% de remise vs prix affiché</span>
        </Slider>

        <Slider
          label="Marge nette visée (revente)"
          value={marginNet}
          min={500}
          max={Math.round(referencePrice * 0.20)}
          step={100}
          onChange={setMarginNet}
          color="emerald"
        />

        <Slider
          label="Budget reconditionnement (CT, mécanique, esthétique)"
          value={reconditioning}
          min={0}
          max={5000}
          step={100}
          onChange={setReconditioning}
          color="neutral"
        />
      </div>

      <div className="mt-5 grid gap-3 rounded-lg border border-rose-500/30 bg-rose-500/5 p-4 sm:grid-cols-3">
        <Stat label="Prix d'offre initial" value={fmtEUR(target)} accent="rose" />
        <Stat label="Prix d'achat max" value={fmtEUR(maxOffer)} accent={headroomVsMax >= 0 ? "emerald" : "rose"} />
        <Stat
          label="Marge si achat à max"
          value={fmtEUR(referencePrice - maxOffer - reconditioning)}
        />
      </div>

      {headroomVsMax >= 0 ? (
        <p className="mt-3 text-xs text-emerald-400">
          ✓ Offre initiale OK : tu peux remonter jusqu&rsquo;à {fmtEUR(maxOffer)} sans entamer ta marge.
        </p>
      ) : (
        <p className="mt-3 text-xs text-rose-400">
          ⚠ Offre initiale au-dessus de ton max : {fmtEUR(-headroomVsMax)} trop haut pour préserver la marge cible.
        </p>
      )}

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Notes pour le vendeur (point dur, argument, date à appeler…)"
        rows={2}
        className="mt-4 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
      />

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          onClick={save}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-400 disabled:opacity-50"
        >
          <Save size={14} /> Enregistrer + passer en "À appeler"
        </button>
        <a
          href="tel:"
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm hover:border-neutral-600"
        >
          <Phone size={14} /> Appeler
        </a>
      </div>
    </div>
  );
}

function Slider({ label, value, min, max, step, onChange, color, children }: {
  label: string; value: number; min: number; max: number; step: number;
  onChange: (v: number) => void;
  color: "rose" | "emerald" | "neutral";
  children?: React.ReactNode;
}) {
  const accent = color === "rose" ? "accent-rose-500" : color === "emerald" ? "accent-emerald-500" : "accent-neutral-400";
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <label className="text-xs uppercase tracking-wide text-neutral-400">{label}</label>
        <span className="font-mono text-sm tabular-nums">{fmtEUR(value)}</span>
      </div>
      <input
        type="range"
        min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`w-full ${accent}`}
      />
      {children}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-lg bg-[var(--background)] px-3 py-2 text-sm">
      <span className={muted ? "text-neutral-400" : ""}>{label}</span>
      <span className="font-mono tabular-nums">{value}</span>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "rose" | "emerald" }) {
  const c = accent === "rose" ? "text-rose-300" : accent === "emerald" ? "text-emerald-300" : "text-neutral-200";
  return (
    <div className="text-center">
      <div className="text-xs uppercase tracking-wide text-neutral-400">{label}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${c}`}>{value}</div>
    </div>
  );
}
