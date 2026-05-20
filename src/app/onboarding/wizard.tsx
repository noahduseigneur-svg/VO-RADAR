"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Bell, CheckCircle, ChevronRight, SkipForward } from "lucide-react";

const FUELS = ["essence", "diesel", "hybride", "electrique", "gpl"] as const;
const SCORE_OPTIONS = [
  { label: "Toutes les annonces", value: 0 },
  { label: "Correctes (50+)", value: 50 },
  { label: "Bonnes affaires (70+)", value: 70 },
  { label: "Pépites uniquement (85+)", value: 85 },
];

interface Props {
  userId: string;
  dealershipName: string;
  brands: string[];
}

export function OnboardingWizard({ dealershipName, brands }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [saving, startSave] = useTransition();

  // Alerte form state
  const [alertName, setAlertName] = useState("Ma première alerte");
  const [brand, setBrand] = useState("");
  const [model, setModel] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [fuel, setFuel] = useState("");
  const [minScore, setMinScore] = useState(70);
  const [skipAlert, setSkipAlert] = useState(false);

  const totalSteps = 3;

  const complete = () => {
    startSave(async () => {
      const alertPayload = !skipAlert && (brand || maxPrice) ? {
        name: alertName || "Ma première alerte",
        brand: brand || null,
        model: model || null,
        max_price_eur: maxPrice ? Number(maxPrice) : null,
        fuel: fuel || null,
        min_score: minScore,
      } : null;

      await fetch("/api/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alert: alertPayload }),
      });

      router.push("/listings");
      router.refresh();
    });
  };

  return (
    <div className="w-full max-w-lg">
      {/* Logo */}
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-rose-600">
          <Search size={22} className="text-white" />
        </div>
        <span className="text-xl font-bold tracking-tight">VO Radar</span>
      </div>

      {/* Barre de progression */}
      <div className="mb-8 flex gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <div
            key={i}
            className={`h-1 flex-1 rounded-full transition-colors ${
              i <= step ? "bg-rose-500" : "bg-neutral-800"
            }`}
          />
        ))}
      </div>

      {/* Étape 1 — Bienvenue */}
      {step === 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
          <h1 className="mb-2 text-2xl font-bold">
            Bienvenue, {dealershipName} 👋
          </h1>
          <p className="mb-8 text-neutral-400">
            VO Radar surveille en permanence les grandes plateformes pour détecter
            les bonnes affaires VO avant vos concurrents.
          </p>

          <div className="mb-8 space-y-5">
            <Feature
              icon="🔍"
              title="Agrégation multi-sources"
              desc="AutoScout24, La Centrale, LeBonCoin, BCA et plus — tout en un seul endroit."
            />
            <Feature
              icon="📊"
              title="Score automatique 0–100"
              desc="Chaque annonce est scorée selon le prix marché, le kilométrage, la fiabilité moteur et la liquidité."
            />
            <Feature
              icon="🔔"
              title="Alertes en temps réel"
              desc="Recevez un email dès qu'une annonce correspond à vos critères."
            />
          </div>

          <button
            onClick={() => setStep(1)}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-3 font-semibold text-white hover:bg-rose-700"
          >
            Commencer <ChevronRight size={18} />
          </button>
        </div>
      )}

      {/* Étape 2 — Première alerte */}
      {step === 1 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
          <div className="mb-1 flex items-center gap-2">
            <Bell size={18} className="text-rose-500" />
            <h2 className="text-xl font-bold">Créer votre première alerte</h2>
          </div>
          <p className="mb-6 text-sm text-neutral-400">
            VO Radar vous prévient dès qu'une annonce correspondante apparaît.
            Vous pouvez en ajouter d'autres plus tard.
          </p>

          {!skipAlert ? (
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-400">
                  Nom de l'alerte
                </label>
                <input
                  value={alertName}
                  onChange={(e) => setAlertName(e.target.value)}
                  className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Marque
                  </label>
                  <select
                    value={brand}
                    onChange={(e) => { setBrand(e.target.value); setModel(""); }}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  >
                    <option value="">Toutes</option>
                    {brands.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Modèle
                  </label>
                  <input
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    placeholder="ex: Clio, Golf…"
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Budget max (€)
                  </label>
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="ex: 15000"
                    min={0}
                    step={500}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-rose-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-neutral-400">
                    Carburant
                  </label>
                  <select
                    value={fuel}
                    onChange={(e) => setFuel(e.target.value)}
                    className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm"
                  >
                    <option value="">Tous</option>
                    {FUELS.map((f) => <option key={f} value={f} className="capitalize">{f}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-xs font-medium uppercase tracking-wide text-neutral-400">
                  Score minimum
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {SCORE_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setMinScore(o.value)}
                      className={`rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                        minScore === o.value
                          ? "border-rose-500 bg-rose-500/10 text-rose-300"
                          : "border-[var(--border)] text-neutral-400 hover:border-neutral-600"
                      }`}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4 text-sm text-neutral-400">
              Pas d'alerte pour l'instant — vous pourrez en créer depuis <strong className="text-neutral-300">/alertes</strong>.
            </div>
          )}

          <div className="mt-6 flex items-center gap-3">
            <button
              onClick={() => setSkipAlert(!skipAlert)}
              className="flex items-center gap-1.5 text-sm text-neutral-500 hover:text-neutral-300"
            >
              <SkipForward size={14} />
              {skipAlert ? "Créer une alerte" : "Passer cette étape"}
            </button>
            <button
              onClick={() => setStep(2)}
              className="ml-auto flex items-center gap-2 rounded-xl bg-rose-600 px-6 py-2.5 font-semibold text-white hover:bg-rose-700"
            >
              Continuer <ChevronRight size={18} />
            </button>
          </div>
        </div>
      )}

      {/* Étape 3 — C'est parti */}
      {step === 2 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-500/15">
            <CheckCircle size={32} className="text-green-400" />
          </div>
          <h2 className="mb-2 text-2xl font-bold">Tout est prêt !</h2>
          <p className="mb-8 text-neutral-400">
            VO Radar va maintenant scraper les plateformes et scorer les annonces.
            {!skipAlert && (brand || maxPrice)
              ? " Votre alerte est configurée — vous serez notifié par email dès qu'une opportunité apparaît."
              : " Explorez les annonces et créez vos premières alertes depuis le menu."}
          </p>

          <div className="mb-8 grid grid-cols-3 gap-4 text-center">
            <Stat value="9" label="sources" />
            <Stat value="70+" label="marques" />
            <Stat value="<5min" label="délai détection" />
          </div>

          <button
            onClick={complete}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-6 py-3 font-semibold text-white hover:bg-rose-700 disabled:opacity-60"
          >
            {saving ? "Configuration…" : "Voir les annonces →"}
          </button>
        </div>
      )}
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="flex gap-4">
      <span className="mt-0.5 text-2xl">{icon}</span>
      <div>
        <p className="font-medium">{title}</p>
        <p className="text-sm text-neutral-400">{desc}</p>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--background)] py-3">
      <div className="text-xl font-bold text-rose-400">{value}</div>
      <div className="text-xs text-neutral-500">{label}</div>
    </div>
  );
}
