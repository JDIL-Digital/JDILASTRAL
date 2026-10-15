"use client";

import { useMemo } from "react";
import Link from "next/link";
import { ArrowRight, Calendar, DollarSign } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/Skeletons";
import { QueryError, EmptyState } from "@/components/ui/ErrorBoundary";
import { useProjects, type ProjectWithRig } from "@/hooks/useProjects";
import { useRigs } from "@/hooks/useRigs";
import { useAnnexures } from "@/hooks/useAnnexures";
import { cn, formatCompact, formatCurrency, formatDate } from "@/lib/utils";
import type { ProjectStatus } from "@/types/database";

const STATUS_VARIANT: Record<ProjectStatus, "default" | "warning" | "secondary"> = {
  active: "default",
  completed: "secondary",
  "on-hold": "warning",
};

export default function ProjectsPage() {
  const { projects, loading, error, refresh } = useProjects();
  const { rigs } = useRigs();

  // Group projects by rig
  const grouped = useMemo(() => {
    const map = new Map<string, { rigName: string; projects: ProjectWithRig[] }>();
    rigs.forEach((rig) =>
      map.set(rig.id, { rigName: rig.name, projects: [] }),
    );
    projects.forEach((p) => {
      const key = p.rig_id ?? "unassigned";
      const entry =
        map.get(key) ??
        (map.set(key, { rigName: p.rigs?.name ?? "Unassigned", projects: [] }), map.get(key)!);
      entry.projects.push(p);
    });
    return Array.from(map.values()).filter((g) => g.projects.length > 0);
  }, [projects, rigs]);

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-brand-green md:text-3xl">
            Projects
          </h1>
          <p className="text-sm text-brand-muted">
            Active cost books across the fleet — pick one to drill into its 11 annexures.
          </p>
        </div>
        <span className="rounded-full border border-brand-border bg-brand-surface px-3 py-1 text-xs text-brand-muted">
          {projects.length} project{projects.length === 1 ? "" : "s"}
        </span>
      </header>

      {error ? (
        <QueryError message={error} onRetry={() => void refresh()} />
      ) : loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : grouped.length === 0 ? (
        <EmptyState
          title="No projects yet"
          message="Insert rows into public.projects to populate this page."
        />
      ) : (
        <div className="space-y-8">
          {grouped.map((group) => (
            <section key={group.rigName}>
              <div className="mb-3 flex items-end justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-brand-muted">
                  {group.rigName}
                </h2>
                <span className="text-xs text-brand-muted">
                  {group.projects.length} project{group.projects.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {group.projects.map((p) => (
                  <ProjectCard key={p.id} project={p} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

/**
 * One card per project. Fetches the project's annexures so the burn %
 * reflects actual line-item spend, not just the planned top-level budget.
 */
function ProjectCard({ project }: { project: ProjectWithRig }) {
  const { annexures } = useAnnexures(project.id);
  const spent = annexures.reduce((s, a) => s + a.total_actual, 0);
  const budget = Number(project.total_budget_usd ?? 0);
  const burnPct = budget > 0 ? Math.min(100, (spent / budget) * 100) : 0;
  const barColor =
    burnPct > 90 ? "bg-brand-danger" : burnPct > 70 ? "bg-brand-warning" : "bg-brand-green";
  const firstAnnexure = annexures[0] ?? null;

  return (
    <Card className="transition-colors hover:border-brand-green/40">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base leading-tight">{project.name}</CardTitle>
          <Badge variant={STATUS_VARIANT[project.status] ?? "secondary"} className="capitalize">
            {project.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pt-0">
        <div className="flex items-center gap-3 text-xs text-brand-muted">
          <span className="inline-flex items-center gap-1">
            <DollarSign className="h-3 w-3" /> ${formatCompact(budget)}
          </span>
          {project.start_date && (
            <span className="inline-flex items-center gap-1">
              <Calendar className="h-3 w-3" /> {formatDate(project.start_date)}
            </span>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-brand-muted">Spent</span>
            <span className="font-medium text-brand-text">
              ${formatCompact(spent)} · {burnPct.toFixed(1)}%
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-brand-border/50">
            <div
              className={cn("h-full rounded-full transition-all duration-500", barColor)}
              style={{ width: `${burnPct}%` }}
            />
          </div>
        </div>

        <div className="flex items-center justify-between pt-1">
          <span className="text-xs text-brand-muted">
            {annexures.length} annexure{annexures.length === 1 ? "" : "s"}
          </span>
          <Link
            href={
              firstAnnexure
                ? `/projects/${project.id}/annexures/${firstAnnexure.id}`
                : `/projects/${project.id}/annexures/`
            }
          >
            <Button variant="outline" size="sm">
              Open Annexures <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </Link>
        </div>

        <div className="flex items-center justify-between pt-1 text-xs text-brand-muted">
          <span>
            Budget {formatCurrency(budget, "USD")}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
