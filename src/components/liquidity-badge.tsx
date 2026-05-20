import { Clock, Zap } from "lucide-react";
import type { Listing } from "@/lib/types";
import { estimateLiquidity } from "@/lib/liquidity";

export function LiquidityBadge({ listing }: { listing: Listing }) {
  const liq = estimateLiquidity(listing);

  const bgCls =
    liq.tier === "fast" ? "bg-emerald-500/15 ring-emerald-500/30" :
    liq.tier === "normal" ? "bg-lime-500/15 ring-lime-500/30" :
    liq.tier === "slow" ? "bg-amber-500/15 ring-amber-500/30" :
    "bg-rose-500/15 ring-rose-500/30";

  const Icon = liq.tier === "fast" ? Zap : Clock;

  return (
    <span
      title={liq.explanation}
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset ${bgCls} ${liq.color}`}
    >
      <Icon size={11} />
      {liq.label} · ~{liq.days_estimate}j
    </span>
  );
}
