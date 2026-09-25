"use client";

import { useEffect, useState } from "react";
import { BRAND } from "@/lib/constants";

interface ChartTokens {
  surface: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  primary: string;
  warning: string;
  danger: string;
  success: string;
}

function read(): ChartTokens {
  if (typeof window === "undefined") {
    return {
      surface: BRAND.surface,
      border: BRAND.border,
      textPrimary: BRAND.textPrimary,
      textSecondary: BRAND.textSecondary,
      primary: BRAND.primary,
      warning: BRAND.warning,
      danger: BRAND.danger,
      success: BRAND.success,
    };
  }
  const root = getComputedStyle(document.documentElement);
  const triplet = (name: string, fallback: string) => {
    const v = root.getPropertyValue(name).trim();
    if (!v) return fallback;
    return `rgb(${v})`;
  };
  return {
    surface: triplet("--brand-surface", BRAND.surface),
    border: triplet("--brand-border", BRAND.border),
    textPrimary: triplet("--brand-text", BRAND.textPrimary),
    textSecondary: triplet("--brand-muted", BRAND.textSecondary),
    primary: BRAND.primary,
    warning: BRAND.warning,
    danger: BRAND.danger,
    success: BRAND.success,
  };
}

/**
 * Returns theme-aware color tokens for Recharts (and any other consumer
 * that can't read CSS vars directly). Re-resolves whenever the `html`
 * class list changes — i.e. when the theme toggles.
 */
export function useChartTokens(): ChartTokens {
  const [tokens, setTokens] = useState<ChartTokens>(() => read());

  useEffect(() => {
    setTokens(read());
    const observer = new MutationObserver(() => setTokens(read()));
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => observer.disconnect();
  }, []);

  return tokens;
}
