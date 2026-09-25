"use client";

import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: (props: { error: Error; reset: () => void }) => React.ReactNode;
}

interface ErrorBoundaryState {
  error: Error | null;
}

/**
 * Class-component boundary — React still requires class for `componentDidCatch`
 * / `getDerivedStateFromError`. Wrap page sections that rely on live data so
 * a query failure surfaces a retry affordance instead of a white screen.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // eslint-disable-next-line no-console
    console.error("[ErrorBoundary]", error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      if (this.props.fallback) {
        return this.props.fallback({ error: this.state.error, reset: this.reset });
      }
      return (
        <Card className="border-brand-danger/40">
          <CardContent className="flex items-start gap-3 p-5">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-brand-danger" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-brand-text">Something went wrong</p>
              <p className="mt-0.5 text-sm text-brand-muted">
                {this.state.error.message || "An unexpected error occurred."}
              </p>
              <Button
                variant="outline"
                size="sm"
                onClick={this.reset}
                className="mt-3"
              >
                <RotateCcw className="h-3.5 w-3.5" /> Try again
              </Button>
            </div>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}

/**
 * Inline query-error banner for hook consumers to render when
 * `error` is truthy — same look as ErrorBoundary but doesn't
 * unmount the surrounding tree.
 */
export function QueryError({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <Card className="border-brand-danger/40">
      <CardContent className="flex items-start gap-3 p-4">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-brand-danger" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-brand-text">Couldn&apos;t load data</p>
          <p className="mt-0.5 text-xs text-brand-muted">{message}</p>
        </div>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            <RotateCcw className="h-3.5 w-3.5" /> Retry
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Empty-state block — used when a query succeeds with 0 rows.
 */
export function EmptyState({
  title,
  message,
  action,
}: {
  title: string;
  message?: string;
  action?: React.ReactNode;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="flex flex-col items-center gap-2 p-8 text-center">
        <p className="text-sm font-semibold text-brand-text">{title}</p>
        {message && <p className="text-xs text-brand-muted">{message}</p>}
        {action}
      </CardContent>
    </Card>
  );
}
