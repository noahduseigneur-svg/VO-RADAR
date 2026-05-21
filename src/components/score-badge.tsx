import { cn, scoreColor, scoreLabel } from "@/lib/utils";

function ScoreGauge({ score, size = 44 }: { score: number; size?: number }) {
  const r = size * 0.4;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const color =
    score >= 85 ? "#10b981" :
    score >= 70 ? "#84cc16" :
    score >= 50 ? "#f59e0b" : "#f43f5e";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="#262626" strokeWidth={size * 0.09}
        />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth={size * 0.09}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
        />
      </svg>
      <span
        className="absolute font-bold tabular-nums"
        style={{ fontSize: size * 0.28, color }}
      >
        {score}
      </span>
    </div>
  );
}

export function ScoreBadge({ score, withLabel = true }: { score: number; withLabel?: boolean }) {
  if (!withLabel) {
    // Version compacte pour les espaces restreints (pipeline, etc.)
    return (
      <span
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
          scoreColor(score),
        )}
      >
        <span className="font-mono tabular-nums">{score}</span>
      </span>
    );
  }

  // Version complète avec gauge SVG
  return (
    <div className="inline-flex items-center gap-2">
      <ScoreGauge score={score} size={44} />
      <span className="text-xs font-medium text-neutral-400">{scoreLabel(score)}</span>
    </div>
  );
}
