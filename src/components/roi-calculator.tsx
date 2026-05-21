"use client";
import { useState } from "react";
import { TrendingUp } from "lucide-react";

const PLANS_PRICE = { independant: 49, concession: 99, reseau: 199 };

export function RoiCalculator() {
  const [vehicles, setVehicles] = useState(8);
  const [margin, setMargin] = useState(900);
  const [plan, setPlan] = useState<keyof typeof PLANS_PRICE>("concession");

  const planPrice = PLANS_PRICE[plan];
  const totalMargin = vehicles * margin;
  const roi = Math.round(totalMargin / planPrice);
  const breakEven = (planPrice / margin).toFixed(1);

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6 md:p-8">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-emerald-500/15 text-emerald-400">
          <TrendingUp size={18} />
        </span>
        <div>
          <div className="font-semibold text-white">Calculez votre ROI</div>
          <div className="text-xs text-neutral-500">Ajustez selon votre activité</div>
        </div>
      </div>

      <div className="space-y-5">
        {/* Véhicules / mois */}
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <label className="text-neutral-400">Véhicules sourcés / mois</label>
            <span className="font-semibold text-white tabular-nums">{vehicles}</span>
          </div>
          <input
            type="range" min={1} max={50} value={vehicles}
            onChange={(e) => setVehicles(Number(e.target.value))}
            className="w-full accent-rose-500 cursor-pointer"
          />
          <div className="mt-1 flex justify-between text-xs text-neutral-600">
            <span>1</span><span>25</span><span>50</span>
          </div>
        </div>

        {/* Marge cible */}
        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <label className="text-neutral-400">Marge nette cible / véhicule</label>
            <span className="font-semibold text-white tabular-nums">{margin.toLocaleString("fr-FR")} €</span>
          </div>
          <input
            type="range" min={300} max={3000} step={100} value={margin}
            onChange={(e) => setMargin(Number(e.target.value))}
            className="w-full accent-rose-500 cursor-pointer"
          />
          <div className="mt-1 flex justify-between text-xs text-neutral-600">
            <span>300 €</span><span>1 500 €</span><span>3 000 €</span>
          </div>
        </div>

        {/* Plan */}
        <div>
          <div className="mb-2 text-sm text-neutral-400">Votre plan</div>
          <div className="flex gap-2">
            {(["independant", "concession", "reseau"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPlan(p)}
                className={`flex-1 rounded-lg border px-2 py-2 text-xs font-medium transition-colors ${
                  plan === p
                    ? "border-rose-500/50 bg-rose-500/10 text-rose-300"
                    : "border-[var(--border)] text-neutral-400 hover:border-neutral-600"
                }`}
              >
                {p === "independant" ? "Indépendant" : p === "concession" ? "Concession" : "Réseau"}
                <div className="mt-0.5 text-[10px] opacity-70">{PLANS_PRICE[p]} €/mois</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Résultats */}
      <div className="mt-6 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-white tabular-nums">
              {totalMargin.toLocaleString("fr-FR")} €
            </div>
            <div className="mt-1 text-xs text-neutral-500">marge mensuelle</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-emerald-400 tabular-nums">
              {roi}×
            </div>
            <div className="mt-1 text-xs text-neutral-500">ROI mensuel</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-white tabular-nums">
              {breakEven}
            </div>
            <div className="mt-1 text-xs text-neutral-500">véhicule pour rentabiliser</div>
          </div>
        </div>
        <div className="mt-4 rounded-lg bg-emerald-500/10 px-4 py-2.5 text-center text-sm">
          <span className="text-emerald-300 font-medium">
            Sur {vehicles} véhicules/mois, votre abonnement est rentabilisé dès le {breakEven} véhicule.
          </span>
        </div>
      </div>
    </div>
  );
}
