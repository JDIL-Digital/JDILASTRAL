"use client";

import { useMemo } from "react";
import { ANNEXURES } from "@/lib/constants";
import { slugify } from "@/lib/utils";
import type { Annexure } from "@/types";

/**
 * Synchronous seed data — see hooks/useRig.ts for the rationale.
 */
function seedAnnexure(projectId: string, name: string, index: number): Annexure {
  const budget = 1_200_000 + index * 250_000;
  const spent = budget * (0.28 + (index % 4) * 0.09);
  const committed = budget * (0.12 + (index % 3) * 0.04);
  return {
    id: `${projectId}-annex-${index}`,
    project_id: projectId,
    code: `ANX-${String.fromCharCode(65 + index)}`,
    name: name as Annexure["name"],
    description: null,
    budget_usd: budget,
    spent_usd: Math.round(spent),
    committed_usd: Math.round(committed),
    variance_pct: -3 + index * 1.2,
    owner_id: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

export function useAnnexures(projectId: string) {
  const annexures = useMemo(
    () => ANNEXURES.map((n, i) => seedAnnexure(projectId, n, i)),
    [projectId],
  );
  return { annexures, loading: false, error: null as string | null };
}

export function useAnnexure(projectId: string, annexureId: string) {
  const { annexures, loading, error } = useAnnexures(projectId);
  const annexure = useMemo(
    () =>
      annexures.find((a) => a.id === annexureId) ??
      annexures.find((a) => slugify(a.code) === annexureId) ??
      annexures.find((a) => slugify(a.name) === annexureId) ??
      null,
    [annexures, annexureId],
  );
  return { annexure, loading, error };
}
