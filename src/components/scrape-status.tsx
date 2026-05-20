"use client";

import { useEffect, useState } from "react";
import { Activity, CheckCircle2, Loader2, XCircle } from "lucide-react";

interface Status {
  running: boolean;
  cycle: number;
  cycle_started_at: string | null;
  last_cycle_finished_at: string | null;
  last_cycle_duration_ms: number | null;
  next_run_at: string | null;
  interval_ms: number;
  total_runs: number;
  total_inserted: number;
  active_sources: string[];
  per_source: Record<string, { last_inserted: number; last_at: string; total: number; error?: string }>;
}

interface ApiResp {
  status: Status;
  total_in_db: number;
  by_source: { source: string; n: number }[];
}

export function ScrapeStatusWidget() {
  const [data, setData] = useState<ApiResp | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch("/api/scrape/status");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as ApiResp;
        if (alive) setData(json);
      } catch (e) {
        if (alive) setError(e instanceof Error ? e.message : "err");
      }
    };
    tick();
    const id = setInterval(tick, 4000);
    return () => { alive = false; clearInterval(id); };
  }, []);

  if (error) {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-rose-500/5 p-4 text-sm text-rose-300">
        <XCircle size={14} className="inline mr-1.5" />
        Erreur status : {error}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] p-4 text-sm text-neutral-400">
        <Loader2 size={14} className="animate-spin" />
        Connexion au scraper…
      </div>
    );
  }

  const s = data.status;
  const nextIn = s.next_run_at ? Math.max(0, Math.round((new Date(s.next_run_at).getTime() - Date.now()) / 1000)) : null;
  const sources = Object.entries(s.per_source);

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {s.running ? (
            <>
              <span className="relative flex h-2.5 w-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
              </span>
              <span className="font-medium text-emerald-400">Scraping en cours…</span>
            </>
          ) : s.total_runs > 0 ? (
            <>
              <CheckCircle2 size={14} className="text-emerald-400" />
              <span className="font-medium">Scraper actif</span>
            </>
          ) : (
            <>
              <Loader2 size={14} className="animate-spin text-neutral-400" />
              <span className="font-medium text-neutral-400">Initialisation…</span>
            </>
          )}
        </div>
        <div className="text-xs text-neutral-500">
          cycle #{s.cycle} ·{" "}
          {nextIn !== null ? `prochain run dans ${nextIn}s` : "premier run imminent"}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <Stat label="Total en base" value={data.total_in_db.toLocaleString("fr-FR")} highlight />
        <Stat label="Cycles" value={s.total_runs.toString()} />
        <Stat label="Inséré ce cycle" value={sources.reduce((a, [, v]) => a + (v.last_at >= (s.cycle_started_at ?? "") ? v.last_inserted : 0), 0).toString()} />
      </div>

      <div className="space-y-1.5">
        {data.by_source.map((src) => {
          const live = s.per_source[src.source];
          return (
            <div key={src.source} className="flex items-center justify-between gap-2 rounded-lg bg-[var(--background)] px-3 py-2 text-sm">
              <div className="flex items-center gap-2">
                <Activity size={11} className={live && new Date(live.last_at).getTime() > Date.now() - 60_000 ? "text-emerald-400" : "text-neutral-500"} />
                <span className="font-medium">{src.source}</span>
                {live?.error && <span className="text-xs text-rose-400" title={live.error}>⚠</span>}
              </div>
              <div className="flex items-center gap-3 text-xs">
                {live && <span className="text-neutral-500">+{live.last_inserted}</span>}
                <span className="font-mono tabular-nums">{src.n.toLocaleString("fr-FR")}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 ${highlight ? "bg-rose-500/10 ring-1 ring-rose-500/20" : "bg-[var(--background)]"}`}>
      <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
      <div className={`mt-1 font-mono font-semibold tabular-nums ${highlight ? "text-rose-300" : ""}`}>{value}</div>
    </div>
  );
}
