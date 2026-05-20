"use client";

import { useState, useTransition } from "react";
import { Check, ChevronDown, Eye, Phone, Handshake, Award, X, Trash2 } from "lucide-react";
import type { DealStatus } from "@/lib/db";
import { useToast } from "./toast";

const STATUSES: { value: DealStatus; label: string; icon: React.ReactNode; cls: string }[] = [
  { value: "watching",    label: "À surveiller",  icon: <Eye size={12} />,       cls: "bg-neutral-700/60 text-neutral-200 ring-neutral-600" },
  { value: "to_call",     label: "À appeler",     icon: <Phone size={12} />,     cls: "bg-amber-500/15 text-amber-300 ring-amber-500/30" },
  { value: "negotiating", label: "En négo",       icon: <Handshake size={12} />, cls: "bg-violet-500/15 text-violet-300 ring-violet-500/30" },
  { value: "won",         label: "Acheté",        icon: <Award size={12} />,     cls: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30" },
  { value: "lost",        label: "Perdu",         icon: <X size={12} />,         cls: "bg-rose-500/15 text-rose-300 ring-rose-500/30" },
];

const BY_VALUE = Object.fromEntries(STATUSES.map((s) => [s.value, s]));

export function DealStatusButton({ listingId, initial, compact = false }: { listingId: string; initial: DealStatus | null; compact?: boolean }) {
  const [status, setStatus] = useState<DealStatus | null>(initial);
  const [open, setOpen] = useState(false);
  const [busy, start] = useTransition();
  const toast = useToast();

  const current = status ? BY_VALUE[status] : null;

  const change = (next: DealStatus | null) => {
    setOpen(false);
    const prev = status;
    setStatus(next);
    start(async () => {
      try {
        const res = await fetch("/api/pipeline", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next ? { listing_id: listingId, status: next } : { listing_id: listingId, clear: true }),
        });
        if (!res.ok) {
          setStatus(prev);
          toast.show("error", "Échec de la mise à jour");
        } else {
          toast.show("success", next ? `Statut: ${BY_VALUE[next].label}` : "Statut retiré");
        }
      } catch {
        setStatus(prev);
        toast.show("error", "Erreur réseau");
      }
    });
  };

  if (compact) {
    return current ? (
      <span className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium ring-1 ring-inset ${current.cls}`}>
        {current.icon}
        {current.label}
      </span>
    ) : null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        disabled={busy}
        className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition ${current ? current.cls : "bg-[var(--background)] text-neutral-400 ring-[var(--border)] hover:text-neutral-200"}`}
      >
        {current?.icon}
        {current?.label ?? "Statut deal"}
        <ChevronDown size={11} />
      </button>
      {open && (
        <>
          <button onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default" aria-label="Close" />
          <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-[var(--border)] bg-[var(--card)] p-1 shadow-2xl">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => change(s.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--background)]"
              >
                <span className={`inline-flex h-5 w-5 items-center justify-center rounded ${s.cls}`}>{s.icon}</span>
                <span className="flex-1">{s.label}</span>
                {status === s.value && <Check size={11} className="text-emerald-400" />}
              </button>
            ))}
            {status && (
              <>
                <div className="my-1 border-t border-[var(--border)]" />
                <button
                  onClick={() => change(null)}
                  className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs text-rose-400 hover:bg-rose-500/10"
                >
                  <Trash2 size={11} /> Retirer
                </button>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export function dealStatusMeta(s: DealStatus) {
  return BY_VALUE[s];
}
