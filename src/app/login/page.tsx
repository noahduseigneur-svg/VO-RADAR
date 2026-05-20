import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/lib/auth";

async function loginAction(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  try {
    await login(email, password);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Erreur";
    redirect(`/login?error=${encodeURIComponent(msg)}`);
  }
  redirect("/dashboard");
}

export default async function LoginPage(props: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await props.searchParams;
  return (
    <main className="grid min-h-screen place-items-center px-6">
      <form action={loginAction} className="w-full max-w-sm space-y-4 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-8">
        <div>
          <h1 className="text-2xl font-semibold">Connexion</h1>
          <p className="mt-1 text-sm text-neutral-400">Accédez à votre flux de bonnes affaires VO.</p>
        </div>
        {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">{error}</div>}
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-neutral-400">Email pro</span>
          <input name="email" type="email" required autoComplete="email" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-rose-500 focus:outline-none" />
        </label>
        <label className="block">
          <span className="text-xs uppercase tracking-wide text-neutral-400">Mot de passe</span>
          <input name="password" type="password" required autoComplete="current-password" className="mt-1 w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-rose-500 focus:outline-none" />
        </label>
        <button className="w-full rounded-lg bg-white px-4 py-2 text-sm font-medium text-neutral-900 hover:bg-neutral-200">
          Se connecter
        </button>
        <p className="text-center text-xs text-neutral-500">
          Pas encore de compte ? <Link href="/signup" className="text-rose-400 hover:underline">Créez-en un</Link>
        </p>
      </form>
    </main>
  );
}
