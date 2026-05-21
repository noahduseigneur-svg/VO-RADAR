"use client";

import { useState } from "react";

interface NotifPrefs {
  digest_enabled: boolean;
  notif_price_drop: boolean;
  notif_listing_gone: boolean;
}

interface NotifPrefsFormProps {
  initial: NotifPrefs;
}

const TOGGLES: {
  key: keyof NotifPrefs;
  label: string;
  description: string;
}[] = [
  {
    key: "digest_enabled",
    label: "Digest quotidien",
    description: "Résumé des meilleures annonces par email chaque jour",
  },
  {
    key: "notif_price_drop",
    label: "Alertes baisse de prix",
    description: "Email quand un véhicule surveillé baisse de prix",
  },
  {
    key: "notif_listing_gone",
    label: "Annonces disparues",
    description: "Email quand une annonce sauvegardée n'est plus disponible",
  },
];

export function NotifPrefsForm({ initial }: NotifPrefsFormProps) {
  const [prefs, setPrefs] = useState<NotifPrefs>(initial);

  const toggle = async (key: keyof NotifPrefs) => {
    const next = { ...prefs, [key]: !prefs[key] };
    // Optimistic update
    setPrefs(next);

    try {
      await fetch("/api/settings/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [key]: next[key] }),
      });
    } catch {
      // Revert on error
      setPrefs(prefs);
    }
  };

  return (
    <div className="space-y-4">
      {TOGGLES.map(({ key, label, description }) => (
        <label key={key} className="flex cursor-pointer items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-neutral-200">{label}</p>
            <p className="text-xs text-neutral-500">{description}</p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={prefs[key]}
            onClick={() => toggle(key)}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
              prefs[key] ? "bg-rose-500" : "bg-neutral-700"
            }`}
          >
            <span
              className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
                prefs[key] ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </label>
      ))}
    </div>
  );
}
