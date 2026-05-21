import Link from "next/link";
import { redirect } from "next/navigation";
import { login } from "@/lib/auth";
import { Logo } from "@/components/logo";

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
    <main className="min-h-screen grid lg:grid-cols-2">
      {/* Left: car photo panel */}
      <div className="hidden lg:block relative overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?w=1200&q=85&auto=format&fit=crop"
          alt="Concession automobile"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-neutral-950/80 via-neutral-950/40 to-rose-950/30" />
        <div className="absolute inset-0 flex flex-col justify-end p-12">
          <div className="text-white">
            <div className="mb-4 flex items-center gap-2">
              <div className="h-1 w-8 rounded-full bg-rose-500" />
              <span className="text-xs uppercase tracking-widest text-rose-400 font-medium">VO Radar</span>
            </div>
            <h2 className="text-4xl font-bold leading-tight">
              Sourcez les meilleures<br />opportunités VO.
            </h2>
            <p className="mt-4 text-neutral-300 max-w-sm">
              +6 000 annonces scrapées en temps réel sur 9 sources européennes. Score d&rsquo;opportunité, fiabilité moteur, marge de revente.
            </p>
            <div className="mt-8 flex gap-6">
              {[
                { value: "6k+", label: "Annonces live" },
                { value: "9", label: "Sources" },
                { value: "-15%", label: "Prix cote moy." },
              ].map((s) => (
                <div key={s.label}>
                  <div className="text-2xl font-bold text-white">{s.value}</div>
                  <div className="text-xs text-neutral-400 mt-0.5">{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Right: form */}
      <div className="flex items-center justify-center px-6 py-12 bg-[var(--background)]">
        <form action={loginAction} className="w-full max-w-sm space-y-5">
          {/* Logo / brand */}
          <div className="mb-8">
            <div className="mb-6">
              <Logo variant="full" size={36} />
            </div>
            <h1 className="text-2xl font-semibold">Connexion</h1>
            <p className="mt-1 text-sm text-neutral-400">Accédez à votre flux de bonnes affaires VO.</p>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
              {error}
            </div>
          )}

          <label className="block">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Email pro</span>
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm focus:border-rose-500 focus:outline-none transition"
            />
          </label>
          <label className="block">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Mot de passe</span>
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="mt-1.5 w-full rounded-lg border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 text-sm focus:border-rose-500 focus:outline-none transition"
            />
          </label>
          <button className="w-full rounded-lg bg-rose-500 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-400 transition">
            Se connecter
          </button>
          <p className="text-center text-xs text-neutral-500">
            Pas encore de compte ?{" "}
            <Link href="/signup" className="text-rose-400 hover:underline">
              Créez-en un
            </Link>
          </p>
        </form>
      </div>
    </main>
  );
}
