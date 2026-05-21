"use client";
import { useState, useTransition } from "react";
import { StickyNote, Save, Trash2 } from "lucide-react";

export function ListingNote({ listingId, initial }: { listingId: string; initial: string | null }) {
  const [note, setNote] = useState(initial ?? "");
  const [saved, setSaved] = useState(!!initial);
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, note }),
      });
      setSaved(true);
    });
  };

  const clear = () => {
    setNote("");
    setSaved(false);
    startTransition(async () => {
      await fetch("/api/notes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, note: "" }),
      });
    });
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="mb-3 flex items-center gap-2">
        <StickyNote size={15} className="text-amber-400" />
        <h2 className="font-semibold">Notes privées</h2>
        {saved && note && <span className="ml-auto text-xs text-neutral-500">Sauvegardé ✓</span>}
      </div>
      <textarea
        value={note}
        onChange={(e) => { setNote(e.target.value); setSaved(false); }}
        placeholder="Carrosserie ok, moteur à vérifier, recontacter après le 20..."
        rows={3}
        className="w-full resize-none rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-amber-500/50 focus:outline-none placeholder:text-neutral-600"
      />
      <div className="mt-2 flex gap-2">
        <button
          onClick={save}
          disabled={pending || saved || !note.trim()}
          className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/20 border border-amber-500/30 px-3 py-1.5 text-xs font-medium text-amber-300 hover:bg-amber-500/30 disabled:opacity-40 transition"
        >
          <Save size={12} /> Sauvegarder
        </button>
        {note && (
          <button
            onClick={clear}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-neutral-400 hover:text-white transition"
          >
            <Trash2 size={12} /> Effacer
          </button>
        )}
      </div>
    </div>
  );
}
