import Link from "next/link";
import { Radar } from "lucide-react";

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30">
              <Radar size={16} />
            </span>
            VO Radar
          </Link>
          <Link href="/" className="text-sm text-neutral-400 hover:text-white">← Retour à l&rsquo;accueil</Link>
        </div>
      </header>
      <main className="mx-auto max-w-4xl px-6 py-12">
        {children}
      </main>
      <footer className="border-t border-[var(--border)] py-6 text-center text-xs text-neutral-500">
        <div className="flex flex-wrap justify-center gap-4">
          <Link href="/legal/mentions" className="hover:text-white">Mentions légales</Link>
          <Link href="/legal/cgu" className="hover:text-white">CGU</Link>
          <Link href="/legal/cgv" className="hover:text-white">CGV</Link>
          <Link href="/legal/privacy" className="hover:text-white">Politique de confidentialité</Link>
        </div>
        <p className="mt-3">© {new Date().getFullYear()} VO Radar</p>
      </footer>
    </div>
  );
}
