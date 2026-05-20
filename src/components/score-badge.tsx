import { cn, scoreColor, scoreLabel } from "@/lib/utils";

export function ScoreBadge({ score, withLabel = true }: { score: number; withLabel?: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
        scoreColor(score),
      )}
    >
      <span className="font-mono tabular-nums">{score}</span>
      {withLabel && <span className="opacity-80">{scoreLabel(score)}</span>}
    </span>
  );
}
