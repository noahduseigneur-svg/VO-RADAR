import Link from "next/link";
import { Compass, Home } from "lucide-react";

export default function NotFound() {
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/30">
          <Compass size={26} />
        </div>
        <h1 className="text-3xl font-semibold">Page introuvable</h1>
        <p className="mt-2 text-neutral-400">
          La page que vous cherchez n&rsquo;existe pas (ou plus). Elle a peut-être été supprimée, déplacée,
          ou son URL est mal écrite.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200"
          >
            <Home size={14} /> Retour au dashboard
          </Link>
          <Link href="/" className="rounded-lg border border-[var(--border)] px-4 py-2 text-sm hover:border-neutral-600">
            Accueil
          </Link>
        </div>
      </div>
    </main>
  );
}
