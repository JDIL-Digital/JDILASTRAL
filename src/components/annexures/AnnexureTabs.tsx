"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import type { AnnexureWithTotals } from "@/hooks/useAnnexures";

interface AnnexureTabsProps {
  projectId: string;
  annexures: AnnexureWithTotals[];
  currentAnnexureId: string | null;
}

const ROMAN = [
  "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX", "X", "XI", "XII",
];

function toRoman(n: number): string {
  return ROMAN[n - 1] ?? String(n);
}

/**
 * Desktop: horizontal tab bar with active-tab Jindal-Green underline + count badge.
 * Mobile: a `<select>` that navigates on change.
 */
export function AnnexureTabs({ projectId, annexures, currentAnnexureId }: AnnexureTabsProps) {
  const router = useRouter();

  if (annexures.length === 0) return null;

  return (
    <div>
      {/* ---------- Mobile dropdown ---------- */}
      <div className="md:hidden">
        <select
          value={currentAnnexureId ?? ""}
          onChange={(e) =>
            router.push(`/projects/${projectId}/annexures/${e.target.value}`)
          }
          className="h-10 w-full rounded-md border border-brand-border bg-brand-surface px-3 text-sm text-brand-text"
        >
          {annexures.map((a) => (
            <option key={a.id} value={a.id}>
              {toRoman(a.number)} — {a.name} ({a.line_count})
            </option>
          ))}
        </select>
      </div>

      {/* ---------- Desktop tabs ---------- */}
      <div
        role="tablist"
        aria-label="Annexures"
        className="hidden items-end gap-1 overflow-x-auto border-b border-brand-border md:flex"
      >
        {annexures.map((a) => {
          const active = a.id === currentAnnexureId;
          return (
            <Link
              key={a.id}
              role="tab"
              aria-selected={active}
              href={`/projects/${projectId}/annexures/${a.id}`}
              className={cn(
                "group relative inline-flex items-center gap-2 whitespace-nowrap px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors",
                active
                  ? "text-brand-green"
                  : "text-brand-muted hover:text-brand-text",
              )}
            >
              <span className="font-mono text-[10px] opacity-70">
                {toRoman(a.number)}
              </span>
              <span>{a.name}</span>
              <span
                className={cn(
                  "ml-1 inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0 text-[9px] font-bold tabular-nums",
                  active
                    ? "bg-brand-green/15 text-brand-green"
                    : "bg-brand-border/50 text-brand-muted",
                )}
              >
                {a.line_count}
              </span>
              {active && (
                <span
                  aria-hidden
                  className="absolute inset-x-2 bottom-[-1px] h-[2px] rounded-full bg-brand-green"
                />
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
