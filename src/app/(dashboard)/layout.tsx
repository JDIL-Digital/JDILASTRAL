"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";

/**
 * Shared shell for every authenticated route under (dashboard)/.
 *
 * Next.js keeps a layout mounted across route changes, so the Sidebar and
 * TopBar render exactly once for the life of the session. Navigation only
 * swaps `{children}`, which makes page-to-page transitions feel instant.
 *
 * Marked "use client" so theme / auth / sidebar state survive every
 * navigation without re-fetching or re-mounting.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-brand-bg">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        {children}
      </div>
    </div>
  );
}
