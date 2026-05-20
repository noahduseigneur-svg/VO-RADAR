import Link from "next/link";
import { redirect } from "next/navigation";
import { signup } from "@/lib/auth";

async function signupAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const dealership = String(formData.get("dealership") ?? "");
  try {
    await signup(email, password, dealership);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur";
    redirect(`/signup?error=${encodeURIComponent(msg)}`);
  }
  redirect("/dashboard");
}

export default async function SignupPage(props: {
  searchParams: Promise<{ error?: string; plan?: string }>;
}) {
  const { error, plan } = await props.searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <form action={signupAction} className="w-full max-w-sm space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
        <div>
          <h1 className="text-2xl font-semibold">Créer un compte</h1>
          <p className="mt-1 text-sm text-neutral-400">14 jours d&rsquo;essai gratuits. Sans CB.</p>
          {plan && <p className="mt-2 text-xs text-rose-400">Plan sélectionné : {plan}</p>}
        </div>
        {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-neutral-400">Nom de la concession</span>
          <input name="dealership" type="text" required className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-rose-500 focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-neutral-400">Email pro</span>
          <input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-rose-500 focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-neutral-400">Mot de passe (8+ caractères)</span>
          <input name="password" type="password" required minLength={8} autoComplete="new-password" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-rose-500 focus:outline-none" />
        </label>
        <button className="w-full rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-400">
          Démarrer l&rsquo;essai
        </button>
        <p className="text-center text-xs text-neutral-500">
          Déjà inscrit ? <Link href="/login" className="text-rose-400 hover:underline">Connectez-vous</Link>
        </p>
      </form>
    </main>
  );
}
