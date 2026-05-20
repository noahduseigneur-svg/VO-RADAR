"use client";

import { useState, useTransition } from "react";
import { Bookmark, BookmarkCheck } from "lucide-react";

export function SaveButton({ listingId, initial }: { listingId: string; initial: boolean }) {
  const [saved, setSaved] = useState(initial);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !saved;
    setSaved(next);
    startTransition(async () => {
      try {
        const res = await fetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listing_id: listingId }),
        });
        if (!res.ok) setSaved(!next);
        else {
          const data = await res.json();
          setSaved(Boolean(data.saved));
        }
      } catch {
        setSaved(!next);
      }
    });
  };

  return (
    <button
      onClick={toggle}
      disabled={pending}
      aria-label={saved ? "Retirer des favoris" : "Sauvegarder"}
      title={saved ? "Sauvegardé" : "Sauvegarder"}
      className={`rounded-lg p-1.5 transition ${saved ? "text-rose-400 hover:bg-rose-500/10" : "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-200"}`}
    >
      {saved ? <BookmarkCheck size={16} /> : <Bookmark size={16} />}
    </button>
  );
}
