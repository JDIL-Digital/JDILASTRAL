/**
 * Reusable skeleton placeholders for JSIL·ASTRAL.
 *
 * All variants use `animate-pulse` against brand-aware tokens so they look
 * right in both dark and light modes. Render these inside Suspense
 * boundaries / `dynamic({ loading: ... })` / conditional renders to keep
 * the layout from flashing while heavy components load.
 */

import { cn } from "@/lib/utils";

interface SkeletonProps extends React.HTMLAttributes<HTMLDivElement> {
  className?: string;
}

/** Atomic skeleton block — the same shape every other skeleton is composed from. */
export function SkeletonBlock({ className, ...props }: SkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading"
      className={cn("animate-pulse rounded-md bg-brand-border/55", className)}
      {...props}
    />
  );
}

/** KPI card skeleton — matches KPICard footprint exactly so the page doesn't reflow. */
export function CardSkeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-brand-border bg-brand-surface p-5",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2">
          <SkeletonBlock className="h-3 w-24" />
          <SkeletonBlock className="h-7 w-32" />
        </div>
        <SkeletonBlock className="h-10 w-10 rounded-lg" />
      </div>
      <SkeletonBlock className="mt-4 h-3 w-32" />
    </div>
  );
}

/** Chart placeholder — uses a bar/line silhouette so the page reads as "chart here". */
export function ChartSkeleton({
  className,
  height = 280,
  ...props
}: SkeletonProps & { height?: number }) {
  return (
    <div
      className={cn(
        "flex w-full items-end justify-between gap-2 overflow-hidden rounded-lg border border-brand-border bg-brand-surface/60 p-4",
        className,
      )}
      style={{ height }}
      {...props}
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <SkeletonBlock
          key={i}
          className="w-full"
          style={{ height: `${30 + Math.abs(((i * 37) % 60))}%` }}
        />
      ))}
    </div>
  );
}

/** Donut placeholder — round skeleton with a hole. */
export function DonutSkeleton({ size = 220 }: { size?: number }) {
  return (
    <div
      role="status"
      aria-label="Loading chart"
      className="relative mx-auto flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <div className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-br from-brand-border/70 to-brand-border/30" />
      <div className="relative h-1/2 w-1/2 rounded-full bg-brand-surface" />
    </div>
  );
}

/** Table placeholder — header row + N body rows. */
export function TableSkeleton({
  rows = 8,
  columns = 6,
  className,
}: {
  rows?: number;
  columns?: number;
  className?: string;
}) {
  return (
    <div className={cn("overflow-hidden rounded-xl border border-brand-border", className)}>
      <div className="border-b border-brand-border bg-brand-bg/40 px-4 py-3">
        <div className="flex gap-4">
          {Array.from({ length: columns }).map((_, i) => (
            <SkeletonBlock key={`h-${i}`} className="h-3 flex-1" />
          ))}
        </div>
      </div>
      <div className="divide-y divide-brand-border">
        {Array.from({ length: rows }).map((_, r) => (
          <div key={`r-${r}`} className="flex items-center gap-4 px-4 py-3">
            {Array.from({ length: columns }).map((__, c) => (
              <SkeletonBlock
                key={`c-${r}-${c}`}
                className={cn("h-3 flex-1", c === 0 && "max-w-[80px]")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Rig card skeleton — same 280 px frame as RigCard so the grid keeps its shape. */
export function RigCardSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative h-[280px] overflow-hidden rounded-2xl border border-brand-border",
        className,
      )}
    >
      <div className="absolute inset-0 animate-pulse bg-gradient-to-br from-brand-green/15 via-brand-surface to-brand-bg" />
      <div className="absolute left-4 top-4">
        <SkeletonBlock className="h-5 w-20 rounded-full" />
      </div>
      <div className="absolute inset-x-0 bottom-0 space-y-3 border-t border-brand-green/20 bg-brand-bg/60 p-4 backdrop-blur-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-2">
            <SkeletonBlock className="h-2 w-32" />
            <SkeletonBlock className="h-5 w-40" />
          </div>
          <SkeletonBlock className="h-8 w-16" />
        </div>
        <SkeletonBlock className="h-1.5 w-full rounded-full" />
        <div className="flex justify-between">
          <SkeletonBlock className="h-3 w-20" />
          <SkeletonBlock className="h-3 w-20" />
        </div>
      </div>
    </div>
  );
}

/** Full-page loading state. */
export function PageSkeleton() {
  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <section className="space-y-3 rounded-2xl border border-brand-border bg-brand-surface p-6">
        <SkeletonBlock className="h-4 w-24" />
        <SkeletonBlock className="h-9 w-72" />
        <SkeletonBlock className="h-3 w-96" />
      </section>
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </section>
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-5">
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5 lg:col-span-2">
          <SkeletonBlock className="mb-4 h-4 w-40" />
          <DonutSkeleton />
        </div>
        <div className="rounded-xl border border-brand-border bg-brand-surface p-5 lg:col-span-3">
          <SkeletonBlock className="mb-4 h-4 w-40" />
          <ChartSkeleton />
        </div>
      </section>
      <section className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <RigCardSkeleton key={i} />
        ))}
      </section>
    </main>
  );
}
