"use client";

import { useState } from "react";

export function PasswordForm() {
  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const mismatch = confirmPw.length > 0 && newPw !== confirmPw;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (newPw !== confirmPw) {
      setError("Les mots de passe ne correspondent pas");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ current_password: currentPw, new_password: newPw }),
      });
      const data = (await res.json()) as { ok?: boolean; error?: string };
      if (res.ok && data.ok) {
        setSuccess(true);
        setCurrentPw("");
        setNewPw("");
        setConfirmPw("");
      } else {
        setError(data.error ?? "Une erreur est survenue");
      }
    } catch {
      setError("Erreur réseau");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-400">
          Mot de passe actuel
        </label>
        <input
          type="password"
          value={currentPw}
          onChange={(e) => setCurrentPw(e.target.value)}
          required
          autoComplete="current-password"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-rose-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-400">
          Nouveau mot de passe
        </label>
        <input
          type="password"
          value={newPw}
          onChange={(e) => setNewPw(e.target.value)}
          required
          minLength={8}
          autoComplete="new-password"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-rose-500"
        />
      </div>

      <div>
        <label className="mb-1 block text-xs uppercase tracking-wide text-neutral-400">
          Confirmer le nouveau mot de passe
        </label>
        <input
          type="password"
          value={confirmPw}
          onChange={(e) => setConfirmPw(e.target.value)}
          required
          autoComplete="new-password"
          className={`w-full rounded-lg border bg-[var(--background)] px-3 py-2 text-sm text-neutral-100 placeholder-neutral-600 outline-none focus:border-rose-500 ${
            mismatch ? "border-rose-500" : "border-[var(--border)]"
          }`}
        />
        {mismatch && (
          <p className="mt-1 text-xs text-rose-400">Les mots de passe ne correspondent pas</p>
        )}
      </div>

      {error && (
        <p className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-400">
          {error}
        </p>
      )}

      {success && (
        <p className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-400">
          Mot de passe mis à jour ✓
        </p>
      )}

      <button
        type="submit"
        disabled={loading || mismatch}
        className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-rose-400 disabled:opacity-50"
      >
        {loading ? "Enregistrement…" : "Changer le mot de passe"}
      </button>
    </form>
  );
}
