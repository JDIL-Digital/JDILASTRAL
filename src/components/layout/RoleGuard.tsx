"use client";

import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { type Role } from "@/lib/constants";
import { Card, CardContent } from "@/components/ui/card";

interface RoleGuardProps {
  allow: Role[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

export function RoleGuard({ allow, fallback, children }: RoleGuardProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-32 items-center justify-center text-sm text-brand-muted">
        Verifying access...
      </div>
    );
  }

  if (!user || !allow.includes(user.role)) {
    if (fallback) return <>{fallback}</>;
    return (
      <Card className="border-brand-danger/40">
        <CardContent className="flex items-start gap-3 p-5">
          <ShieldAlert className="mt-0.5 h-5 w-5 text-brand-danger" />
          <div>
            <p className="font-semibold text-brand-text">Restricted Section</p>
            <p className="text-sm text-brand-muted">
              You do not have permission to view this content. Requires:{" "}
              <span className="font-medium text-brand-text">{allow.join(", ")}</span>.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return <>{children}</>;
}
