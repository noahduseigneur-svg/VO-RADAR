"use client";

import { useState, useCallback } from "react";
import { ListingCard } from "./listing-card";
import { BulkActionBar } from "./bulk-action-bar";
import type { Listing } from "@/lib/types";
import type { DealStatus } from "@/lib/db";

interface ListingsWithBulkProps {
  listings: Listing[];
  savedIds: string[];
  dealStatuses: Record<string, DealStatus>;
  prevVisit: string | null;
}

export function ListingsWithBulk({
  listings,
  savedIds,
  dealStatuses,
  prevVisit,
}: ListingsWithBulkProps) {
  const savedSet = new Set(savedIds);
  const dealMap = new Map(Object.entries(dealStatuses)) as Map<string, DealStatus>;
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const handleSelect = useCallback((id: string, selected: boolean) => {
    setSelectedIds((prev) =>
      selected ? (prev.includes(id) ? prev : [...prev, id]) : prev.filter((x) => x !== id)
    );
  }, []);

  const handleClear = useCallback(() => setSelectedIds([]), []);

  return (
    <>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {listings.map((l) => (
          <ListingCard
            key={l.id}
            listing={l}
            savedInitial={savedSet.has(l.id)}
            dealStatus={dealMap.get(l.id) ?? null}
            isNew={prevVisit ? l.fetched_at > prevVisit : false}
            onSelect={handleSelect}
            selected={selectedIds.includes(l.id)}
          />
        ))}
      </div>
      <BulkActionBar selectedIds={selectedIds} onClear={handleClear} />
    </>
  );
}
