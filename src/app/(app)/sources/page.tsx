import { Plug } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { countListingsBySource, listCustomSources } from "@/lib/db";
import { SourceForm } from "@/components/source-form";
import { SourceActions } from "@/components/source-actions";
import { fmtDate } from "@/lib/utils";

const BUILTIN_SOURCES = [
  // --- Voitures ---
  { id: "autoscout24",     name: "AutoScout24",      description: "🚗 Marketplace européenne — multi-marques, ~300 annonces FR/run", category: "voitures" },
  { id: "lacentrale",      name: "La Centrale",       description: "🚗 Agrégateur FR — parsing __NEXT_DATA__, Crawl-delay 4s", category: "voitures" },
  { id: "leboncoin",       name: "LeBonCoin",         description: "🚗 Petites annonces FR — parsing __NEXT_DATA__, DataDome. Optionnel : LBC_COOKIE + LBC_PROXY", category: "voitures" },
  { id: "aramis",          name: "Aramis Auto",       description: "🚗 Mandataire Stellantis FR — robots.txt OK, Crawl-delay 5s", category: "voitures" },
  { id: "bymycar",         name: "ByMyCar",           description: "🚗 Réseau concessions multi-marques FR", category: "voitures" },
  { id: "spoticar",        name: "Spoticar",          description: "🚗 Réseau VO Stellantis FR — robots.txt OK", category: "voitures" },
  { id: "ebay",            name: "eBay Motors",       description: "🚗 API officielle. Multi-pays (FR/DE/IT/UK). Nécessite EBAY_APP_ID + EBAY_CERT_ID", category: "voitures" },
  // --- Motos ---
  { id: "leboncoin-moto",   name: "LeBonCoin Motos",  description: "🏍️ Section motos/scooters/quad LBC — même format que voitures, DataDome. Optionnel : LBC_COOKIE + LBC_PROXY", category: "motos" },
  { id: "lacentrale-moto",  name: "La Centrale Motos", description: "🏍️ Section motos La Centrale — top 35 marques/modèles", category: "motos" },
  { id: "autoscout24-moto", name: "AutoScout24 Motos", description: "🏍️ Section motos AutoScout24 — vehicle_type=M, 35 combos make/model", category: "motos" },
];

export default async function SourcesPage() {
  await requireUser();
  const [custom, countsArr] = await Promise.all([
    listCustomSources(),
    countListingsBySource(),
  ]);
  const counts = new Map(countsArr.map((r) => [r.source, r.n]));

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold">Sources de données</h1>
          <p className="mt-1 text-sm text-neutral-400">
            Ajoutez n&rsquo;importe quelle concession qui expose ses véhicules en schema.org/Car.
            Testez avant d&rsquo;ajouter.
          </p>
        </div>
      </header>

      <section className="mb-8">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-neutral-400">Sources intégrées</h2>
        <div className="space-y-2">
          {BUILTIN_SOURCES.map((s) => (
            <div key={s.id} className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 grid h-8 w-8 place-items-center rounded-lg bg-rose-500/10 text-rose-400">
                  <Plug size={14} />
                </span>
                <div>
                  <div className="font-medium">{s.name}</div>
                  <div className="mt-0.5 text-xs text-neutral-500">{s.description}</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-neutral-500">Annonces</div>
                <div className="font-mono font-semibold tabular-nums">{(counts.get(s.id) ?? 0).toLocaleString("fr-FR")}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="mb-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">Sources personnalisées</h2>
        </div>

        {custom.length === 0 ? (
          <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-10 text-center text-neutral-400">
            Aucune source personnalisée. Ajoutez une concession ci-dessous.
          </div>
        ) : (
          <div className="space-y-2">
            {custom.map((s) => (
              <div key={s.id} className="flex items-start justify-between gap-4 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{s.name}</span>
                    {!s.enabled && <span className="rounded-full bg-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-300">désactivée</span>}
                  </div>
                  <div className="mt-0.5 truncate text-xs text-neutral-500">{s.sitemap_url}</div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-neutral-500">
                    <span>Pattern : <code className="rounded bg-[var(--background)] px-1 py-0.5">{s.product_url_pattern}</code></span>
                    <span>Délai : {s.crawl_delay_ms}ms</span>
                  </div>
                  <div className="mt-1 flex items-center gap-3 text-xs text-neutral-400">
                    <span>Annonces : <span className="text-neutral-200">{(counts.get(s.id) ?? 0).toLocaleString("fr-FR")}</span></span>
                    {s.last_run_at && <span>Dernier run : {fmtDate(s.last_run_at)} (+{s.last_run_inserted})</span>}
                    {s.last_run_error && <span className="text-rose-400">Erreur : {s.last_run_error.slice(0, 60)}…</span>}
                  </div>
                </div>
                <SourceActions id={s.id} enabled={!!s.enabled} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <SourceForm />
      </section>

      <section className="mt-8 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
        <h3 className="mb-2 font-semibold">Comment ça marche</h3>
        <ol className="ml-4 list-decimal space-y-1.5 text-sm text-neutral-300">
          <li>Trouvez l&rsquo;URL du <code>sitemap.xml</code> d&rsquo;une concession (ex: <code>www.concession.fr/sitemap.xml</code>).</li>
          <li>Vérifiez son <code>robots.txt</code> — la plupart des concessions autorisent le crawl avec délai.</li>
          <li>Collez le sitemap ci-dessus → cliquez <strong>Tester</strong>.</li>
          <li>Le système identifie automatiquement les URLs d&rsquo;annonces et parse 3 pages au hasard.</li>
          <li>Si le test trouve marque + prix + année, vous pouvez enregistrer.</li>
          <li>La source est ajoutée au scraper automatique (toutes les 15 min par défaut).</li>
        </ol>
        <p className="mt-3 text-xs text-neutral-500">
          ⚠ N&rsquo;ajoutez que des sites dont le <code>robots.txt</code> autorise le crawl. Respectez les délais minimums.
          VO Radar ne contourne ni les CAPTCHAs ni les anti-bots, et ce n&rsquo;est pas pour rien : risque juridique
          et IP-ban à grande échelle.
        </p>
      </section>
    </div>
  );
}
