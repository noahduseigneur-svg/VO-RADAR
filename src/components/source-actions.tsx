"use client";

import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Power, PowerOff, Trash2 } from "lucide-react";

export function SourceActions({ id, enabled }: { id: string; enabled: boolean }) {
  const router = useRouter();
  const [busy, start] = useTransition();
  const [isEnabled, setEnabled] = useState(enabled);

  const toggle = () => start(async () => {
    const next = !isEnabled;
    setEnabled(next);
    const res = await fetch("/api/sources", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, enabled: next }),
    });
    if (!res.ok) setEnabled(!next);
    router.refresh();
  });

  const remove = () => {
    if (!confirm("Supprimer cette source ?")) return;
    start(async () => {
      await fetch(`/api/sources?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      router.refresh();
    });
  };

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={toggle}
        disabled={busy}
        className={`rounded-lg p-2 transition ${isEnabled ? "text-emerald-400 hover:bg-emerald-500/10" : "text-neutral-500 hover:bg-neutral-800"}`}
        title={isEnabled ? "Désactiver" : "Activer"}
      >
        {busy ? <Loader2 size={14} className="animate-spin" /> : isEnabled ? <Power size={14} /> : <PowerOff size={14} />}
      </button>
      <button
        onClick={remove}
        disabled={busy}
        className="rounded-lg p-2 text-neutral-500 hover:bg-rose-500/10 hover:text-rose-400"
        title="Supprimer"
      >
        <Trash2 size={14} />
      </button>
    </div>
  );
}
