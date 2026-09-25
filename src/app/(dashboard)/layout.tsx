"use client";

import { Sidebar } from "@/components/layout/Sidebar";
import { TopBar } from "@/components/layout/TopBar";
import { ToastProvider } from "@/components/ui/Toast";
import { ErrorBoundary } from "@/components/ui/ErrorBoundary";

/**
 * Shared shell for every authenticated route under (dashboard)/.
 *
 * Next.js keeps a layout mounted across route changes, so the Sidebar,
 * TopBar, and ToastProvider render exactly once for the life of the
 * session. Navigation only swaps `{children}`, which makes page-to-page
 * transitions feel instant.
 */
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ToastProvider>
      <div className="flex min-h-screen bg-brand-bg">
        <Sidebar />
        <div className="flex min-w-0 flex-1 flex-col">
          <TopBar />
          <ErrorBoundary>{children}</ErrorBoundary>
        </div>
      </div>
    </ToastProvider>
  );
}
