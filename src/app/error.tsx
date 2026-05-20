"use client";

import Link from "next/link";
import { useEffect } from "react";
import { AlertOctagon, RotateCcw } from "lucide-react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    if (process.env.NODE_ENV === "development") {
      console.error("[VO Radar] runtime error:", error);
    }
  }, [error]);

  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-amber-500/10 text-amber-400 ring-1 ring-amber-500/30">
          <AlertOctagon size={26} />
        </div>
        <h1 className="text-2xl font-semibold">Une erreur s&rsquo;est produite</h1>
        <p className="mt-2 text-sm text-neutral-400">
          Pas de panique : la donnée n&rsquo;est pas perdue. Réessayez, et si ça persiste, recharger la page suffit en général.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-neutral-500">id: {error.digest}</p>
        )}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200"
          >
            <RotateCcw size={14} /> Réessayer
          </button>
          <Link href="/dashboard" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:border-neutral-600">
            Dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
