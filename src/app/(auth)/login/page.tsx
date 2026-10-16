"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Loader2, Lock, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { APP } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";

export default function LoginPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Prefetch the destination so the navigation after submit is a noop on the wire.
  useEffect(() => {
    router.prefetch("/fleet");
  }, [router]);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    // signIn now strictly orders: Supabase auth → fetch profile → set
    // state → router.push("/fleet"). Returns only after the push is
    // scheduled, so the Signing-in spinner shows until the profile
    // round-trip completes.
    const res = await signIn(email, password);
    if (res.error) {
      setLoading(false);
      setError(res.error);
    }
    // Intentionally leave `loading` true on success — the next render
    // happens on /fleet, so we don't need to flip it back here.
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-brand-bg p-4">
      <LoginBackground />

      <div className="relative z-10 w-full max-w-md animate-fade-in-up">
        {/* Logo + company line */}
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

        {/* Glassmorphism card */}
        <div className="surface-glass overflow-hidden rounded-2xl border border-brand-green/20 shadow-2xl shadow-black/40 animate-fade-in-up delay-step-1">
          <div className="h-1 w-full bg-gradient-to-r from-brand-green via-brand-green-bright to-brand-danger" />

          <div className="px-8 pt-8 pb-2 text-center">
            <h1 className="text-brand-gradient text-4xl font-bold tracking-tight">
              {APP.name}
            </h1>
            <p className="mt-2 text-sm text-brand-muted">{APP.tagline}</p>
          </div>

          <form onSubmit={onSubmit} className="space-y-4 px-8 py-6">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email Address</Label>
              <div className="relative">
                <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <Input
                  id="email"
                  type="email"
                  required
                  autoComplete="email"
                  placeholder="ops.lead@jindaldrilling.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <a
                  href="#"
                  className="text-xs text-brand-muted transition-colors hover:text-brand-green"
                >
                  Forgot password?
                </a>
              </div>
              <div className="relative">
                <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brand-muted" />
                <Input
                  id="password"
                  type="password"
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>

            {error && (
              <div className="rounded-md border border-brand-danger/40 bg-brand-danger/10 px-3 py-2 text-xs text-brand-danger animate-fade-in">
                {error}
              </div>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="btn-shine w-full shadow-brand-glow-sm"
              size="lg"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loading ? "Signing in..." : "Sign In"}
            </Button>

            <p className="pt-2 text-center text-[11px] text-brand-muted">
              By signing in, you agree to {APP.company}&apos;s acceptable-use policy.
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
   Animated gradient-mesh background for the login screen.
   Three drifting blurred blobs + radial mesh + subtle grid.
--------------------------------------------------------------------------- */
function LoginBackground() {
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
