"use client";

import { useState, useTransition } from "react";
import { ShieldCheck, ExternalLink, CheckCircle2, XCircle, Minus, Car, AlertTriangle } from "lucide-react";
import type { Listing } from "@/lib/types";
import type { VehicleCheck } from "@/lib/db";
import { estimateCtStatus, buildCheckLinks, vehicleCheckScore, normalizePlate } from "@/lib/vehicle-check";
import { useToast } from "./toast";

type CheckValue = 0 | 1 | null;

const CHECKS: { key: keyof Pick<VehicleCheck, "ct_ok" | "accident_ok" | "docs_ok" | "body_ok" | "test_drive_ok">; label: string; hint: string }[] = [
  { key: "ct_ok", label: "Contrôle technique", hint: "CT valide, pas de points bloquants" },
  { key: "accident_ok", label: "Pas d'accident majeur", hint: "Rapport Histovec / Cartado vérifié" },
  { key: "docs_ok", label: "Documents complets", hint: "Carte grise, carnet entretien, factures" },
  { key: "body_ok", label: "Carrosserie / structure", hint: "Pas de déformation, trappe bien fermée, jeux normaux" },
  { key: "test_drive_ok", label: "Essai concluant", hint: "Aucun bruit anormal, boîte, freins OK" },
];

export function VehicleCheckPanel({
  listing,
  initial,
}: {
  listing: Listing;
  initial: VehicleCheck | null;
}) {
  const [plate, setPlate] = useState(initial?.plate ?? "");
  const [checks, setChecks] = useState<Record<string, CheckValue>>({
    ct_ok: initial?.ct_ok ?? null,
    accident_ok: initial?.accident_ok ?? null,
    docs_ok: initial?.docs_ok ?? null,
    body_ok: initial?.body_ok ?? null,
    test_drive_ok: initial?.test_drive_ok ?? null,
  });
  const [ownersCount, setOwnersCount] = useState(initial?.owners_count ?? "");
  const [lastCtKm, setLastCtKm] = useState(initial?.last_ct_km ?? "");
  const [note, setNote] = useState(initial?.note ?? "");
  const [saving, startSave] = useTransition();
  const [saved, setSaved] = useState(false);
  const toast = useToast();

  const ctStatus = estimateCtStatus(listing);
  const links = plate ? buildCheckLinks(plate, listing) : null;
  const normalizedPlate = plate ? normalizePlate(plate) : "";
  const scoreInfo = vehicleCheckScore(checks as Parameters<typeof vehicleCheckScore>[0]);

  const cycleCheck = (key: string) => {
    setChecks((p) => ({
      ...p,
      [key]: p[key] === null ? 1 : p[key] === 1 ? 0 : null,
    }));
  };

  const save = () => {
    startSave(async () => {
      try {
        const res = await fetch("/api/vehicle-check", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            listing_id: listing.id,
            plate: normalizedPlate || null,
            ...checks,
            owners_count: Number(ownersCount) || null,
            last_ct_km: Number(lastCtKm) || null,
            note: note || null,
          }),
        });
        if (res.ok) { setSaved(true); toast.show("success", "Vérification sauvegardée"); }
        else toast.show("error", "Erreur de sauvegarde");
      } catch {
        toast.show("error", "Erreur réseau");
      }
    });
  };

  const checkIcon = (val: CheckValue) =>
    val === 1 ? <CheckCircle2 size={16} className="text-emerald-400" /> :
    val === 0 ? <XCircle size={16} className="text-rose-400" /> :
    <Minus size={16} className="text-neutral-600" />;

  const checkBg = (val: CheckValue) =>
    val === 1 ? "border-emerald-500/40 bg-emerald-500/5" :
    val === 0 ? "border-rose-500/40 bg-rose-500/5" :
    "border-[var(--border)] bg-[var(--background)]";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <header className="mb-5 flex items-start justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <ShieldCheck size={16} className="text-sky-400" />
          Vérification véhicule
        </h2>
        {scoreInfo.score > 0 && (
          <span className={`text-sm font-medium ${scoreInfo.color}`}>
            {scoreInfo.label}
          </span>
        )}
      </header>

      {/* CT Status */}
      <div className={`mb-5 flex items-center gap-3 rounded-lg border p-3 ${
        ctStatus.color === "green" ? "border-emerald-500/30 bg-emerald-500/5" :
        ctStatus.color === "amber" ? "border-amber-500/30 bg-amber-500/5" :
        ctStatus.color === "red" ? "border-rose-500/30 bg-rose-500/5" :
        "border-[var(--border)] bg-[var(--background)]"
      }`}>
        <Car size={16} className={
          ctStatus.color === "green" ? "text-emerald-400" :
          ctStatus.color === "amber" ? "text-amber-400" :
          ctStatus.color === "red" ? "text-rose-400" : "text-neutral-400"
        } />
        <div>
          <div className="text-sm font-medium">{ctStatus.label}</div>
          <div className="text-xs text-neutral-500">Estimation basée sur l&apos;année d&apos;immatriculation {listing.year}</div>
        </div>
        {ctStatus.color === "red" && (
          <AlertTriangle size={14} className="ml-auto text-rose-400" />
        )}
      </div>

      {/* Plate input + links */}
      <div className="mb-5">
        <label className="mb-1.5 block text-xs uppercase tracking-wide text-neutral-400">
          Immatriculation (optionnel)
        </label>
        <div className="flex gap-2">
          <input
            type="text"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            placeholder="AB-123-CD"
            maxLength={9}
            className="w-32 rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm font-mono uppercase focus:border-sky-500 focus:outline-none"
          />
          {links && (
            <div className="flex flex-wrap gap-1.5">
              <a href={links.histovec} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs hover:border-sky-500 hover:text-sky-300">
                <ExternalLink size={11} /> Histovec
              </a>
              <a href={links.cartado} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs hover:border-sky-500 hover:text-sky-300">
                <ExternalLink size={11} /> Cartado
              </a>
              <a href={links.googlePlate} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs hover:border-neutral-500">
                <ExternalLink size={11} /> Google
              </a>
              <a href={links.fni} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-lg border border-[var(--border)] bg-[var(--background)] px-2.5 py-1.5 text-xs hover:border-neutral-500">
                <ExternalLink size={11} /> ANTS
              </a>
            </div>
          )}
        </div>
        {!plate && (
          <p className="mt-1.5 text-xs text-neutral-500">
            Entrez la plaque pour générer les liens Histovec / Cartado pré-remplis.
          </p>
        )}
      </div>

      {/* Checklist */}
      <div className="mb-5 space-y-2">
        <div className="mb-2 text-xs uppercase tracking-wide text-neutral-400">Checklist terrain</div>
        {CHECKS.map(({ key, label, hint }) => (
          <button
            key={key}
            type="button"
            onClick={() => cycleCheck(key)}
            className={`flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors ${checkBg(checks[key] as CheckValue)}`}
          >
            {checkIcon(checks[key] as CheckValue)}
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium">{label}</div>
              <div className="text-xs text-neutral-500">{hint}</div>
            </div>
          </button>
        ))}
        <p className="text-xs text-neutral-600">Cliquez pour basculer : gris → ✓ OK → ✗ KO → gris</p>
      </div>

      {/* Extra fields */}
      <div className="mb-5 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-400">
            Nb propriétaires
          </label>
          <input
            type="number"
            min={1} max={20}
            value={ownersCount}
            onChange={(e) => setOwnersCount(e.target.value)}
            placeholder="ex: 2"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-400">
            Km au dernier CT
          </label>
          <input
            type="number"
            min={0}
            value={lastCtKm}
            onChange={(e) => setLastCtKm(e.target.value)}
            placeholder="ex: 85000"
            className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
          />
        </div>
      </div>

      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Observations : état carrosserie, équipements manquants, négociation abordée…"
        rows={2}
        className="mb-4 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-sky-500 focus:outline-none"
      />

      <button
        onClick={save}
        disabled={saving}
        className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:opacity-50"
      >
        <ShieldCheck size={14} />
        {saving ? "Sauvegarde…" : saved ? "Sauvegardé ✓" : "Sauvegarder la vérification"}
      </button>
    </div>
  );
}
