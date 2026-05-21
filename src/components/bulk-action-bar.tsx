"use client";

import { useRouter } from "next/navigation";

interface BulkActionBarProps {
  selectedIds: string[];
  onClear: () => void;
}

export function BulkActionBar({ selectedIds, onClear }: BulkActionBarProps) {
  const router = useRouter();

  if (selectedIds.length === 0) return null;

  async function handleAddToPipeline() {
    await Promise.all(
      selectedIds.map((listing_id) =>
        fetch("/api/pipeline", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ listing_id, status: "watching" }),
        })
      )
    );
    onClear();
  }

  function handleCompare() {
    router.push(`/compare?ids=${selectedIds.slice(0, 3).join(",")}`);
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
      <div className="bg-neutral-900 border border-neutral-700 rounded-2xl shadow-2xl px-5 py-3 flex items-center gap-4">
        <span className="text-sm text-neutral-300 font-medium">
          {selectedIds.length} sélectionné{selectedIds.length > 1 ? "s" : ""}
        </span>
        <button
          onClick={handleAddToPipeline}
          className="rounded-lg bg-rose-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-600 transition-colors"
        >
          Ajouter au pipeline
        </button>
        <button
          onClick={handleCompare}
          className="rounded-lg border border-neutral-600 px-3 py-1.5 text-xs font-medium text-neutral-200 hover:border-neutral-400 hover:text-white transition-colors"
        >
          Comparer
        </button>
        <button
          onClick={onClear}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-neutral-400 hover:text-white transition-colors"
        >
          Désélectionner tout
        </button>
      </div>
    </div>
  );
}
