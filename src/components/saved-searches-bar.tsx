"use client";
import Link from "next/link";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookmarkPlus, X, Bookmark } from "lucide-react";
import type { SavedSearch } from "@/lib/db";

export function SavedSearchesBar({
  searches,
  currentParams,
}: {
  searches: SavedSearch[];
  currentParams: string; // URLSearchParams string
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  const save = () => {
    if (!name.trim()) return;
    startTransition(async () => {
      await fetch("/api/saved-searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), params: currentParams }),
      });
      setSaving(false);
      setName("");
      router.refresh();
    });
  };

  const remove = (id: string) => {
    startTransition(async () => {
      await fetch(`/api/saved-searches?id=${id}`, { method: "DELETE" });
      router.refresh();
    });
  };

  if (searches.length === 0 && !currentParams) return null;

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      {searches.length > 0 && (
        <>
          <span className="flex items-center gap-1 text-xs text-neutral-500">
            <Bookmark size={11} /> Sauvegardées :
          </span>
          {searches.map((s) => (
            <div key={s.id} className="group flex items-center gap-0 rounded-full border border-[var(--border)] bg-[var(--background)] overflow-hidden">
              <Link
                href={`/listings?${s.params}`}
                className="px-2.5 py-1 text-xs text-neutral-300 hover:text-white transition"
              >
                {s.name}
              </Link>
              <button
                onClick={() => remove(s.id)}
                disabled={pending}
                className="pr-2 text-neutral-600 hover:text-rose-400 transition opacity-0 group-hover:opacity-100"
              >
                <X size={10} />
              </button>
            </div>
          ))}
        </>
      )}

      {/* Bouton sauvegarder */}
      {currentParams && (
        saving ? (
          <div className="flex items-center gap-1.5">
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && save()}
              placeholder="Nom de la recherche…"
              className="rounded-lg border border-rose-500/40 bg-[var(--background)] px-2.5 py-1 text-xs focus:outline-none"
            />
            <button onClick={save} disabled={!name.trim() || pending}
              className="rounded-lg bg-rose-500/20 border border-rose-500/30 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/30 disabled:opacity-40">
              ✓
            </button>
            <button onClick={() => setSaving(false)} className="text-neutral-500 hover:text-white text-xs">Annuler</button>
          </div>
        ) : (
          <button
            onClick={() => setSaving(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-neutral-700 px-2.5 py-1 text-xs text-neutral-500 hover:border-neutral-500 hover:text-neutral-300 transition"
          >
            <BookmarkPlus size={11} /> Sauvegarder cette recherche
          </button>
        )
      )}
    </div>
  );
}
