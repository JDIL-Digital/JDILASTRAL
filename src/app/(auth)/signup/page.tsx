"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Loader2, Lock, Mail, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP, ADMIN_EMAIL, ROLE_ICONS, ROLE_LABELS, type Role } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";

/** Roles always offered. Admin is appended conditionally below. */
const BASE_ROLES: Role[] = ["engineer", "manager", "csuite"];

export default function SignUpPage() {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [role, setRole] = useState<Role>("engineer");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Admin role is unlocked only when the entered email matches the
  // pre-approved address. The dropdown re-computes as the user types.
  const availableRoles = useMemo<Role[]>(() => {
    const isAdminEmail =
      email.trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();
    return isAdminEmail ? [...BASE_ROLES, "admin"] : BASE_ROLES;
  }, [email]);

  // If the user had selected 'admin' then changed their email, revert.
  if (role === "admin" && !availableRoles.includes("admin")) {
    setRole("engineer");
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError("Full name is required.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    const res = await signUp({ email, password, fullName, role });
    if (res.error) {
      setLoading(false);
      setError(res.error);
      return;
    }
    // On success, signUp pushes to /fleet. Keep spinner up during nav.
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-bg p-4">
      <AuthBackground />

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-3">
          <div className="relative flex h-20 w-56 items-center justify-center rounded-lg bg-white px-4 py-2 shadow-lg shadow-black/30">
            <Image
              src="/jindal-logo.jpg"
              alt="Jindal Drilling & Industries Ltd."
              width={208}
              height={64}
              priority
              unoptimized
              className="max-h-16 w-auto object-contain"
            />
          </div>
          <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-brand-muted">
            {APP.company}
          </p>
        </div>

        <div className="surface-glass overflow-hidden rounded-2xl border border-brand-green/20 shadow-2xl shadow-black/40 animate-fade-in-up delay-step-1">
          <div className="h-1 w-full bg-gradient-to-r from-brand-green via-brand-green-bright to-brand-danger" />

          <div className="px-8 pt-7 pb-2 text-center">
            <h1 className="text-brand-gradient text-3xl font-bold tracking-tight md:text-4xl">
              {APP.name}
            </h1>
            <p className="mt-2 text-sm text-brand-muted">Create Your Account</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-3.5 px-8 py-6">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label htmlFor="full_name">Full Name</Label>
              <div className="relative">
                <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <Input
                  id="full_name"
                  type="text"
                  required
                  autoComplete="name"
                  placeholder="Akshay Manjramkar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="name@jindaldrilling.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="new-password"
                  minLength={8}
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Confirm Password */}
            <div className="space-y-1.5">
              <Label htmlFor="confirm">Confirm Password</Label>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <Input
                  id="confirm"
                  type="password"
                  required
                  autoComplete="new-password"
                  placeholder="Re-enter password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {/* Role */}
            <div className="space-y-1.5">
              <Label htmlFor="role">Role</Label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value as Role)}
                required
                className="flex h-10 w-full appearance-none rounded-md border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text transition-colors focus:border-brand-green focus:outline-none focus:ring-2 focus:ring-brand-green/40"
              >
                {availableRoles.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_ICONS[r]}  {ROLE_LABELS[r]}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-brand-muted">
                {ROLE_ICONS[role]} {ROLE_LABELS[role]} — role determines what you
                can read, write, and approve.
              </p>
            </div>

            {error && (
              <div className="rounded-md border border-brand-danger/40 bg-brand-danger/10 px-3 py-2 text-xs text-brand-danger animate-fade-in">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="btn-shine mt-1 w-full shadow-brand-glow-sm"
              size="lg"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Creating account..." : "Create Account"}
            </Button>

            <p className="pt-1 text-center text-xs text-brand-muted">
              Already have an account?{" "}
              <Link
                href="/login"
                className="font-semibold text-brand-green hover:underline"
              >
                Sign In →
              </Link>
            </p>

            <p className="pt-1 text-center text-[10px] text-brand-muted">
              By creating an account, you agree to {APP.company}&apos;s acceptable-use
              policy.
            </p>
          </form>
        </div>

        <p className="mt-6 text-center text-[11px] uppercase tracking-[0.2em] text-brand-muted animate-fade-in delay-step-3">
          {APP.footer} · v{APP.version}
        </p>
      </div>
    </main>
  );
}

/* ---------------------------------------------------------------------------
   Same drifting-blob background as the login page for visual continuity.
--------------------------------------------------------------------------- */
function AuthBackground() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      <div className="absolute inset-0 bg-hero-mesh" />
      <div className="absolute -left-32 -top-32 h-[420px] w-[420px] rounded-full bg-brand-green/20 blur-3xl animate-blob-a" />
      <div className="absolute -bottom-32 -right-32 h-[420px] w-[420px] rounded-full bg-brand-danger/15 blur-3xl animate-blob-b" />
      <div className="absolute left-1/3 top-1/2 h-[360px] w-[360px] -translate-y-1/2 rounded-full bg-brand-green-bright/10 blur-3xl animate-blob-c" />
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(245,245,245,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(245,245,245,0.5) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />
    </div>
  );
}
