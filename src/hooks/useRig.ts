"use client";

import { useMemo } from "react";
import { RIGS, type RigName } from "@/lib/constants";
import { slugify } from "@/lib/utils";
import type { Rig } from "@/types";

/**
 * Synchronous, network-free seed data — keeps the fleet dashboard rendering
 * in < 100 ms on first paint. When the rigs table is provisioned in Supabase,
 * swap this for a SWR/React-Query hook that hydrates from `seedRig()` and
 * revalidates in the background.
 */
function seedRig(name: RigName, index: number): Rig {
  const budget = 60_000_000 + index * 7_500_000;
  const spent = budget * (0.32 + (index % 5) * 0.07);
  const committed = budget * (0.18 - (index % 3) * 0.03);
  return {
    id: slugify(name),
    name,
    type: "Jackup",
    location: ["Mumbai High", "Krishna-Godavari", "Cauvery Basin", "Cambay Basin"][index % 4],
    operator: "ONGC",
    status: index === 4 ? "maintenance" : index === 5 ? "transit" : "operational",
    daily_rate_usd: 85_000 + index * 2500,
    contract_start: "2025-01-01",
    contract_end: "2028-12-31",
    total_budget_usd: budget,
    spent_usd: Math.round(spent),
    committed_usd: Math.round(committed),
    utilization_pct: 78 + (index % 5) * 4,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2025-01-01T00:00:00Z",
  };
}

const SEEDED_RIGS: Rig[] = RIGS.map((n, i) => seedRig(n, i));

export function useRigs() {
  // Memoize the array reference so consumers' useMemo/useEffect deps stay stable.
  const rigs = useMemo(() => SEEDED_RIGS, []);
  return { rigs, loading: false, error: null as string | null };
}

export function useRig(rigIdOrSlug: string) {
  const { rigs, loading, error } = useRigs();
  const rig = useMemo(
    () =>
      rigs.find((r) => r.id === rigIdOrSlug) ??
      rigs.find((r) => slugify(r.name) === rigIdOrSlug) ??
      null,
    [rigs, rigIdOrSlug],
  );
  return { rig, loading, error };
}
