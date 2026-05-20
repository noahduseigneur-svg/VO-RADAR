"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2, Plus, XCircle, Beaker } from "lucide-react";

interface ProbeResult {
  ok: boolean;
  total_urls: number;
  matched_urls: number;
  sample_urls: string[];
  parsed_sample: { url: string; brand?: string; model?: string; year?: number; price?: number }[];
  error?: string;
  suggested_pattern?: string;
}

export function SourceForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [sitemap, setSitemap] = useState("");
  const [pattern, setPattern] = useState("");
  const [crawlDelay, setCrawlDelay] = useState(5500);
  const [probe, setProbe] = useState<ProbeResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testing, startTest] = useTransition();
  const [saving, startSave] = useTransition();

  const runTest = () => {
    setError(null);
    setProbe(null);
    startTest(async () => {
      try {
        const res = await fetch("/api/sources/test", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sitemap_url: sitemap, product_url_pattern: pattern || undefined }),
        });
        const data = (await res.json()) as ProbeResult & { error?: string };
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Échec du test");
          return;
        }
        setProbe(data);
        if (data.suggested_pattern && !pattern) setPattern(data.suggested_pattern);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  };

  const save = () => {
    setError(null);
    startSave(async () => {
      try {
        const res = await fetch("/api/sources", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name, sitemap_url: sitemap, product_url_pattern: pattern,
            crawl_delay_ms: crawlDelay, batch_size: 20,
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setError(data.error ?? "Échec de l'enregistrement");
          return;
        }
        setOpen(false);
        setName(""); setSitemap(""); setPattern(""); setProbe(null);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erreur");
      }
    });
  };

  const validParse = probe?.parsed_sample.filter((p) => p.brand && p.price).length ?? 0;
  const canSave = probe?.ok && validParse > 0 && name && sitemap;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-400"
      >
        <Plus size={14} /> Ajouter une source
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-rose-500/30 bg-[var(--card)] p-5">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="font-semibold">Ajouter une concession / mandataire</h3>
        <button onClick={() => { setOpen(false); setProbe(null); setError(null); }} className="text-sm text-neutral-400 hover:text-white">
          Annuler
        </button>
      </div>

      <div className="space-y-3">
        <Field
          label="Nom (interne)"
          value={name} onChange={setName}
          placeholder="Garage Dupont — Bordeaux"
          autoComplete="off"
        />
        <Field
          label="URL du sitemap.xml"
          value={sitemap} onChange={setSitemap}
          placeholder="https://www.concession.fr/sitemap.xml"
          autoComplete="url"
        />
        <Field
          label="Pattern URL annonce (regex, auto-détecté après le test)"
          value={pattern} onChange={setPattern}
          placeholder="Ex: /voiture/.+ ou \d{6,}"
          mono
        />
        <Field
          label="Délai entre requêtes (ms) — respect robots.txt"
          value={String(crawlDelay)}
          onChange={(v) => setCrawlDelay(Number(v) || 5500)}
          type="number" min={3000} max={60000}
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          onClick={runTest}
          disabled={!sitemap || testing}
          className="inline-flex items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--background)] px-4 py-2 text-sm hover:border-neutral-600 disabled:opacity-50"
        >
          {testing ? <Loader2 size={14} className="animate-spin" /> : <Beaker size={14} />}
          Tester la source
        </button>
        <button
          onClick={save}
          disabled={!canSave || saving}
          className="inline-flex items-center gap-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-400 disabled:opacity-50"
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
          Enregistrer
        </button>
      </div>

      {error && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-300">
          <XCircle size={14} className="mt-0.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {probe && probe.ok && (
        <div className="mt-4 space-y-3">
          <div className="grid grid-cols-3 gap-2 text-sm">
            <Stat label="URLs trouvées" value={probe.total_urls.toLocaleString("fr-FR")} />
            <Stat label="URLs matchées" value={probe.matched_urls.toLocaleString("fr-FR")} />
            <Stat label="Parse OK" value={`${validParse} / ${probe.parsed_sample.length}`} highlight={validParse > 0} />
          </div>
          <div className="rounded-lg border border-[var(--border)] bg-[var(--background)] p-3">
            <div className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Échantillon parsé</div>
            <ul className="space-y-1 text-xs">
              {probe.parsed_sample.map((p, i) => (
                <li key={i} className="flex items-center justify-between gap-2">
                  <span className="truncate text-neutral-400">{p.url}</span>
                  {p.brand ? (
                    <span className="shrink-0 text-emerald-400">
                      <CheckCircle2 size={11} className="inline" /> {p.brand} {p.model} {p.year} — {p.price?.toLocaleString("fr-FR")} €
                    </span>
                  ) : (
                    <span className="shrink-0 text-rose-400"><XCircle size={11} className="inline" /> pas de JSON-LD</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
          {validParse === 0 && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-300">
              ⚠ Aucun JSON-LD/Car détecté dans les pages testées. Cette source n&rsquo;est probablement pas exploitable
              directement (probable SPA React ou autre rendu client-side).
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Field({ label, value, onChange, type = "text", placeholder, mono, autoComplete, min, max }: {
  label: string; value: string; onChange: (v: string) => void;
  type?: string; placeholder?: string; mono?: boolean; autoComplete?: string;
  min?: number; max?: number;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-400">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        min={min}
        max={max}
        className={`w-full rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-rose-500 focus:outline-none ${mono ? "font-mono" : ""}`}
      />
    </label>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-emerald-500/10 ring-1 ring-emerald-500/30" : "bg-[var(--background)]"}`}>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 font-mono font-semibold tabular-nums ${highlight ? "text-emerald-400" : ""}`}>{value}</div>
    </div>
  );
}
