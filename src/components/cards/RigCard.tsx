"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn, formatCompact } from "@/lib/utils";
import { rigMetaFor } from "@/lib/rigMeta";
import { BLUR_DATA_URL, type RigName } from "@/lib/constants";
import type { Rig } from "@/types";

/**
 * The card accepts any rig-like row (Supabase's `rigs` table returns a
 * plain `string` name, not the strict `RigName` union). We narrow to
 * `RigName` only when looking up display metadata.
 */
type RigLike = Omit<Partial<Rig>, "name"> & { name: string };

interface RigCardProps {
  rig: RigLike;
  className?: string;
  /** Index drives the staggered fade-in delay on the fleet grid. */
  index?: number;
}

export function RigCard({ rig, className, index = 0 }: RigCardProps) {
  const meta = rigMetaFor(rig.name as RigName, rig.status);
  const [photoFailed, setPhotoFailed] = useState(false);
  const spent = rig.spent_usd ?? 0;
  const budget = rig.total_budget_usd ?? 0;
  const burnPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const burnColor =
    burnPct > 90 ? "bg-brand-danger" : burnPct > 70 ? "bg-brand-warning" : "bg-brand-green";
  const stepClass = `delay-step-${Math.min(7, index)}`;

  // Prefer the DB UUID when it's a real id; the dashboard's `useRig()`
  // transparently supports both uuid and slug lookup, so this is safe
  // whether or not the backing hook has returned real data yet.
  const isUuid =
    typeof rig.id === "string" &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(rig.id);
  const href = `/rig/${isUuid ? rig.id : meta.slug}`;

  return (
    <Link
      href={href}
      className={cn(
        "group relative block min-h-[280px] overflow-hidden rounded-2xl border border-brand-border",
        "animate-fade-in-up will-change-transform",
        "transition-all duration-300 hover:border-brand-green/60",
        "hover:shadow-card-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-green",
        stepClass,
        className,
      )}
    >
      {/* Fallback gradient — always renders behind the photo so the card never looks empty */}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-br from-brand-green/35 via-brand-bg to-brand-bg"
      />

      {/* Rig photo — Next/Image with blur placeholder + AVIF/WebP auto-serving.
          If the file is missing we hide the Image and the fallback gradient takes over. */}
      {!photoFailed && (
        <Image
          src={meta.photo}
          alt={`${rig.name} rig`}
          fill
          sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
          placeholder="blur"
          blurDataURL={BLUR_DATA_URL}
          loading="lazy"
          className={cn(
            "object-cover",
            "transition-transform duration-500 ease-out group-hover:scale-[1.06]",
          )}
          onError={() => setPhotoFailed(true)}
        />
      )}

      {/* Dark gradient overlay — theme-aware via CSS var */}
      <div aria-hidden className="rig-photo-overlay absolute inset-0" />

      {/* Top status pill */}
      <div className="absolute left-4 top-4 z-10 flex items-center gap-2">
        <Badge
          variant={meta.statusBadge}
          className={cn(
            "inline-flex items-center gap-1.5 border-0 px-2.5 py-0.5 text-[10px] font-bold tracking-wider backdrop-blur-md",
            meta.status === "active" && "bg-brand-success/20 text-brand-success",
            meta.status === "maintenance" && "bg-brand-warning/20 text-brand-warning",
            meta.status === "standby" && "bg-slate-400/25 text-slate-100",
          )}
        >
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              meta.statusDot,
              meta.status === "active" && "animate-pulse-dot",
            )}
          />
          {meta.statusLabel}
        </Badge>
      </div>

      {/* Glassmorphism data panel pinned to the bottom */}
      <div className="rig-panel absolute inset-x-0 bottom-0 z-10 p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-wider opacity-80">
              {rig.type ?? "Jackup"} · {rig.location ?? "Mumbai High"}
            </p>
            <h3 className="truncate text-lg font-bold leading-tight">{rig.name}</h3>
          </div>
          <div className="text-right text-[10px] uppercase tracking-wider opacity-70">
            Day Rate
            <div className="text-sm font-bold normal-case tracking-tight">
              ${formatCompact(rig.daily_rate_usd ?? 0)}
            </div>
          </div>
        </div>

        {/* Progress bar */}
        <div className="mt-3">
          <div className="mb-1 flex items-baseline justify-between text-[10px] font-semibold uppercase tracking-wider opacity-70">
            <span>Budget Burn</span>
            <span className="font-mono normal-case opacity-100">{burnPct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/15">
            <div
              className={cn("h-full rounded-full transition-all duration-700", burnColor)}
              style={{ width: `${burnPct}%` }}
            />
          </div>
        </div>

        {/* Budget vs Spent + CTA */}
        <div className="mt-3 flex items-end justify-between gap-3">
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                Budget
              </div>
              <div className="text-sm font-bold tabular-nums">
                ${formatCompact(budget)}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider opacity-70">
                Spent
              </div>
              <div className="text-sm font-bold tabular-nums">
                ${formatCompact(spent)}
              </div>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-brand-green-bright transition-transform group-hover:translate-x-0.5">
            View Dashboard
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </Link>
  );
}
