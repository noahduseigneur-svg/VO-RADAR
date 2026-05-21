"use client";

import { useState, useCallback } from "react";
import { Phone, Tag, Car, StickyNote, ArrowRight, Trash2 } from "lucide-react";
import { type DealActivity, type DealActivityType } from "@/lib/db";
import { fmtDate } from "@/lib/utils";

const ACTIVITY_META: Record<
  DealActivityType,
  { icon: React.ReactNode; label: string; color: string }
> = {
  call:          { icon: <Phone size={12} />,      label: "Appel",  color: "text-sky-400 bg-sky-500/15" },
  offer:         { icon: <Tag size={12} />,        label: "Offre",  color: "text-amber-400 bg-amber-500/15" },
  visit:         { icon: <Car size={12} />,        label: "Visite", color: "text-violet-400 bg-violet-500/15" },
  note:          { icon: <StickyNote size={12} />, label: "Note",   color: "text-neutral-300 bg-neutral-500/15" },
  status_change: { icon: <ArrowRight size={12} />, label: "Statut", color: "text-emerald-400 bg-emerald-500/15" },
};

const FORM_TYPES: DealActivityType[] = ["call", "offer", "visit", "note"];

interface Props {
  listingId: string;
  initialActivities?: DealActivity[];
}

export function DealActivityLog({ listingId, initialActivities = [] }: Props) {
  const [activities, setActivities] = useState<DealActivity[]>(initialActivities);
  const [type, setType] = useState<DealActivityType>("note");
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);

  const refetch = useCallback(async () => {
    const res = await fetch(`/api/deal-activities?listing_id=${encodeURIComponent(listingId)}`);
    if (res.ok) {
      const data: DealActivity[] = await res.json();
      setActivities(data);
    }
  }, [listingId]);

  const handleAdd = async () => {
    if (!content.trim()) return;
    setLoading(true);
    try {
      const res = await fetch("/api/deal-activities", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listing_id: listingId, type, content: content.trim() }),
      });
      if (res.ok) {
        setContent("");
        await refetch();
      }
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/deal-activities?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    if (res.ok) await refetch();
  };

  return (
    <details className="group text-xs">
      <summary className="cursor-pointer select-none list-none py-1 text-[11px] font-medium text-neutral-400 hover:text-neutral-200 flex items-center gap-1">
        <span className="transition group-open:rotate-90 inline-block">▶</span>
        Journal ({activities.length})
      </summary>

      <div className="mt-2 space-y-2">
        {/* Liste des activités */}
        {activities.length > 0 && (
          <ul className="space-y-1">
            {activities.map((a) => {
              const meta = ACTIVITY_META[a.type] ?? ACTIVITY_META.note;
              return (
                <li
                  key={a.id}
                  className="flex items-start gap-2 rounded-md border border-[var(--border)] bg-[var(--card)] px-2 py-1.5"
                >
                  <span className={`mt-0.5 flex items-center justify-center rounded p-0.5 ${meta.color}`}>
                    {meta.icon}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className={`rounded px-1 py-px text-[10px] font-medium ${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-neutral-500">{fmtDate(a.created_at)}</span>
                    </div>
                    <p className="mt-0.5 whitespace-pre-wrap break-words text-[11px] text-neutral-300">
                      {a.content}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDelete(a.id)}
                    className="mt-0.5 shrink-0 text-neutral-600 hover:text-rose-400 transition-colors"
                    aria-label="Supprimer"
                  >
                    <Trash2 size={11} />
                  </button>
                </li>
              );
            })}
          </ul>
        )}

        {/* Formulaire d'ajout */}
        <div className="rounded-md border border-[var(--border)] bg-[var(--card)] p-2 space-y-1.5">
          <div className="flex gap-1.5">
            <select
              value={type}
              onChange={(e) => setType(e.target.value as DealActivityType)}
              className="rounded border border-[var(--border)] bg-[var(--background)] px-1.5 py-1 text-[11px] text-neutral-200 focus:outline-none focus:ring-1 focus:ring-rose-500"
            >
              {FORM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {ACTIVITY_META[t].label}
                </option>
              ))}
            </select>
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Contenu de l'activité…"
            rows={2}
            className="w-full resize-none rounded border border-[var(--border)] bg-[var(--background)] px-2 py-1 text-[11px] text-neutral-200 placeholder-neutral-600 focus:outline-none focus:ring-1 focus:ring-rose-500"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={loading || !content.trim()}
            className="rounded bg-rose-500 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-rose-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "…" : "Ajouter"}
          </button>
        </div>
      </div>
    </details>
  );
}
