"use client";
import { useState } from "react";
import { Calculator } from "lucide-react";

interface Props {
  price: number;
  region?: string | null;
  year?: number | null;
  mileage?: number | null;
}

function defaultCG(region: string | null | undefined): number {
  if (!region) return 800;
  const idf = ["Île-de-France", "Paris", "Hauts-de-Seine", "Seine-Saint-Denis", "Val-de-Marne", "Val-d'Oise", "Seine-et-Marne", "Yvelines", "Essonne"];
  return idf.some((r) => region.toLowerCase().includes(r.toLowerCase())) ? 1500 : 800;
}

function fmtEUR(n: number) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);
}

export function CostCalculator({ price, region, year: _year, mileage: _mileage }: Props) {
  const [transport, setTransport] = useState(300);
  const [recon, setRecon] = useState(500);
  const [cg, setCg] = useState(defaultCG(region));
  const [margin, setMargin] = useState(1000);

  const total = price + transport + recon + cg;
  const resale = total + margin;

  return (
    <section className="mt-6 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
      <div className="mb-4 flex items-center gap-2">
        <Calculator size={15} className="text-rose-400" />
        <h2 className="font-semibold">Calculateur frais d&apos;acquisition</h2>
      </div>
      <div className="space-y-2 text-sm">
        <Row label="Prix demandé" value={fmtEUR(price)} readOnly />
        <EditableRow label="Transport" value={transport} onChange={setTransport} />
        <EditableRow label="Remise en état estimée" value={recon} onChange={setRecon} />
        <EditableRow label="Carte grise estimée" value={cg} onChange={setCg} />
        <div className="my-2 border-t border-[var(--border)]" />
        <Row label="Total revient" value={fmtEUR(total)} highlight />
        <EditableRow label="Marge cible" value={margin} onChange={setMargin} accent="emerald" />
        <Row label="Prix de revente cible" value={fmtEUR(resale)} highlight accent="emerald" />
      </div>
    </section>
  );
}

function Row({ label, value, readOnly = false, highlight = false, accent }: {
  label: string; value: string; readOnly?: boolean; highlight?: boolean; accent?: string;
}) {
  const color = accent === "emerald" ? "text-emerald-400" : highlight ? "text-white" : "text-neutral-200";
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-neutral-400">{label}</span>
      <span className={`font-medium tabular-nums ${color}`}>{value}</span>
    </div>
  );
}

function EditableRow({ label, value, onChange, accent }: {
  label: string; value: number; onChange: (v: number) => void; accent?: string;
}) {
  const inputColor = accent === "emerald" ? "focus:border-emerald-500/50" : "focus:border-rose-500/50";
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-neutral-400">{label}</span>
      <div className="flex items-center gap-1">
        <input
          type="number"
          value={value}
          onChange={(e) => onChange(Math.max(0, Number(e.target.value)))}
          className={`w-24 rounded border border-[var(--border)] bg-[var(--background)] px-2 py-0.5 text-right text-sm tabular-nums ${inputColor} focus:outline-none`}
        />
        <span className="text-neutral-500 text-xs">€</span>
      </div>
    </div>
  );
}
