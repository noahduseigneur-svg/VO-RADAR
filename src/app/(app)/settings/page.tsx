import { requireUser } from "@/lib/auth";
import { PLANS, stripeEnabled } from "@/lib/stripe";
import { getGarageSettings } from "@/lib/db";
import { fmtEUR } from "@/lib/utils";
import { GarageSettingsForm } from "./garage-form";
import { DigestSection } from "./digest-button";

export default async function SettingsPage() {
  const user = await requireUser();
  const garageProfile = await getGarageSettings(user.id);

  return (
    <div className="mx-auto max-w-4xl px-8 py-10">
      <header className="mb-8">
        <h1 className="text-3xl font-semibold">Paramètres</h1>
        <p className="mt-1 text-sm text-neutral-400">Votre compte, votre abonnement et vos préférences.</p>
      </header>

      <section className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 font-semibold">Compte</h2>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <Row k="Email" v={user.email} />
          <Row k="Concession" v={user.dealership_name} />
          <Row k="Plan actuel" v={user.plan} />
          <Row k="Statut" v={user.subscription_status} />
        </dl>
      </section>

      {/* Garage profile / margin settings */}
      <section className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-1 font-semibold">Profil financier</h2>
        <p className="mb-5 text-sm text-neutral-400">
          Ces coûts sont utilisés pour calculer votre marge réelle sur chaque annonce.
          Ajustez-les selon votre structure de frais.
        </p>
        <GarageSettingsForm initial={garageProfile} />
      </section>

      <section className="mb-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 font-semibold">Digest quotidien</h2>
        <DigestSection initialEnabled={user.digest_enabled !== 0} />
      </section>

      <section className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6">
        <h2 className="mb-4 font-semibold">Abonnement</h2>
        {!stripeEnabled() && (
          <div className="mb-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
            Stripe non configuré (variables d&rsquo;environnement manquantes). Mode démo activé — les boutons d&rsquo;abonnement renvoient une session test.
          </div>
        )}
        <div className="grid gap-4 md:grid-cols-3">
          {(Object.entries(PLANS) as [keyof typeof PLANS, (typeof PLANS)[keyof typeof PLANS]][]).map(([key, p]) => (
            <form key={key} action="/api/stripe/checkout" method="post" className="rounded-xl border border-[var(--border)] bg-[var(--background)] p-5">
              <input type="hidden" name="plan" value={key} />
              <div className="text-sm uppercase tracking-wide text-neutral-400">{p.name}</div>
              <div className="mt-2 text-2xl font-semibold tabular-nums">{fmtEUR(p.price_eur)}<span className="text-base text-neutral-500"> / mois</span></div>
              <p className="mt-1 text-xs text-neutral-400">{p.tagline}</p>
              <button className="mt-4 w-full rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-neutral-900 hover:bg-neutral-200">
                {user.plan === key ? "Plan actuel" : "Passer à ce plan"}
              </button>
            </form>
          ))}
        </div>

        {user.stripe_customer_id && (
          <form action="/api/stripe/portal" method="post" className="mt-6">
            <button className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm text-neutral-200 hover:border-neutral-600">
              Gérer mon abonnement (factures, annulation)
            </button>
          </form>
        )}
      </section>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--border)] py-2 last:border-b-0">
      <dt className="text-neutral-500">{k}</dt>
      <dd className="font-medium">{v}</dd>
    </div>
  );
}
