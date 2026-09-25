"use client";

import { useState } from "react";
import { Plus, Settings, ShieldCheck, Users } from "lucide-react";
import { RoleGuard } from "@/components/layout/RoleGuard";
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
import { CURRENCIES, RIGS, ROLE_LABELS, ROLES } from "@/lib/constants";
import { DEFAULT_FX_RATES } from "@/lib/constants";
import { formatDate } from "@/lib/utils";

const SEED_USERS = [
  {
    id: "1",
    name: "Aarav Sharma",
    email: "aarav.sharma@jindaldrilling.com",
    role: "csuite" as const,
    rigs: "All",
    active: true,
  },
  {
    id: "2",
    name: "Priya Iyer",
    email: "priya.iyer@jindaldrilling.com",
    role: "manager" as const,
    rigs: "Discovery 1, Virtue 1",
    active: true,
  },
  {
    id: "3",
    name: "Rohit Kapoor",
    email: "rohit.kapoor@jindaldrilling.com",
    role: "engineer" as const,
    rigs: "Jindal Star",
    active: true,
  },
  {
    id: "4",
    name: "Meera Joshi",
    email: "meera.joshi@jindaldrilling.com",
    role: "engineer" as const,
    rigs: "Jindal Explorer",
    active: false,
  },
];

export default function AdminPage() {
  const [fxRates, setFxRates] = useState(DEFAULT_FX_RATES);

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

        <RoleGuard allow={["manager", "csuite"]}>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-brand-green" /> Users & Roles
                </CardTitle>
                <CardDescription>{SEED_USERS.length} users provisioned</CardDescription>
              </div>
              <Button size="sm">
                <Plus className="h-4 w-4" /> Invite User
              </Button>
            </CardHeader>
            <CardContent>
              <div className="rounded-xl border border-brand-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Role</TableHead>
                      <TableHead>Rig Access</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {SEED_USERS.map((u) => (
                      <TableRow key={u.id}>
                        <TableCell className="font-medium">{u.name}</TableCell>
                        <TableCell className="text-sm text-brand-muted">{u.email}</TableCell>
                        <TableCell>
                          <Badge variant="default" className="capitalize">
                            {ROLE_LABELS[u.role]}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{u.rigs}</TableCell>
                        <TableCell>
                          <Badge variant={u.active ? "default" : "secondary"}>
                            {u.active ? "Active" : "Disabled"}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
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
                      { cap: "View Fleet", e: true, m: true, c: true },
                      { cap: "Edit Line Items", e: true, m: true, c: false },
                      { cap: "Generate PO", e: true, m: true, c: false },
                      { cap: "Approve PO", e: false, m: true, c: true },
                      { cap: "Manage Users", e: false, m: false, c: true },
                      { cap: "Edit FX Rates", e: false, m: true, c: true },
                    ].map((row) => (
                      <TableRow key={row.cap}>
                        <TableCell className="font-medium">{row.cap}</TableCell>
                        <TableCell className="text-center">{row.e ? "✓" : "—"}</TableCell>
                        <TableCell className="text-center">{row.m ? "✓" : "—"}</TableCell>
                        <TableCell className="text-center">{row.c ? "✓" : "—"}</TableCell>
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
