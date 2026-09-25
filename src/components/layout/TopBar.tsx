"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  ChevronRight,
  LogOut,
  Moon,
  Search,
  Sun,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/useTheme";
import { useRealtimeStatus } from "@/hooks/useRealtimeStatus";
import { ROLE_LABELS } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { breadcrumbsFromPath, type Crumb } from "@/lib/breadcrumbs";

interface TopBarProps {
  /** Optional override — when omitted, breadcrumbs are derived from `usePathname()`. */
  breadcrumbs?: Crumb[];
  /** Notification count to render on the bell badge. 0 hides the dot. */
  notifications?: number;
}

export function TopBar({ breadcrumbs, notifications = 3 }: TopBarProps) {
  const pathname = usePathname() ?? "/";
  const { user, signOut } = useAuth();
  const { theme, toggleTheme, mounted } = useTheme();
  const { live } = useRealtimeStatus();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuWrapperRef = useRef<HTMLDivElement>(null);
  const derived = useMemo(() => breadcrumbs ?? breadcrumbsFromPath(pathname), [breadcrumbs, pathname]);

  // Close the user dropdown on outside-click / Escape.
  useEffect(() => {
    if (!menuOpen) return;
    const onClick = (e: MouseEvent) => {
      if (!menuWrapperRef.current?.contains(e.target as Node)) setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const initials = user?.full_name
    ? user.full_name
        .split(" ")
        .map((p) => p[0])
        .filter(Boolean)
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "AM";

  return (
    <header
      className="topbar-shell sticky top-0 z-30 flex h-16 items-center border-b border-brand-border px-4 md:px-6"
      style={{ height: "64px" }}
    >
      {/* ---------- LEFT — breadcrumbs ---------- */}
      <div className="flex min-w-0 flex-1 items-center">
        {derived.length > 0 ? (
          <nav
            aria-label="Breadcrumb"
            className="flex min-w-0 items-center gap-1.5 truncate text-sm"
          >
            {derived.map((b, i) => {
              const isLast = i === derived.length - 1;
              return (
                <span
                  key={`${b.label}-${i}`}
                  className="flex items-center gap-1.5 truncate"
                >
                  {i > 0 && (
                    <ChevronRight className="h-3.5 w-3.5 shrink-0 text-brand-muted" />
                  )}
                  {b.href && !isLast ? (
                    <Link
                      href={b.href}
                      className="truncate text-brand-muted transition-colors hover:text-brand-text"
                    >
                      {b.label}
                    </Link>
                  ) : (
                    <span
                      className={cn(
                        "truncate",
                        isLast
                          ? "font-semibold text-brand-text"
                          : "text-brand-muted",
                      )}
                    >
                      {b.label}
                    </span>
                  )}
                </span>
              );
            })}
          </nav>
        ) : (
          <span className="sr-only">JSIL ASTRAL</span>
        )}
      </div>

      {/* ---------- CENTER — search ---------- */}
      <div className="hidden flex-1 justify-center px-4 md:flex">
        <div className="relative w-full max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
          <Input
            placeholder="Search rigs, POs, line items..."
            className="h-9 w-full pl-9"
          />
        </div>
      </div>

      {/* ---------- RIGHT — theme · bell · avatar ---------- */}
      <div className="flex flex-1 items-center justify-end gap-2">
        {/* Live realtime indicator — green pulse when ≥ 1 channel is subscribed */}
        <span
          className={cn(
            "hidden items-center gap-1.5 rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider sm:inline-flex",
            live
              ? "border-brand-success/40 bg-brand-success/10 text-brand-success"
              : "border-brand-border bg-brand-surface text-brand-muted",
          )}
          title={live ? "Realtime connection active" : "Realtime idle"}
        >
          <span
            className={cn(
              "inline-block h-1.5 w-1.5 rounded-full",
              live ? "bg-brand-success animate-pulse-dot" : "bg-brand-muted",
            )}
          />
          {live ? "Live" : "Idle"}
        </span>

        {/* Search button visible on small screens (collapses center bar) */}
        <button
          type="button"
          aria-label="Search"
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-brand-border bg-brand-surface text-brand-muted transition-colors hover:text-brand-text md:hidden"
        >
          <Search className="h-4 w-4" />
        </button>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          title={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-brand-border bg-brand-surface text-brand-muted transition-all hover:border-brand-green/40 hover:text-brand-green"
        >
          {mounted && theme === "light" ? (
            <Sun className="h-4 w-4" />
          ) : (
            <Moon className="h-4 w-4" />
          )}
        </button>

        <button
          type="button"
          aria-label={`${notifications} notifications`}
          className="relative inline-flex h-9 w-9 items-center justify-center rounded-md border border-brand-border bg-brand-surface text-brand-muted transition-colors hover:text-brand-text"
        >
          <Bell className="h-4 w-4" />
          {notifications > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-danger px-1 text-[9px] font-bold leading-none text-white shadow-sm ring-2 ring-brand-bg">
              {notifications > 9 ? "9+" : notifications}
            </span>
          )}
        </button>

        {/* ---------- User avatar (initials only) + dropdown ---------- */}
        <div ref={menuWrapperRef} className="relative">
          <button
            type="button"
            onClick={() => setMenuOpen((p) => !p)}
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="User menu"
            title={user?.full_name ?? "Account"}
            className={cn(
              "flex h-9 w-9 items-center justify-center rounded-full border-2 text-[11px] font-bold transition-all",
              menuOpen
                ? "border-brand-green bg-brand-green text-white"
                : "border-brand-green/40 bg-brand-green/15 text-brand-green hover:border-brand-green hover:bg-brand-green/25",
            )}
          >
            {initials}
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute right-0 top-12 z-40 w-60 origin-top-right overflow-hidden rounded-lg border border-brand-border bg-brand-surface shadow-xl animate-fade-in"
            >
              <div className="border-b border-brand-border p-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-green/20 text-sm font-bold text-brand-green">
                    {initials}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-brand-text">
                      {user?.full_name ?? "Account"}
                    </p>
                    {user && (
                      <Badge variant="default" className="mt-1">
                        {ROLE_LABELS[user.role]}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  void signOut();
                }}
                className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-brand-text transition-colors hover:bg-brand-danger/10 hover:text-brand-danger"
                role="menuitem"
              >
                <LogOut className="h-4 w-4" /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
