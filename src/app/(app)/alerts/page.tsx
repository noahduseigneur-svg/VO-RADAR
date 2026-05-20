import { redirect } from "next/navigation";
import { Trash2 } from "lucide-react";
import { requireUser, newId } from "@/lib/auth";
import { createAlert, deleteAlert, listAlerts, matchListingsForRule } from "@/lib/db";
import type { AlertRule, Fuel } from "@/lib/types";

const FUELS: Fuel[] = ["essence", "diesel", "hybride", "electrique", "gpl"];

async function createAlertAction(formData: FormData) {
  "use server";
  const user = await requireUser();
  const rule: AlertRule = {
    id: newId("a_"),
    user_id: user.id,
    name: String(formData.get("name") || "Alerte sans nom"),
    brand: strOrNull(formData.get("brand")),
    model: strOrNull(formData.get("model")),
    max_price_eur: numOrNull(formData.get("max_price_eur")),
    max_mileage_km: numOrNull(formData.get("max_mileage_km")),
    min_year: numOrNull(formData.get("min_year")),
    fuel: (strOrNull(formData.get("fuel")) as Fuel | null) ?? null,
    min_score: Math.max(0, Math.min(100, Number(formData.get("min_score") ?? 70))),
    region: strOrNull(formData.get("region")),
    active: 1,
    created_at: new Date().toISOString(),
  };
  await createAlert(rule);
  redirect("/alerts");
}

async function deleteAlertAction(formData: FormData) {
  "use server";
  const user = await requireUser();
  const id = String(formData.get("id") || "");
  if (id) await deleteAlert(user.id, id);
  redirect("/alerts");
}

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = (v ?? "").toString().trim();
  return s.length ? s : null;
}

function numOrNull(v: FormDataEntryValue | null): number | null {
  const s = (v ?? "").toString().trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export default async function AlertsPage() {
  const user = await requireUser();
  const rules = await listAlerts(user.id);

  // Fetch matches for all rules in parallel
  const matchCounts = await Promise.all(
    rules.map((r) => matchListingsForRule(r, 5))
  );

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Alertes</h1>
        <p className="mt-1 text-sm text-neutral-400">Recevez une notification dès qu&rsquo;une annonce matche vos critères.</p>
      </header>

      <form action={createAlertAction} className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-[var(--border)] bg-[var(--card)] p-5 md:grid-cols-4">
        <Field label="Nom de l'alerte" name="name" placeholder="Ex: Clio 5 pépites" />
        <Field label="Marque" name="brand" placeholder="Renault" />
        <Field label="Modèle" name="model" placeholder="Clio" />
        <Field label="Prix max (€)" name="max_price_eur" type="number" placeholder="15000" />
        <Field label="Km max" name="max_mileage_km" type="number" placeholder="80000" />
        <Field label="Année min" name="min_year" type="number" placeholder="2019" />
        <label className="flex flex-col">
          <span className="mb-1 text-xs uppercase tracking-wide text-neutral-400">Carburant</span>
          <select name="fuel" className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm">
            <option value="">Tous</option>
            {FUELS.map((f) => <option key={f} value={f}>{f}</option>)}
          </select>
        </label>
        <Field label="Score mini" name="min_score" type="number" defaultValue="70" />
        <button className="col-span-2 mt-2 rounded-lg bg-rose-500 px-4 py-2 text-sm font-medium text-white hover:bg-rose-400 md:col-span-4">
          Créer l&rsquo;alerte
        </button>
      </form>

      {rules.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-10 text-center text-neutral-400">
          Vous n&rsquo;avez pas encore d&rsquo;alerte. Créez-en une pour ne plus rien manquer.
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((r, idx) => {
            const matches = matchCounts[idx];
            return (
              <div key={r.id} className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="font-medium">{r.name}</h3>
                    <p className="mt-1 text-xs text-neutral-400">
                      {[r.brand, r.model, r.fuel, r.region].filter(Boolean).join(" · ") || "Tous critères"}
                      {r.max_price_eur && ` · ≤ ${r.max_price_eur} €`}
                      {r.max_mileage_km && ` · ≤ ${r.max_mileage_km} km`}
                      {r.min_year && ` · ≥ ${r.min_year}`}
                      {` · score ≥ ${r.min_score}`}
                    </p>
                  </div>
                  <form action={deleteAlertAction}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="rounded-lg p-2 text-neutral-500 hover:bg-neutral-800 hover:text-rose-400" aria-label="Supprimer">
                      <Trash2 size={14} />
                    </button>
                  </form>
                </div>
                <div className="mt-3 text-xs text-neutral-400">
                  {matches.length} annonce{matches.length !== 1 ? "s" : ""} actuelles{matches.length > 0 && ` · plus récente : ${matches[0].brand} ${matches[0].model} à ${matches[0].price_eur.toLocaleString("fr-FR")} €`}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Field({ label, name, ...rest }: { label: string; name: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col">
      <span className="mb-1 text-xs uppercase tracking-wide text-neutral-400">{label}</span>
      <input name={name} {...rest} className="rounded-lg border border-[var(--border)] bg-[var(--background)] px-3 py-2 text-sm focus:border-rose-500 focus:outline-none" />
    </label>
  );
}
