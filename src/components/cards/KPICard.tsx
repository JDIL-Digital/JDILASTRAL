"use client";

import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { cn, formatCompact } from "@/lib/utils";
import { useCountUp } from "@/hooks/useCountUp";
import type { KPI } from "@/types";

interface KPICardProps extends KPI {
  className?: string;
  /** Stagger delay for entry animation */
  index?: number;
  /**
   * Optional numeric value for count-up animation.
   * If provided, `value` is treated as a presentation override (e.g. for prefix/suffix).
   * Pass a `format` to render the animated number.
   */
  numericValue?: number;
  format?: (n: number) => string;
  decimals?: number;
}

export function KPICard({
  label,
  value,
  delta,
  deltaLabel,
  trend = "neutral",
  intent = "neutral",
  icon,
  hint,
  className,
  index = 0,
  numericValue,
  format,
  decimals = 0,
}: KPICardProps) {
  const animated = useCountUp(numericValue ?? 0, { decimals, duration: 900, delay: index * 70 });
  const display =
    numericValue !== undefined
      ? format
        ? format(animated)
        : animated.toLocaleString("en-US", { maximumFractionDigits: decimals })
      : value;

  const Arrow = trend === "up" ? ArrowUpRight : trend === "down" ? ArrowDownRight : Minus;
  const trendColor =
    intent === "positive"
      ? "text-brand-success"
      : intent === "negative"
        ? "text-brand-danger"
        : "text-brand-muted";

  const stepClass = `delay-step-${Math.min(7, index)}`;

  return (
    <div
      className={cn(
        // base card
        "group relative overflow-hidden rounded-xl border border-brand-border bg-brand-surface transition-all duration-200",
        "animate-fade-in-up",
        stepClass,
        // dark — green top border accent + subtle glow on hover
        "dark:before:absolute dark:before:left-0 dark:before:right-0 dark:before:top-0 dark:before:h-[3px]",
        "dark:before:bg-gradient-to-r dark:before:from-brand-green dark:before:via-brand-green-bright dark:before:to-brand-green",
        "dark:hover:shadow-[0_0_0_1px_rgba(26,122,60,0.4),0_18px_40px_-22px_rgba(26,122,60,0.45)]",
        // light — green LEFT border accent + subtle shadow on hover
        "light:border-l-[3px] light:border-l-brand-green",
        "light:hover:shadow-[0_8px_24px_-12px_rgba(13,27,42,0.18)]",
        className,
      )}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-1">
            <p className="text-label truncate">{label}</p>
            <p className="text-kpi text-2xl text-brand-text md:text-[26px]">{display}</p>
          </div>
          {icon ? (
            <div className="rounded-lg border border-brand-border bg-brand-bg/60 p-2 text-brand-green transition-colors group-hover:border-brand-green/50 group-hover:text-brand-green-bright">
              {icon}
            </div>
          ) : null}
        </div>

        {(delta !== undefined || hint) && (
          <div className="mt-3 flex items-center gap-2 text-xs">
            {delta !== undefined && (
              <span className={cn("inline-flex items-center gap-1 font-medium", trendColor)}>
                <Arrow className="h-3.5 w-3.5" />
                {delta > 0 ? "+" : ""}
                {delta.toFixed(1)}%
              </span>
            )}
            {deltaLabel && <span className="text-brand-muted">{deltaLabel}</span>}
            {hint && !deltaLabel && <span className="text-brand-muted">{hint}</span>}
          </div>
        )}
      </div>
    </div>
  );
}

/** Convenience format helpers for use with KPICard's `format` prop. */
export const kpiFormatters = {
  currencyCompact: (n: number) => `$${formatCompact(n)}`,
  percent: (n: number) => `${n.toFixed(1)}%`,
  integer: (n: number) => n.toLocaleString("en-US"),
};
