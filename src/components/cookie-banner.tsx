"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Cookie } from "lucide-react";

type Consent = { necessary: true; analytics: boolean };

const KEY = "vo_cookie_consent";

function getStored(): Consent | null {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Consent) : null;
  } catch { return null; }
}

export function CookieBanner() {
  const [visible, setVisible] = useState(false);
  const [showDetail, setShowDetail] = useState(false);

  useEffect(() => {
    if (!getStored()) setVisible(true);
  }, []);

  const save = (analytics: boolean) => {
    const consent: Consent = { necessary: true, analytics };
    localStorage.setItem(KEY, JSON.stringify(consent));
    // Persist choice in a 1-year cookie for server-side reading if needed
    document.cookie = `${KEY}=${JSON.stringify(consent)};max-age=${365 * 86400};path=/;SameSite=Lax`;
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Gestion des cookies"
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-xl rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 shadow-2xl sm:left-auto sm:right-6 sm:max-w-sm"
    >
      <div className="flex items-start gap-3">
        <Cookie size={20} className="mt-0.5 shrink-0 text-rose-400" />
        <div className="min-w-0">
          <p className="text-sm font-medium">Gestion des cookies</p>
          <p className="mt-1 text-xs text-neutral-400">
            Nous utilisons des cookies nécessaires au fonctionnement du service et,
            avec votre accord, des cookies analytiques anonymisés pour améliorer l&rsquo;expérience.{" "}
            <Link href="/legal/privacy" className="underline hover:text-white">En savoir plus</Link>
          </p>

          {showDetail && (
            <div className="mt-3 space-y-2 rounded-lg border border-[var(--border)] bg-[var(--background)] p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="font-medium">Nécessaires</span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-emerald-400">Toujours actifs</span>
              </div>
              <p className="text-neutral-500">Authentification, préférences interface. Durée : session.</p>
              <div className="flex items-center justify-between pt-1">
                <span className="font-medium">Analytiques</span>
                <span className="text-neutral-500">Anonymisés, sans publicité</span>
              </div>
              <p className="text-neutral-500">Statistiques d&rsquo;usage agrégées pour améliorer le service.</p>
            </div>
          )}

          <div className="mt-4 flex flex-wrap gap-2">
            <button
              onClick={() => save(true)}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-neutral-900 hover:bg-neutral-200"
            >
              Tout accepter
            </button>
            <button
              onClick={() => save(false)}
              className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-500 hover:text-white"
            >
              Nécessaires uniquement
            </button>
            <button
              onClick={() => setShowDetail((v) => !v)}
              className="px-2 py-1.5 text-xs text-neutral-500 hover:text-neutral-300"
            >
              {showDetail ? "Masquer" : "Personnaliser"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function CookieSettingsLink() {
  const reset = () => {
    localStorage.removeItem(KEY);
    document.cookie = `${KEY}=;max-age=0;path=/`;
    window.location.reload();
  };
  return (
    <button onClick={reset} className="text-xs text-neutral-500 hover:text-white">
      Gérer les cookies
    </button>
  );
}
