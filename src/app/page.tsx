import Link from "next/link";
import {
  ArrowRight, Check, Radar, TrendingDown, Gauge, ShieldCheck,
  FileText, Zap, Clock, BarChart3, Calculator, Star,
} from "lucide-react";
import { PLANS } from "@/lib/stripe";
import { fmtEUR } from "@/lib/utils";

export default function Landing() {
  return (
    <main className="min-h-screen">

      {/* ── Navbar ── */}
      <header className="sticky top-0 z-30 border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-rose-500/15 text-rose-400 ring-1 ring-rose-500/30">
              <Radar size={16} />
            </span>
            VO Radar
          </Link>
          <nav className="hidden gap-6 text-sm text-neutral-400 md:flex">
            <a href="#fonctionnalites" className="hover:text-white">Fonctionnalités</a>
            <a href="#marge" className="hover:text-white">Calculateur de marge</a>
            <a href="#pricing" className="hover:text-white">Tarifs</a>
            <a href="#faq" className="hover:text-white">FAQ</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="rounded-lg px-3 py-1.5 text-sm text-neutral-300 hover:text-white">
              Se connecter
            </Link>
            <Link href="/signup" className="rounded-lg bg-rose-500 px-3 py-1.5 text-sm font-medium text-white hover:bg-rose-400">
              Essai gratuit 14 j
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-20 text-center">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border border-rose-500/30 bg-rose-500/10 px-3 py-1 text-xs text-rose-300">
          <Star size={11} fill="currentColor" /> Conçu pour les sourceurs VO en concession
        </div>
        <h1 className="mx-auto max-w-4xl text-5xl font-semibold tracking-tight md:text-6xl">
          Achetez les VO les plus rentables<br />
          <span className="text-rose-400">avant vos concurrents.</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-neutral-400">
          VO Radar agrège 9 sources, score chaque annonce sur 100 et calcule votre marge
          nette en secondes — avant que la bonne affaire disparaisse.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-6 py-3 font-medium text-white hover:bg-rose-400"
          >
            Commencer l&rsquo;essai gratuit <ArrowRight size={16} />
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-[var(--border)] px-6 py-3 text-neutral-200 hover:border-neutral-500"
          >
            Voir le tableau de bord →
          </Link>
        </div>
        <p className="mt-4 text-xs text-neutral-500">14 jours gratuits · sans carte bancaire · résiliable en 1 clic</p>

        {/* Mockup produit */}
        <div className="mx-auto mt-14 max-w-2xl overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)] text-left shadow-2xl shadow-rose-500/5">
          {/* Barre de fenêtre */}
          <div className="flex items-center gap-1.5 border-b border-[var(--border)] bg-neutral-900/60 px-4 py-2.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-500/70" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500/70" />
            <span className="ml-3 text-xs text-neutral-500">vo-radar.app/listings</span>
          </div>
          {/* Fausse barre de filtres */}
          <div className="flex gap-2 overflow-x-auto border-b border-[var(--border)] bg-neutral-900/40 px-4 py-2 [scrollbar-width:none]">
            {["Score 70+", "Diesel", "< 80 000 km", "Max 20 k€"].map((f) => (
              <span key={f} className="shrink-0 rounded-md border border-rose-500/30 bg-rose-500/10 px-2 py-0.5 text-xs text-rose-300">{f}</span>
            ))}
          </div>
          {/* Cartes listing */}
          <div className="divide-y divide-[var(--border)]">
            <HeroListing score={91} label="Pépite" color="emerald" brand="Peugeot 3008" year={2022} km="38 000" fuel="Diesel" price="23 900 €" delta="+2 400 €" pct="+11%" />
            <HeroListing score={78} label="Bonne affaire" color="lime" brand="Volkswagen Golf" year={2021} km="54 000" fuel="Essence" price="17 200 €" delta="+900 €" pct="+5%" />
            <HeroListing score={73} label="Bonne affaire" color="lime" brand="Renault Captur" year={2022} km="41 500" fuel="Hybride" price="19 500 €" delta="+700 €" pct="+4%" />
          </div>
        </div>
      </section>

      {/* ── Sources ── */}
      <section className="border-y border-[var(--border)] bg-[var(--card)]/40 py-5">
        <div className="mx-auto max-w-5xl px-6">
          <p className="mb-4 text-center text-xs font-medium uppercase tracking-widest text-neutral-600">Sources agrégées</p>
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
            {["AutoScout24", "La Centrale", "LeBonCoin", "Aramis", "ByMyCar", "Spoticar", "BCA", "eBay"].map((s) => (
              <span key={s} className="text-sm font-medium text-neutral-500 hover:text-neutral-300 transition-colors">{s}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats strip ── */}
      <section className="border-y border-[var(--border)] bg-[var(--card)]/60 py-8">
        <div className="mx-auto grid max-w-4xl grid-cols-2 gap-6 px-6 text-center md:grid-cols-4">
          <Stat value="6 000+" label="annonces agrégées" />
          <Stat value="9" label="sources actives" />
          <Stat value="−15 %" label="vs cote sur les pépites" />
          <Stat value="< 5 min" label="pour être opérationnel" />
        </div>
      </section>

      {/* ── Comment ça marche ── */}
      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionLabel>Comment ça marche</SectionLabel>
        <h2 className="mt-3 text-center text-3xl font-semibold">
          De l&rsquo;annonce à la décision en 3 étapes
        </h2>
        <div className="mt-12 grid gap-8 md:grid-cols-3">
          <Step n="01" title="On scrape, vous gagnez du temps">
            Chaque heure, VO Radar collecte les annonces sur 9 sources : AutoScout24,
            La Centrale, LeBonCoin, Aramis, ByMyCar, Spoticar, BCA, eBay. Zéro copier-coller.
          </Step>
          <Step n="02" title="Chaque véhicule est scoré /100">
            Notre moteur kNN compare chaque annonce à ses 50 voisins les plus proches —
            même marque, modèle, motorisation, âge, km — et calcule un score d&rsquo;opportunité.
          </Step>
          <Step n="03" title="Vous voyez votre marge nette">
            En entrant vos coûts réels (transport, reconditionnement, préparation),
            VO Radar calcule votre prix de revient et votre marge cible instantanément.
          </Step>
        </div>
      </section>

      {/* ── Fonctionnalités ── */}
      <section id="fonctionnalites" className="bg-[var(--card)]/30 py-20">
        <div className="mx-auto max-w-6xl px-6">
          <SectionLabel>Fonctionnalités</SectionLabel>
          <h2 className="mt-3 text-center text-3xl font-semibold">
            Tout ce qu&rsquo;il faut pour sourcer avec méthode
          </h2>
          <div className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <FeatureCard
              icon={<TrendingDown size={18} />}
              title="Scoring d'opportunité /100"
              desc="Chaque annonce est comparée à son marché local en temps réel. Score basé sur le delta cote, l'état, le vendeur et la fraîcheur de l'annonce."
            />
            <FeatureCard
              icon={<Calculator size={18} />}
              title="Calculateur de marge intégré"
              desc="Configurez vos coûts (transport, recon, prépa, CT, frais fixes). VO Radar vous donne le prix de revient et le prix d'achat maximum automatiquement."
            />
            <FeatureCard
              icon={<Clock size={18} />}
              title="Score de liquidité"
              desc="Estimez en combien de jours le véhicule se revendra selon son segment, son carburant et son delta prix. Évitez d'immobiliser inutilement de la trésorerie."
            />
            <FeatureCard
              icon={<ShieldCheck size={18} />}
              title="Vérification véhicule"
              desc="CT estimé à la date, liens Histovec & Cartado pré-remplis avec la plaque, checklist terrain (carrosserie, documents, essai) — tout dans un seul écran."
            />
            <FeatureCard
              icon={<Gauge size={18} />}
              title="Fiabilité moteur & Crit'Air"
              desc="Chaque motorisation est notée de A à E selon les données de fiabilité long terme. Le badge Crit'Air vous évite les achats bloqués en ZFE."
            />
            <FeatureCard
              icon={<FileText size={18} />}
              title="Fiche PDF en 1 clic"
              desc="Générez une fiche A4 imprimable avec scoring, marge, liquidité et historique de prix. Idéal pour les réunions sourcing ou la validation direction."
            />
            <FeatureCard
              icon={<BarChart3 size={18} />}
              title="Historique de prix"
              desc="Visualisez l'évolution du prix depuis la mise en ligne. Un prix en baisse 3× sur 30 jours = vendeur motivé = marge de négociation."
            />
            <FeatureCard
              icon={<Zap size={18} />}
              title="Digest quotidien 8h"
              desc="Chaque matin à 8h, recevez les meilleures opportunités de la veille par email. Plus besoin de fouiller : les pépites viennent à vous."
            />
            <FeatureCard
              icon={<Radar size={18} />}
              title="Pipeline de suivi"
              desc="Sauvegardez vos coups de cœur, notez leur statut (à voir, en négociation, acheté) et suivez votre sourcing depuis votre tableau de bord."
            />
          </div>
        </div>
      </section>

      {/* ── Marge Calculator highlight ── */}
      <section id="marge" className="mx-auto max-w-6xl px-6 py-20">
        <div className="grid items-center gap-12 md:grid-cols-2">
          <div>
            <SectionLabel>Calculateur de marge</SectionLabel>
            <h2 className="mt-3 text-3xl font-semibold leading-tight">
              Sachez en 3 secondes si un véhicule vaut la peine d&rsquo;être acheté
            </h2>
            <p className="mt-4 text-neutral-400">
              Entrez vos coûts fixes une seule fois. Pour chaque annonce, VO Radar
              calcule automatiquement le reconditionnement estimé, votre prix de revient
              total et le prix d&rsquo;achat maximum pour atteindre votre marge cible.
            </p>
            <ul className="mt-6 space-y-3 text-sm">
              {[
                "Transport, prépa, CT, recon estimé par âge + km",
                "Prix de revient total en temps réel",
                "Prix d'achat max pour atteindre votre marge cible",
                "Verdict immédiat : Affaire / Neutre / À éviter",
              ].map((item) => (
                <li key={item} className="flex items-start gap-2 text-neutral-300">
                  <Check size={14} className="mt-1 shrink-0 text-emerald-400" /> {item}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-5 py-3 font-medium text-neutral-900 hover:bg-neutral-200"
            >
              Tester avec mes données <ArrowRight size={16} />
            </Link>
          </div>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-6">
            <div className="mb-4 text-xs uppercase tracking-wide text-neutral-500">Exemple — BMW Série 3, 2021, 65 000 km</div>
            <div className="grid grid-cols-2 gap-3">
              <MiniCard label="Prix annonce" value="18 500 €" neutral />
              <MiniCard label="Cote estimée" value="19 800 €" positive />
              <MiniCard label="Prix de revient" value="19 850 €" neutral />
              <MiniCard label="Marge nette" value="−50 €" negative />
            </div>
            <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/5 px-4 py-3 text-sm">
              <span className="font-medium text-rose-400">À éviter</span>
              <span className="ml-2 text-neutral-400">— Prix max d&rsquo;achat : 17 900 €</span>
            </div>
            <p className="mt-3 text-xs text-neutral-500">
              Coûts configurés : 250 € transport · 580 € recon · 300 € prépa/CT · 400 € frais fixes · marge cible 1 000 €
            </p>
          </div>
        </div>
      </section>

      {/* ── Testimonials ── */}
      <section className="border-y border-[var(--border)] bg-[var(--card)]/30 py-16">
        <div className="mx-auto max-w-5xl px-6">
          <SectionLabel>Témoignages</SectionLabel>
          <h2 className="mb-10 mt-3 text-center text-2xl font-semibold">Ce que disent les sourceurs VO</h2>
          <div className="grid gap-6 md:grid-cols-3">
            <Testimonial
              quote="J'ai identifié 3 pépites la première semaine. Le calcul de marge m'a évité d'acheter un véhicule qui paraissait intéressant mais était en réalité sous-marge."
              name="T. Renard"
              role="Responsable VO"
              company="Groupe multimarque, Île-de-France"
              initials="TR"
            />
            <Testimonial
              quote="Le score de liquidité c'est game-changer. On optimise notre tréso en évitant les segments qui traînent 45 jours en stock."
              name="M. Bourgeois"
              role="Directeur sourcing"
              company="Concession premium, Lyon"
              initials="MB"
            />
            <Testimonial
              quote="Le digest du matin à 8h remplace 2h de veille manuelle. L'équipe a adopté l'outil en 10 minutes chrono."
              name="S. Lemaire"
              role="Sourceur VO"
              company="Réseau de franchise, Bordeaux"
              initials="SL"
            />
          </div>
          <p className="mt-6 text-center text-xs text-neutral-600">Témoignages représentatifs. Les prénoms sont anonymisés.</p>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <SectionLabel>Tarifs</SectionLabel>
        <h2 className="mt-3 text-center text-3xl font-semibold">
          Le prix d&rsquo;un seul VO bien acheté couvre l&rsquo;abonnement annuel
        </h2>
        <p className="mt-2 text-center text-neutral-400">Sans engagement · 14 jours gratuits · résiliable en 1 clic</p>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {(Object.entries(PLANS) as [keyof typeof PLANS, (typeof PLANS)[keyof typeof PLANS]][]).map(([key, plan]) => (
            <div
              key={key}
              className={`relative rounded-2xl border bg-[var(--card)] p-6 ${
                "highlight" in plan && plan.highlight
                  ? "border-rose-500/40 ring-1 ring-rose-500/20"
                  : "border-[var(--border)]"
              }`}
            >
              {"highlight" in plan && plan.highlight && (
                <span className="absolute -top-3 left-6 rounded-full bg-rose-500 px-2 py-0.5 text-xs font-medium text-white">
                  Le plus choisi
                </span>
              )}
              <div className="text-sm uppercase tracking-wide text-neutral-400">{plan.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tabular-nums">{fmtEUR(plan.price_eur)}</span>
                <span className="text-neutral-500">/ mois</span>
              </div>
              <p className="mt-1 text-sm text-neutral-400">{plan.tagline}</p>
              <ul className="mt-6 space-y-2 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-neutral-300">
                    <Check size={14} className="mt-1 shrink-0 text-emerald-400" /> {f}
                  </li>
                ))}
              </ul>
              <Link
                href={`/signup?plan=${key}`}
                className={`mt-6 block rounded-lg px-4 py-2.5 text-center text-sm font-medium ${
                  "highlight" in plan && plan.highlight
                    ? "bg-rose-500 text-white hover:bg-rose-400"
                    : "bg-white text-neutral-900 hover:bg-neutral-200"
                }`}
              >
                Commencer gratuitement
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-sm text-neutral-500">
          Engagement annuel disponible · <span className="text-neutral-300">−20%</span> sur tous les plans
        </p>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="mx-auto max-w-3xl px-6 pb-20">
        <h2 className="mb-8 text-center text-3xl font-semibold">Questions fréquentes</h2>
        <div className="space-y-3">
          <Faq
            q="D'où viennent les annonces ?"
            a="VO Radar agrège 9 sources en continu : AutoScout24, La Centrale, LeBonCoin, Aramis, ByMyCar, Spoticar, BCA Enchères, eBay Motors et les réseaux mandataires — soit 6 000+ annonces disponibles. De nouvelles sources sont régulièrement ajoutées."
          />
          <Faq
            q="Comment est calculée la cote ?"
            a="Notre moteur kNN (k plus proches voisins) compare chaque véhicule à ses 50 voisins les plus similaires : même marque/modèle/motorisation, âge et kilométrage proches. La cote est mise à jour en continu à mesure que de nouvelles annonces arrivent."
          />
          <Faq
            q="Comment fonctionne le calculateur de marge ?"
            a="Vous configurez une seule fois vos coûts (transport, reconditionnement par an et par km, prépa/CT, frais fixes, marge cible). Ensuite, pour chaque annonce, VO Radar calcule automatiquement votre prix de revient total et le prix d'achat maximum pour atteindre votre marge."
          />
          <Faq
            q="Combien de temps pour être opérationnel ?"
            a="5 minutes. Vous créez votre compte, entrez vos paramètres de marge, et les premières annonces scorées apparaissent immédiatement. Le digest email du lendemain matin contient déjà vos opportunités filtrées."
          />
          <Faq
            q="Engagement ?"
            a="Aucun engagement minimum. L'abonnement est mensuel, résiliable en 1 clic depuis votre compte. Un engagement annuel est disponible avec 20% de remise."
          />
        </div>
      </section>

      {/* ── Final CTA ── */}
      <section className="mx-auto max-w-4xl px-6 pb-24">
        <div className="rounded-2xl border border-rose-500/30 bg-gradient-to-br from-rose-500/10 via-transparent to-transparent p-12 text-center">
          <Radar size={32} className="mx-auto text-rose-400" />
          <h3 className="mt-5 text-3xl font-semibold">
            Arrêtez de passer à côté des meilleures affaires.
          </h3>
          <p className="mx-auto mt-3 max-w-md text-neutral-400">
            Rejoignez les sourceurs VO qui utilisent VO Radar pour trouver,
            analyser et acheter au bon prix — sans passer des heures à éplucher les annonces.
          </p>
          <Link
            href="/signup"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 font-medium text-neutral-900 hover:bg-neutral-200"
          >
            Démarrer l&rsquo;essai gratuit <ArrowRight size={16} />
          </Link>
          <p className="mt-3 text-xs text-neutral-500">14 jours · sans carte bancaire</p>
        </div>
      </section>

      <footer className="border-t border-[var(--border)] py-8 text-center text-xs text-neutral-500">
        <div className="flex flex-wrap justify-center gap-4 mb-3">
          <Link href="/legal/mentions" className="hover:text-white">Mentions légales</Link>
          <Link href="/legal/cgu" className="hover:text-white">CGU</Link>
          <Link href="/legal/cgv" className="hover:text-white">CGV</Link>
          <Link href="/legal/privacy" className="hover:text-white">Confidentialité</Link>
          <a href="mailto:contact@vo-radar.fr" className="hover:text-white">Contact</a>
        </div>
        © {new Date().getFullYear()} VO Radar — Conçu pour les professionnels du VO en France
      </footer>
    </main>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-center text-xs font-medium uppercase tracking-widest text-rose-400">{children}</p>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <div className="text-3xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 text-sm text-neutral-400">{label}</div>
    </div>
  );
}

function Step({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="relative pl-14">
      <span className="absolute left-0 top-0 flex h-9 w-9 items-center justify-center rounded-xl bg-rose-500/10 text-sm font-semibold text-rose-400 ring-1 ring-rose-500/20">
        {n}
      </span>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-neutral-400">{children}</p>
    </div>
  );
}

function FeatureCard({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-rose-500/10 text-rose-400 ring-1 ring-rose-500/20">
        {icon}
      </span>
      <h3 className="mt-3 font-medium">{title}</h3>
      <p className="mt-1 text-sm text-neutral-400">{desc}</p>
    </div>
  );
}

function MiniCard({ label, value, positive, negative, neutral }: {
  label: string; value: string;
  positive?: boolean; negative?: boolean; neutral?: boolean;
}) {
  const color = positive ? "text-emerald-400" : negative ? "text-rose-400" : "text-neutral-200";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
      <div className="text-xs text-neutral-500">{label}</div>
      <div className={`mt-0.5 text-lg font-semibold tabular-nums ${color}`}>{value}</div>
    </div>
  );
}

function Testimonial({ quote, name, role, company, initials }: {
  quote: string; name: string; role: string; company: string; initials: string;
}) {
  return (
    <div className="flex flex-col rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex gap-0.5 text-amber-400">
        {Array.from({ length: 5 }).map((_, i) => <Star key={i} size={12} fill="currentColor" />)}
      </div>
      <p className="mt-3 flex-1 text-sm leading-relaxed text-neutral-300 italic">&ldquo;{quote}&rdquo;</p>
      <div className="mt-4 flex items-center gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-rose-500/20 text-xs font-semibold text-rose-300">
          {initials}
        </span>
        <div className="text-xs">
          <div className="font-medium text-neutral-200">{name} · <span className="text-neutral-400">{role}</span></div>
          <div className="text-neutral-500">{company}</div>
        </div>
      </div>
    </div>
  );
}

function HeroListing({ score, color, brand, year, km, fuel, price, delta, pct }: {
  score: number; label: string; color: "emerald" | "lime"; brand: string; year: number;
  km: string; fuel: string; price: string; delta: string; pct: string;
}) {
  const scoreColor = color === "emerald" ? "text-emerald-400 bg-emerald-400/10" : "text-lime-400 bg-lime-400/10";
  return (
    <div className="flex items-center gap-3 px-4 py-3">
      <span className={`shrink-0 w-10 rounded-lg px-1 py-1 text-center text-xs font-bold tabular-nums ${scoreColor}`}>{score}</span>
      <div className="flex-1">
        <p className="text-sm font-medium text-neutral-200">{brand} <span className="text-neutral-500">{year}</span></p>
        <p className="text-xs text-neutral-500">{km} km · {fuel}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums text-neutral-200">{price}</p>
        <p className="text-xs text-emerald-400 tabular-nums">{delta} <span className="text-neutral-500">({pct})</span></p>
      </div>
    </div>
  );
}

function Faq({ q, a }: { q: string; a: string }) {
  return (
    <details className="rounded-lg border border-[var(--border)] bg-[var(--card)] p-4 [&[open]>summary]:text-white">
      <summary className="cursor-pointer text-sm font-medium text-neutral-300">{q}</summary>
      <p className="mt-3 text-sm leading-relaxed text-neutral-400">{a}</p>
    </details>
  );
}
