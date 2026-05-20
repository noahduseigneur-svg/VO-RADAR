"use client";

import { useState, useTransition } from "react";
import { Mail, BellOff } from "lucide-react";
import { useToast } from "@/components/toast";

export function DigestSection({ initialEnabled }: { initialEnabled: boolean }) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [saving, startSave] = useTransition();
  const [testing, startTest] = useTransition();
  const [testResult, setTestResult] = useState<string | null>(null);
  const toast = useToast();

  const toggle = (next: boolean) => {
    startSave(async () => {
      const res = await fetch("/api/digest", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: next }),
      });
      if (res.ok) {
        setEnabled(next);
        toast.show("success", next ? "Digest activé" : "Digest désactivé");
      } else {
        toast.show("error", "Erreur lors de la sauvegarde");
      }
    });
  };

  const sendTest = () => {
    startTest(async () => {
      setTestResult(null);
      const res = await fetch("/api/digest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hours: 168 }),
      });
      const data = await res.json() as { emails_sent?: number; emails_skipped?: number };
      if (res.ok) {
        setTestResult(`${data.emails_sent ?? 0} email(s) envoyé(s)`);
        toast.show("success", "Digest envoyé !");
      } else {
        toast.show("error", "Erreur d'envoi");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Toggle opt-in */}
      <label className="flex cursor-pointer items-center justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-neutral-200">
            Recevoir le digest quotidien
          </p>
          <p className="text-xs text-neutral-500">
            Email chaque matin à 8h avec les meilleures opportunités détectées.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          disabled={saving}
          onClick={() => toggle(!enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
            enabled ? "bg-rose-600" : "bg-neutral-700"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
              enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </label>

      {/* Bouton test */}
      {enabled && (
        <div className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] pt-3">
          <button
            type="button"
            onClick={sendTest}
            disabled={testing}
            className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm hover:border-neutral-600 disabled:opacity-50"
          >
            <Mail size={14} />
            {testing ? "Envoi en cours…" : "Envoyer un digest de test"}
          </button>
          {testResult && (
            <span className="text-sm text-neutral-400">{testResult}</span>
          )}
          <p className="w-full text-xs text-neutral-500">
            Le test envoie les meilleures annonces des 7 derniers jours.
            Sans clé Resend, le résultat s'affiche dans les logs serveur.
          </p>
        </div>
      )}

      {!enabled && (
        <div className="flex items-center gap-2 text-xs text-neutral-500">
          <BellOff size={13} />
          Digest désactivé — vous ne recevrez aucun email récapitulatif.
        </div>
      )}
    </div>
  );
}
