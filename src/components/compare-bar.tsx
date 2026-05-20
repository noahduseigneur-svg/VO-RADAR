"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, GitCompare, X } from "lucide-react";

interface CompareCtx {
  selected: string[];
  toggle: (id: string) => void;
  clear: () => void;
}

const Ctx = createContext<CompareCtx | null>(null);

const STORAGE_KEY = "vo-radar:compare";

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setSelected(JSON.parse(stored) as string[]);
    } catch { /* ignore */ }
  }, []);

  const persist = (next: string[]) => {
    setSelected(next);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
  };

  const toggle = useCallback((id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : prev.length >= 4 ? prev : [...prev, id];
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* ignore */ }
      return next;
    });
  }, []);

  const clear = useCallback(() => persist([]), []);

  return (
    <Ctx.Provider value={{ selected, toggle, clear }}>
      {children}
      {selected.length >= 2 && <CompareBar selected={selected} clear={clear} />}
    </Ctx.Provider>
  );
}

function CompareBar({ selected, clear }: { selected: string[]; clear: () => void }) {
  return (
    <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 transform">
      <div className="flex items-center gap-3 rounded-full border border-rose-500/40 bg-[var(--card)]/95 px-4 py-2.5 shadow-2xl backdrop-blur">
        <GitCompare size={14} className="text-rose-400" />
        <span className="text-sm font-medium">{selected.length} sélectionnées</span>
        <Link
          href={`/compare?ids=${selected.join(",")}`}
          className="inline-flex items-center gap-1.5 rounded-full bg-rose-500 px-3 py-1 text-xs font-medium text-white hover:bg-rose-400"
        >
          Comparer <ArrowRight size={12} />
        </Link>
        <button onClick={clear} className="text-neutral-400 hover:text-white" aria-label="Tout retirer">
          <X size={14} />
        </button>
      </div>
    </div>
  );
}

export function useCompare(): CompareCtx {
  return useContext(Ctx) ?? { selected: [], toggle: () => {}, clear: () => {} };
}

export function CompareCheckbox({ listingId }: { listingId: string }) {
  const { selected, toggle } = useCompare();
  const isSelected = selected.includes(listingId);
  const disabled = !isSelected && selected.length >= 4;

  return (
    <label
      className={`group/check inline-flex cursor-pointer items-center gap-1.5 rounded-md px-1.5 py-0.5 text-[10px] transition ${
        isSelected ? "bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40" : "text-neutral-500 hover:bg-neutral-800 hover:text-neutral-300"
      } ${disabled ? "cursor-not-allowed opacity-40" : ""}`}
      onClick={(e) => e.stopPropagation()}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={() => toggle(listingId)}
        disabled={disabled}
        className="h-3 w-3 accent-rose-500"
      />
      Comparer
    </label>
  );
}
