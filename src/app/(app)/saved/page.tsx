import { requireUser } from "@/lib/auth";
import { listSavedListings } from "@/lib/db";
import { ListingCard } from "@/components/listing-card";

export default async function SavedPage() {
  const user = await requireUser();
  const items = await listSavedListings(user.id);

  return (
    <div className="mx-auto max-w-7xl px-8 py-10">
      <header className="mb-6">
        <h1 className="text-3xl font-semibold">Favoris</h1>
        <p className="mt-1 text-sm text-neutral-400">
          {items.length} annonce{items.length !== 1 ? "s" : ""} sauvegardée{items.length !== 1 ? "s" : ""}
        </p>
      </header>
      {items.length === 0 ? (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-10 text-center text-neutral-400">
          Vous n&rsquo;avez encore sauvegardé aucune annonce. Cliquez sur l&rsquo;icône signet sur une annonce.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((l) => <ListingCard key={l.id} listing={l} />)}
        </div>
      )}
    </div>
  );
}
