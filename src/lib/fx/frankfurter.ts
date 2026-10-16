/**
 * Frankfurter.app FX fetcher — cache-first.
 *
 * 1. Look in `public.exchange_rates` for the exact (base, target, date).
 * 2. If not cached, fetch from https://api.frankfurter.app/{date}?from=USD&to=X.
 * 3. Upsert the fetched rate so subsequent lookups are instant.
 *
 * All dates are ISO yyyy-MM-dd. `base` is always "USD" for JDIL·ASTRAL —
 * the schema permits other bases, but every line_item converts to USD
 * so there's no reason to cache the inverse.
 */

"use client";

import { getSupabaseBrowserClient } from "@/lib/supabase/client";
import type { Currency } from "@/lib/constants";

const FRANKFURTER_BASE = "https://api.frankfurter.app";
const FX_SOURCE = "frankfurter.app";

/** USD → USD is always 1. Short-circuit before any network / DB call. */
function identityRate(base: Currency, target: Currency): number | null {
  return base === target ? 1 : null;
}

/** Normalize a date-ish value to yyyy-MM-dd (Frankfurter's required form). */
function toISODate(date: string | Date): string {
  const d = typeof date === "string" ? new Date(date) : date;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** True when the given ISO date is today (local). */
function isToday(iso: string): boolean {
  return iso === toISODate(new Date());
}

interface FxLookupResult {
  rate: number;
  source: "cache" | "frankfurter" | "identity" | "fallback";
}

/** Fallback rates when both cache + Frankfurter are unreachable (offline dev). */
const FALLBACK_USD_RATES: Record<Currency, number> = {
  USD: 1,
  INR: 83.3,
  AED: 3.673,
};

/**
 * Resolve `1 base = X target` for a given date. Writes a cache row on
 * successful network fetch; never throws — degrades to a fallback rate.
 */
export async function getFxRate(
  base: Currency,
  target: Currency,
  date: string | Date,
): Promise<FxLookupResult> {
  const identity = identityRate(base, target);
  if (identity !== null) return { rate: identity, source: "identity" };

  const iso = toISODate(date);
  const client = getSupabaseBrowserClient();

  // 1. Cache hit?
  if (client) {
    try {
      const { data } = await client
        .from("exchange_rates")
        .select("rate")
        .eq("base_currency", base)
        .eq("target_currency", target)
        .eq("rate_date", iso)
        .maybeSingle();
      if (data && typeof (data as { rate?: number }).rate === "number") {
        return { rate: Number((data as { rate: number }).rate), source: "cache" };
      }
    } catch {
      /* Cache miss — fall through to the network path. */
    }
  }

  // 2. Frankfurter — latest vs historical use different paths.
  try {
    const path = isToday(iso) ? "/latest" : `/${iso}`;
    const url = `${FRANKFURTER_BASE}${path}?from=${base}&to=${target}`;
    const res = await fetch(url);
    if (res.ok) {
      const payload = (await res.json()) as { rates?: Record<string, number> };
      const rate = payload.rates?.[target];
      if (typeof rate === "number" && Number.isFinite(rate) && rate > 0) {
        // 3. Persist the rate for next time. Fire-and-forget — a cache
        // write failure must never block the FX result.
        if (client) {
          void (
            client.from("exchange_rates") as unknown as {
              upsert: (
                v: {
                  base_currency: string;
                  target_currency: string;
                  rate: number;
                  rate_date: string;
                  source: string;
                },
                opts: { onConflict: string },
              ) => Promise<unknown>;
            }
          ).upsert(
            {
              base_currency: base,
              target_currency: target,
              rate,
              rate_date: iso,
              source: FX_SOURCE,
            },
            { onConflict: "base_currency,target_currency,rate_date" },
          );
        }
        return { rate, source: "frankfurter" };
      }
    }
  } catch {
    /* Network down — fall through to fallback. */
  }

  // 4. Last-resort fallback — the hardcoded "near enough" table so the
  // UI keeps rendering sensible numbers in offline dev.
  const baseToUsd = base === "USD" ? 1 : 1 / FALLBACK_USD_RATES[base];
  const usdToTarget = target === "USD" ? 1 : FALLBACK_USD_RATES[target];
  return { rate: baseToUsd * usdToTarget, source: "fallback" };
}

/** Convenience — compute USD from a local amount in one call. */
export async function toUsd(
  amount: number,
  currency: Currency,
  date: string | Date,
): Promise<{ usd: number; rate: number; source: FxLookupResult["source"] }> {
  if (currency === "USD") return { usd: amount, rate: 1, source: "identity" };
  const { rate, source } = await getFxRate(currency, "USD", date);
  return { usd: amount * rate, rate, source };
}
