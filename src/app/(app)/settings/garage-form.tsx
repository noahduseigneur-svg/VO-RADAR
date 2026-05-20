"use client";

import { useState, useTransition } from "react";
import type { GarageProfile } from "@/lib/margin";
import { fmtEUR } from "@/lib/utils";
import { useToast } from "@/components/toast";

export function GarageSettingsForm({ initial }: { initial: GarageProfile }) {
  const [form, setForm] = useState<GarageProfile>(initial);
  const [saving, startSave] = useTransition();
  const toast = useToast();

  const set = (k: keyof GarageProfile) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((p) => ({ ...p, [k]: Number(e.target.value) }));

  const save = () => {
    startSave(async () => {
      try {
        const res = await fetch("/api/settings/garage", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(form),
        });
        if (res.ok) toast.show("success", "Profil financier sauvegardé");
        else toast.show("error", "Erreur d'enregistrement");
      } catch {
        toast.show("error", "Erreur réseau");
      }
    });
  };

  const fields: { key: keyof GarageProfile; label: string; hint: string; max: number }[] = [
    { key: "transport_eur", label: "Transport (€)", hint: "Convoyage / livraison par véhicule", max: 1000 },
    { key: "recon_base_eur", label: "Reconditionnement base (€)", hint: "Minimum de remise en état (nettoyage, vérif.)", max: 1000 },
    { key: "recon_per_year_eur", label: "Surcoût recon par an d'âge (€)", hint: "Ex : 80€ × 5 ans = 400€ supplémentaires", max: 300 },
    { key: "recon_per_10k_km_eur", label: "Surcoût recon par 10 000 km > 50k (€)", hint: "Ex : 50€ × (150k – 50k) / 10k = 500€", max: 200 },
    { key: "prep_ct_eur", label: "Préparation + CT (€)", hint: "Révision pré-vente + contrôle technique", max: 800 },
    { key: "fixed_costs_eur", label: "Frais fixes par véhicule (€)", hint: "Overhead : parking, assurance stock, admin", max: 1000 },
    { key: "target_margin_eur", label: "Marge cible (€)", hint: "Marge brute minimale pour valider un achat", max: 5000 },
  ];

  // Preview total cost
  const previewRecon = form.recon_base_eur + 3 * form.recon_per_year_eur + 5 * form.recon_per_10k_km_eur;
  const previewTotal = form.transport_eur + previewRecon + form.prep_ct_eur + form.fixed_costs_eur;

  return (
    <div>
      <div className="grid gap-5 sm:grid-cols-2">
        {fields.map(({ key, label, hint, max }) => (
          <div key={key}>
            <div className="mb-1 flex items-baseline justify-between">
              <label className="text-sm font-medium">{label}</label>
              <span className="font-mono text-sm tabular-nums text-rose-400">{fmtEUR(form[key])}</span>
            </div>
            <input
              type="range"
              min={0}
              max={max}
              step={10}
              value={form[key]}
              onChange={set(key)}
              className="w-full accent-rose-500"
            />
            <p className="mt-1 text-xs text-neutral-500">{hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-lg border border-[var(--border)] bg-[var(--background)] p-4 text-sm">
        <div className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Simulation — véhicule 3 ans, 100k km</div>
        <div className="flex flex-wrap gap-4">
          <span>Transport : <strong>{fmtEUR(form.transport_eur)}</strong></span>
          <span>Recon : <strong>{fmtEUR(previewRecon)}</strong></span>
          <span>Prépa/CT : <strong>{fmtEUR(form.prep_ct_eur)}</strong></span>
          <span>Frais fixes : <strong>{fmtEUR(form.fixed_costs_eur)}</strong></span>
          <span className="text-rose-400 font-semibold">Total coûts : {fmtEUR(previewTotal)}</span>
        </div>
      </div>

      <button
        onClick={save}
        disabled={saving}
        className="mt-5 inline-flex items-center gap-2 rounded-lg bg-rose-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-rose-400 disabled:opacity-50"
      >
        {saving ? "Enregistrement…" : "Enregistrer le profil"}
      </button>
    </div>
  );
}
