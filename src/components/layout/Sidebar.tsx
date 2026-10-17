"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BarChart2,
  Briefcase,
  FileText,
  LayoutDashboard,
  LogOut,
  Plug,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { APP, BRAND, RIGS, ROLE_LABELS } from "@/lib/constants";
import { cn, slugify } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useProjects } from "@/hooks/useProjects";
import { useAnnexures } from "@/hooks/useAnnexures";
import { useRigs } from "@/hooks/useRigs";
import { rigMetaFor } from "@/lib/rigMeta";
import type { DbRig } from "@/types/database";

const NAV = [
  { href: "/fleet", label: "Fleet Overview", icon: LayoutDashboard },
  { href: "/projects", label: "Projects", icon: Briefcase },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/purchase-orders", label: "Purchase Orders", icon: FileText },
  { href: "/admin", label: "Administration", icon: ShieldCheck },
  { href: "/admin/bc-sync", label: "Business Central", icon: Plug },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, profile, role, signOut, isAuthenticated } = useAuth();
  const { projects } = useProjects();
  const { rigs: dbRigs } = useRigs();

  // Role is already resolved by useAuth (profile.role → default 'engineer').
  // Display name prefers profile.full_name, then the Supabase user's email.
  const roleLabel = isAuthenticated ? ROLE_LABELS[role] : "Not signed in";
  const displayName =
    profile?.full_name ?? user?.email ?? "Guest User";

  // Prefer real DB rig rows (with UUIDs) over the hardcoded slug list.
  // Falls back to the slug list only when the DB hasn't returned yet,
  // so the sidebar always has something to render.
  const rigList: Array<{ key: string; id: string; name: string; status: DbRig["status"] | null }> =
    dbRigs.length > 0
      ? dbRigs.map((r) => ({ key: r.id, id: r.id, name: r.name, status: r.status }))
      : RIGS.map((name) => ({
          key: name,
          id: slugify(name),
          name,
          status: null,
        }));

  // Aggressively prefetch every primary route on mount so subsequent
  // clicks navigate instantly with no extra round-trip.
  useEffect(() => {
    const main = ["/fleet", "/projects", "/analytics", "/purchase-orders", "/admin", "/admin/bc-sync"];
    main.forEach((r) => router.prefetch(r));
    rigList.forEach((r) => router.prefetch(`/rig/${r.id}`));
    projects.forEach((p) => router.prefetch(`/projects/${p.id}/annexures/`));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [router, projects, dbRigs.length]);

  const initials = displayName
    ? displayName
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "JD";

  return (
    <aside className="sidebar-shell hidden h-screen w-64 shrink-0 border-r border-brand-border md:flex md:flex-col">
      {/* Logo block */}
      <div className="flex flex-col items-center gap-2 border-b border-brand-border px-5 py-5 text-center">
        <div className="flex h-14 w-full max-w-[180px] items-center justify-center rounded-md bg-white px-3 py-2 shadow-sm">
          <Image
            src="/jindal-logo.jpg"
            alt="Jindal Drilling & Industries Ltd."
            width={160}
            height={48}
            priority
            unoptimized
            className="max-h-12 w-auto object-contain"
          />
        </div>
        <p
          className="font-bold leading-none"
          style={{ color: BRAND.primary, fontSize: "18px" }}
        >
          {APP.name}
        </p>
        <p
          className="leading-snug"
          style={{
            color: BRAND.textSecondary,
            fontSize: "10px",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          }}
        >
          {APP.tagline}
        </p>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <p className="px-3 pb-2 text-label">Workspace</p>
        <ul className="space-y-1">
          {NAV.map((item, i) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const Icon = item.icon;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  prefetch={true}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md py-2 pl-4 pr-3 text-sm transition-all duration-200",
                    "hover:bg-brand-green/10 hover:translate-x-0.5",
                    active
                      ? "bg-brand-green/12 text-brand-green font-semibold"
                      : "text-brand-text/90 hover:text-brand-text",
                    `delay-step-${Math.min(7, i)}`,
                    "animate-fade-in",
                  )}
                >
                  {/* Green left border on active state */}
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-green transition-opacity",
                      active ? "opacity-100" : "opacity-0 group-hover:opacity-40",
                    )}
                  />
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>

        {projects.length > 0 && (
          <>
            <p className="mt-6 px-3 pb-2 text-label">Projects</p>
            <ul className="space-y-1">
              {projects.map((p, i) => (
                <SidebarProjectRow
                  key={p.id}
                  projectId={p.id}
                  projectName={p.name}
                  rigName={p.rigs?.name ?? "—"}
                  totalBudget={Number(p.total_budget_usd ?? 0)}
                  active={pathname.startsWith(`/projects/${p.id}`)}
                  index={i}
                />
              ))}
            </ul>
          </>
        )}

        <p className="mt-6 px-3 pb-2 text-label">Rigs</p>
        <ul className="space-y-1">
          {rigList.map((rig, i) => {
            // Prefer the live DB status when available; fall back to the
            // display-metadata derived from the hardcoded names.
            const metaByName = rigMetaFor(rig.name as (typeof RIGS)[number]);
            const dbStatus = rig.status;
            const uiStatus =
              dbStatus === "active"
                ? "active"
                : dbStatus === "maintenance"
                  ? "maintenance"
                  : dbStatus === "standby"
                    ? "standby"
                    : metaByName.status;
            const statusDot =
              uiStatus === "active"
                ? "bg-brand-success"
                : uiStatus === "maintenance"
                  ? "bg-brand-warning"
                  : "bg-slate-400";

            // URL uses the DB UUID when we have it; falls back to the slug.
            const href = `/rig/${rig.id}`;
            const active = pathname.startsWith(href);
            return (
              <li key={rig.key}>
                <Link
                  href={href}
                  prefetch={true}
                  className={cn(
                    "group relative flex items-center gap-3 rounded-md py-2 pl-4 pr-3 text-sm transition-all duration-200",
                    "hover:bg-brand-green/10 hover:translate-x-0.5",
                    active
                      ? "bg-brand-green/12 text-brand-green font-semibold"
                      : "text-brand-text/90 hover:text-brand-text",
                    `delay-step-${Math.min(7, i)}`,
                    "animate-fade-in",
                  )}
                  title={`${rig.name} · ${uiStatus.toUpperCase()}`}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-green transition-opacity",
                      active ? "opacity-100" : "opacity-0 group-hover:opacity-40",
                    )}
                  />
                  <span
                    className={cn(
                      "inline-block h-2 w-2 shrink-0 rounded-full",
                      statusDot,
                      uiStatus === "active" && "animate-pulse-dot",
                    )}
                  />
                  <span className="truncate">{rig.name}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User block */}
      <div className="border-t border-brand-border p-3">
        <div className="flex items-center gap-3 rounded-md border border-brand-border bg-brand-surface/40 p-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-green/20 text-xs font-bold text-brand-green">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-brand-text">
              {displayName}
            </p>
            <p className="truncate text-[10px] uppercase tracking-wider text-brand-muted">
              {roleLabel}
            </p>
          </div>
          <button
            type="button"
            onClick={() => void signOut()}
            aria-label="Sign out"
            title="Sign out"
            className="rounded-md p-1.5 text-brand-muted transition-colors hover:bg-brand-danger/15 hover:text-brand-danger"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 flex items-center gap-2 px-2 text-[10px] text-brand-muted">
          <Settings className="h-3 w-3" />
          v{APP.version} · {APP.footer}
        </div>
      </div>
    </aside>
  );
}

/**
 * Single project row inside the Sidebar's Projects block.
 *
 * Fetches its own annexures so the burn-% badge is live. The hook
 * memoizes per-project so this is one additional query per rig —
 * cheap on the handful of projects an operator sees at a time.
 */
function SidebarProjectRow({
  projectId,
  projectName,
  rigName,
  totalBudget,
  active,
  index,
}: {
  projectId: string;
  projectName: string;
  rigName: string;
  totalBudget: number;
  active: boolean;
  index: number;
}) {
  const { annexures } = useAnnexures(projectId);
  const spent = annexures.reduce((s, a) => s + a.total_actual, 0);
  const burnPct = totalBudget > 0 ? Math.min(100, (spent / totalBudget) * 100) : 0;
  const first = annexures[0];
  const href = first
    ? `/projects/${projectId}/annexures/${first.id}`
    : `/projects/${projectId}/annexures/`;

  const barColor =
    burnPct > 90 ? "bg-brand-danger" : burnPct > 70 ? "bg-brand-warning" : "bg-brand-green";

  const summaryHref = `/projects/${projectId}/summary`;

  return (
    <li
      className={cn(
        "animate-fade-in rounded-md",
        `delay-step-${Math.min(7, index)}`,
        active && "bg-brand-green/10",
      )}
    >
      {/* Project card: info display, no link (child links handle nav) */}
      <div
        className={cn(
          "relative rounded-t-md py-2 pl-4 pr-3",
          active && "bg-brand-green/12",
        )}
        title={`${rigName} · ${projectName}`}
      >
        <span
          aria-hidden
          className={cn(
            "absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-brand-green transition-opacity",
            active ? "opacity-100" : "opacity-0",
          )}
        />
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "truncate text-xs",
              active ? "font-semibold text-brand-green" : "text-brand-text",
            )}
          >
            {projectName}
          </span>
          <span className="ml-auto shrink-0 font-mono text-[10px] tabular-nums text-brand-muted">
            {burnPct.toFixed(0)}%
          </span>
        </div>
        <p className="truncate text-[10px] uppercase tracking-wider text-brand-muted">
          {rigName}
        </p>
        <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-brand-border/50">
          <div
            className={cn("h-full rounded-full transition-all duration-500", barColor)}
            style={{ width: `${burnPct}%` }}
          />
        </div>
      </div>

      {/* Child links: Annexures + Summary */}
      <div className="flex gap-1 border-t border-brand-border/40 px-4 py-1.5">
        <Link
          href={href}
          prefetch={true}
          className="flex-1 rounded px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-brand-muted transition-colors hover:bg-brand-green/15 hover:text-brand-green"
        >
          Annexures
        </Link>
        <Link
          href={summaryHref}
          prefetch={true}
          className="flex-1 rounded px-2 py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-brand-muted transition-colors hover:bg-brand-green/15 hover:text-brand-green"
        >
          Summary
        </Link>
      </div>
    </li>
  );
}
