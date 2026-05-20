import { fmtEUR } from "@/lib/utils";

interface Point { price_eur: number; observed_at: string; }

export function PriceSparkline({ points, height = 80 }: { points: Point[]; height?: number }) {
  if (points.length === 0) return <div className="text-xs text-neutral-500">Pas d&rsquo;historique de prix encore.</div>;
  if (points.length === 1) {
    return <div className="text-xs text-neutral-500">Prix stable depuis le {new Date(points[0].observed_at).toLocaleDateString("fr-FR")} : {fmtEUR(points[0].price_eur)}</div>;
  }

  const min = Math.min(...points.map((p) => p.price_eur));
  const max = Math.max(...points.map((p) => p.price_eur));
  const range = max - min || 1;
  const W = 600;
  const H = height;
  const stepX = W / (points.length - 1);
  const path = points
    .map((p, i) => {
      const x = i * stepX;
      const y = H - ((p.price_eur - min) / range) * (H - 10) - 5;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const last = points[points.length - 1];
  const first = points[0];
  const delta = last.price_eur - first.price_eur;

  return (
    <div className="w-full">
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="h-20 w-full">
        <path d={path} fill="none" stroke={delta < 0 ? "#34d399" : delta > 0 ? "#fb7185" : "#a3a3a3"} strokeWidth="2" />
        {points.map((p, i) => {
          const x = i * stepX;
          const y = H - ((p.price_eur - min) / range) * (H - 10) - 5;
          return <circle key={i} cx={x} cy={y} r="2.5" fill={delta < 0 ? "#34d399" : delta > 0 ? "#fb7185" : "#a3a3a3"} />;
        })}
      </svg>
      <div className="mt-1 flex justify-between text-xs text-neutral-500">
        <span>{new Date(first.observed_at).toLocaleDateString("fr-FR")} · {fmtEUR(first.price_eur)}</span>
        <span className={delta < 0 ? "text-emerald-400" : delta > 0 ? "text-rose-400" : ""}>
          {delta === 0 ? "Stable" : `${delta > 0 ? "+" : ""}${fmtEUR(delta)}`}
        </span>
        <span>{new Date(last.observed_at).toLocaleDateString("fr-FR")} · {fmtEUR(last.price_eur)}</span>
      </div>
    </div>
  );
}
