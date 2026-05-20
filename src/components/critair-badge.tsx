import type { CritAirClass } from "@/lib/types";

const COLORS: Record<string, string> = {
  "0":  "bg-emerald-500 text-white",
  "1":  "bg-violet-500 text-white",
  "2":  "bg-amber-500 text-white",
  "3":  "bg-orange-500 text-white",
  "4":  "bg-rose-500 text-white",
  "5":  "bg-rose-700 text-white",
  "-1": "bg-neutral-600 text-white",
};

export function CritAirBadge({ value, compact = false }: { value: CritAirClass; compact?: boolean }) {
  const key = String(value);
  const label = value === -1 ? "NC" : String(value);
  const title = value === 0 ? "Crit'Air 0 — Électrique, autorisé partout"
    : value === 1 ? "Crit'Air 1 — ZFE OK partout"
    : value === 2 ? "Crit'Air 2 — Autorisé Paris/IDF"
    : value === 3 ? "Crit'Air 3 — Banni Paris/IDF"
    : value === 4 ? "Crit'Air 4 — Banni des grandes ZFE"
    : value === 5 ? "Crit'Air 5 — Banni partout"
    : "Non classé Crit'Air";

  return (
    <span
      className={`inline-flex h-5 min-w-[1.25rem] items-center justify-center rounded text-[10px] font-bold tabular-nums ${COLORS[key] ?? "bg-neutral-600 text-white"}`}
      title={title}
    >
      {compact ? label : `Crit'Air ${label}`}
    </span>
  );
}
