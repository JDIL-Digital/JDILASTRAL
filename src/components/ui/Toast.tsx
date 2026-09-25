"use client";

/**
 * Minimal toast system — provider + region + `useToast()` hook.
 *
 * No third-party dep. Mount <ToastProvider> once at the root of the
 * dashboard layout; call `toast.success('...')` / `toast.error('...')`
 * from any client component.
 */

import * as React from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type ToastKind = "success" | "error" | "info";

export interface ToastMessage {
  id: string;
  kind: ToastKind;
  title: string;
  description?: string;
  duration?: number;
}

interface ToastApi {
  push: (t: Omit<ToastMessage, "id">) => string;
  dismiss: (id: string) => void;
  success: (title: string, description?: string) => string;
  error: (title: string, description?: string) => string;
  info: (title: string, description?: string) => string;
}

const ToastContext = React.createContext<ToastApi | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = React.useState<ToastMessage[]>([]);

  const dismiss = React.useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = React.useCallback(
    (t: Omit<ToastMessage, "id">): string => {
      const id = Math.random().toString(36).slice(2);
      const duration = t.duration ?? 4000;
      setToasts((prev) => [...prev, { ...t, id }]);
      if (duration > 0) {
        window.setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const api = React.useMemo<ToastApi>(
    () => ({
      push,
      dismiss,
      success: (title, description) => push({ kind: "success", title, description }),
      error: (title, description) => push({ kind: "error", title, description, duration: 6000 }),
      info: (title, description) => push({ kind: "info", title, description }),
    }),
    [push, dismiss],
  );

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastRegion toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = React.useContext(ToastContext);
  if (!ctx) {
    // Fall back to a no-op API so components outside the provider don't crash.
    return {
      push: () => "",
      dismiss: () => undefined,
      success: () => "",
      error: () => "",
      info: () => "",
    };
  }
  return ctx;
}

const ICON: Record<ToastKind, React.ComponentType<{ className?: string }>> = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const RING: Record<ToastKind, string> = {
  success: "border-brand-success/40 bg-brand-success/10 text-brand-text",
  error: "border-brand-danger/40 bg-brand-danger/10 text-brand-text",
  info: "border-brand-border bg-brand-surface text-brand-text",
};

const ICON_TINT: Record<ToastKind, string> = {
  success: "text-brand-success",
  error: "text-brand-danger",
  info: "text-brand-muted",
};

function ToastRegion({
  toasts,
  onDismiss,
}: {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-[min(100%,22rem)] flex-col gap-2"
      role="region"
      aria-label="Notifications"
      aria-live="polite"
    >
      {toasts.map((t) => {
        const Icon = ICON[t.kind];
        return (
          <div
            key={t.id}
            className={cn(
              "pointer-events-auto flex items-start gap-3 rounded-lg border p-3 shadow-lg animate-fade-in-up",
              RING[t.kind],
            )}
          >
            <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ICON_TINT[t.kind])} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold leading-tight">{t.title}</p>
              {t.description && (
                <p className="mt-0.5 text-xs text-brand-muted">{t.description}</p>
              )}
            </div>
            <button
              type="button"
              onClick={() => onDismiss(t.id)}
              aria-label="Dismiss"
              className="rounded-md p-1 text-brand-muted transition-colors hover:bg-brand-border/40 hover:text-brand-text"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
