"use client";

import { useEffect } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
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
import { rigMetaFor } from "@/lib/rigMeta";

const NAV = [
  { href: "/fleet", label: "Fleet Overview", icon: LayoutDashboard },
  { href: "/purchase-orders", label: "Purchase Orders", icon: FileText },
  { href: "/admin", label: "Administration", icon: ShieldCheck },
  { href: "/admin/bc-sync", label: "Business Central", icon: Plug },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, signOut } = useAuth();

  // Aggressively prefetch every primary route on mount so subsequent
  // clicks navigate instantly with no extra round-trip.
  useEffect(() => {
    const main = ["/fleet", "/purchase-orders", "/admin", "/admin/bc-sync"];
    main.forEach((r) => router.prefetch(r));
    RIGS.forEach((name) => router.prefetch(`/rig/${slugify(name)}`));
  }, [router]);

  const initials = user?.full_name
    ? user.full_name
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

        <p className="mt-6 px-3 pb-2 text-label">Rigs</p>
        <ul className="space-y-1">
          {RIGS.map((name, i) => {
            const slug = slugify(name);
            const active = pathname.startsWith(`/rig/${slug}`);
            const meta = rigMetaFor(name);
            return (
              <li key={name}>
                <Link
                  href={`/rig/${slug}`}
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
                  title={`${name} · ${meta.statusLabel}`}
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
                      meta.statusDot,
                      meta.status === "active" && "animate-pulse-dot",
                    )}
                  />
                  <span className="truncate">{name}</span>
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
              {user?.full_name ?? "Guest User"}
            </p>
            <p className="truncate text-[10px] uppercase tracking-wider text-brand-muted">
              {user ? ROLE_LABELS[user.role] : "Not signed in"}
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
