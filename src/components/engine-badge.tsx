import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, Sparkles } from "lucide-react";
import type { ReliabilityRating } from "@/lib/types";

export function EngineBadge({ rating, compact = false }: { rating: ReliabilityRating; compact?: boolean }) {
  const m = MAP[rating];
  if (!m || rating === "unknown") return null;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full text-[10px] font-medium ring-1 ring-inset px-1.5 py-0.5 ${m.cls}`}
      title={m.title}
    >
      {m.icon}
      {!compact && <span>{m.label}</span>}
    </span>
  );
}

const MAP: Record<ReliabilityRating, { label: string; title: string; icon: React.ReactNode; cls: string } | null> = {
  excellent: { label: "Moteur top", title: "Motorisation réputée excellente", icon: <Sparkles size={10} />, cls: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30" },
  good:      { label: "Moteur fiable", title: "Motorisation fiable", icon: <CheckCircle2 size={10} />, cls: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30" },
  average:   { label: "Moteur OK", title: "Motorisation moyenne — entretien crucial", icon: <CheckCircle2 size={10} />, cls: "bg-sky-500/10 text-sky-400 ring-sky-500/30" },
  risky:     { label: "À surveiller", title: "Motorisation à risque connu — inspection obligatoire", icon: <AlertTriangle size={10} />, cls: "bg-amber-500/10 text-amber-400 ring-amber-500/30" },
  avoid:     { label: "À éviter", title: "Motorisation avec issue critique connue — risque élevé de casse", icon: <XCircle size={10} />, cls: "bg-rose-500/10 text-rose-400 ring-rose-500/30" },
  unknown:   { label: "Moteur ?", title: "Pas de profil moteur connu", icon: <HelpCircle size={10} />, cls: "bg-neutral-500/10 text-neutral-400 ring-neutral-500/30" },
};
