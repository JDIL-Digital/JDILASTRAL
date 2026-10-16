"use client";

import { useState } from "react";
import { Loader2, Settings, ShieldCheck, UserX, Users } from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
import { QueryError } from "@/components/ui/ErrorBoundary";
import { TableSkeleton } from "@/components/ui/Skeletons";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CURRENCIES, RIGS, ROLE_LABELS, ROLES, type Role } from "@/lib/constants";
import { DEFAULT_FX_RATES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";
import { useUsers } from "@/hooks/useUsers";
import { useToast } from "@/components/ui/Toast";
import type { DbProfile } from "@/types/database";

export default function AdminPage() {
  const [fxRates, setFxRates] = useState(DEFAULT_FX_RATES);
  const { users, loading: usersLoading, error: usersError, refresh: refreshUsers, updateRole, toggleActive } = useUsers();
  const toast = useToast();
  const [workingId, setWorkingId] = useState<string | null>(null);

  async function handleRoleChange(user: DbProfile, next: Role) {
    if (next === user.role) return;
    setWorkingId(user.id);
    try {
      await updateRole(user.id, next);
      toast.success(
        "Role updated",
        `${user.full_name ?? user.email} → ${ROLE_LABELS[next]}`,
      );
    } catch (e) {
      toast.error("Role update failed", e instanceof Error ? e.message : undefined);
    } finally {
      setWorkingId(null);
    }
  }

  async function handleToggleActive(user: DbProfile) {
    setWorkingId(user.id);
    try {
      const next = !(user.active ?? true);
      await toggleActive(user.id, next);
      toast.success(next ? "User reactivated" : "User deactivated");
    } catch (e) {
      toast.error("Status update failed", e instanceof Error ? e.message : undefined);
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <main className="flex-1 space-y-6 p-4 md:p-6">
        <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-brand-green md:text-3xl">
              Administration
            </h1>
            <p className="text-sm text-brand-muted">
              Manage users, roles, rig access, and system configuration.
            </p>
          </div>
          <Badge variant="default" className="self-start">
            <ShieldCheck className="mr-1 h-3 w-3" />
            Restricted Access
          </Badge>
        </header>

        <RoleGuard allow={["admin", "csuite", "manager"]}>
          <Card>
            <CardHeader className="flex flex-row items-start justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-brand-green" /> Users & Roles
                </CardTitle>
                <CardDescription>
                  {users.length} user{users.length === 1 ? "" : "s"} · live from
                  public.profiles
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              {usersError ? (
                <QueryError message={usersError} onRetry={() => void refreshUsers()} />
              ) : usersLoading ? (
                <TableSkeleton rows={6} columns={5} />
              ) : users.length === 0 ? (
                <p className="text-sm text-brand-muted">
                  No profiles yet. Sign up from the login page to populate this table.
                </p>
              ) : (
                <div className="rounded-xl border border-brand-border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((u) => {
                        const isActive = u.active ?? true;
                        const busy = workingId === u.id;
                        return (
                          <TableRow key={u.id}>
                            <TableCell className="font-medium">
                              {u.full_name ?? "—"}
                            </TableCell>
                            <TableCell className="text-sm text-brand-muted">
                              {u.email ?? "—"}
                            </TableCell>
                            <TableCell>
                              <Select
                                value={u.role}
                                onChange={(e) =>
                                  void handleRoleChange(u, e.target.value as Role)
                                }
                                disabled={busy}
                                className="h-8 w-40 text-xs"
                              >
                                {ROLES.map((r) => (
                                  <option key={r} value={r}>
                                    {ROLE_LABELS[r]}
                                  </option>
                                ))}
                              </Select>
                            </TableCell>
                            <TableCell>
                              <Badge variant={isActive ? "default" : "secondary"}>
                                {isActive ? "Active" : "Disabled"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void handleToggleActive(u)}
                                disabled={busy}
                              >
                                {busy ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <UserX className="h-3.5 w-3.5" />
                                )}
                                {isActive ? "Deactivate" : "Reactivate"}
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5 text-brand-green" /> FX Rates
                </CardTitle>
                <CardDescription>
                  Conversion to USD · Last updated {formatDate(new Date())}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {CURRENCIES.map((c) => (
                  <div key={c} className="flex items-center gap-3">
                    <Label htmlFor={`fx-${c}`} className="w-16">
                      1 USD =
                    </Label>
                    <Input
                      id={`fx-${c}`}
                      type="number"
                      step="0.0001"
                      value={fxRates[c]}
                      onChange={(e) =>
                        setFxRates({ ...fxRates, [c]: Number(e.target.value) })
                      }
                      disabled={c === "USD"}
                    />
                    <Badge variant="outline" className="font-mono">
                      {c}
                    </Badge>
                  </div>
                ))}
                <Button size="sm" className="w-full">
                  Save Rates
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-brand-green" /> Permission Matrix
                </CardTitle>
                <CardDescription>Role capability summary</CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Capability</TableHead>
                      {ROLES.map((r) => (
                        <TableHead key={r} className="text-center capitalize">
                          {r}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {[
                      { cap: "View Fleet",      e: true,  m: true,  c: true,  a: true  },
                      { cap: "Edit Line Items", e: true,  m: true,  c: false, a: true  },
                      { cap: "Generate PO",     e: true,  m: true,  c: false, a: true  },
                      { cap: "Approve PO",      e: false, m: true,  c: true,  a: true  },
                      { cap: "Manage Users",    e: false, m: false, c: true,  a: true  },
                      { cap: "Edit FX Rates",   e: false, m: true,  c: true,  a: true  },
                    ].map((row) => (
                      <TableRow key={row.cap}>
                        <TableCell className="font-medium">{row.cap}</TableCell>
                        <TableCell className="text-center">{row.e ? "✓" : "—"}</TableCell>
                        <TableCell className="text-center">{row.m ? "✓" : "—"}</TableCell>
                        <TableCell className="text-center">{row.c ? "✓" : "—"}</TableCell>
                        <TableCell className="text-center">{row.a ? "✓" : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Fleet Configuration</CardTitle>
              <CardDescription>Active rigs and operating regions</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
                {RIGS.map((r) => (
                  <div
                    key={r}
                    className="flex items-center justify-between rounded-lg border border-brand-border bg-brand-bg/40 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium text-brand-text">{r}</p>
                      <p className="text-xs text-brand-muted">Jackup · ONGC contract</p>
                    </div>
                    <Select className="w-32">
                      <option>Operational</option>
                      <option>Maintenance</option>
                      <option>Stacked</option>
                    </Select>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
      </RoleGuard>
    </main>
  );
}
