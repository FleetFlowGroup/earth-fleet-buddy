import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Truck, ShieldCheck, BellRing, FileCheck2, Users, Gauge, ArrowRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Fleetflow — Fleet compliance for AU earthmoving & transport" },
      {
        name: "description",
        content:
          "Centralise rego, insurance, services and compliance documents for your trucks, plant and machinery. Automatic expiry reminders so nothing slips.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(({ data }) => {
      if (active && data.user) navigate({ to: "/dashboard", replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/70 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
            <span className="text-base font-semibold tracking-tight">Fleetflow</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">
              Features
            </a>
            <a href="#how" className="hover:text-foreground">
              How it works
            </a>
            <a href="#pricing" className="hover:text-foreground">
              Pricing
            </a>
          </nav>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link to="/auth">Sign in</Link>
            </Button>
            <Button asChild size="sm">
              <Link to="/auth" search={{ mode: "signup" }}>
                Get started
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="hero-glow absolute inset-x-0 top-0 h-[520px]" />
        <div className="relative mx-auto max-w-6xl px-4 pb-20 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              Built for Australian earthmoving & transport
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Fleet compliance, <span className="brand-gradient-text">finally under control</span>.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground sm:text-lg">
              Track rego, insurance, services and compliance docs for every truck, dozer
              and trailer. Automatic reminders 30, 14 and 7 days before anything expires.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Button asChild size="lg" className="glow">
                <Link to="/auth" search={{ mode: "signup" }}>
                  Start free <ArrowRight className="ml-1 size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#features">See features</a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              No credit card · Unlimited assets in beta
            </p>
          </div>

          {/* Mock dashboard preview */}
          <div className="surface-card mx-auto mt-16 max-w-5xl overflow-hidden p-2 sm:p-3">
            <div className="rounded-lg border border-border bg-background/60 p-4 sm:p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Dashboard</div>
                  <div className="text-lg font-semibold">Compliance overview</div>
                </div>
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <Pill tone="success">12 OK</Pill>
                  <Pill tone="warning">3 Due soon</Pill>
                  <Pill tone="danger">1 Expired</Pill>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 pt-4 sm:grid-cols-3">
                <MiniStat label="Active assets" value="24" sub="14 vehicles · 10 plant" />
                <MiniStat label="Expiring in 30 days" value="7" sub="rego · insurance · service" />
                <MiniStat label="Documents stored" value="118" sub="across all assets" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t border-border/60 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Everything your yard manager wishes you already had
          </h2>
          <p className="mt-3 max-w-2xl text-muted-foreground">
            Replace the whiteboard, the wall calendar and the lost paper folders with
            one source of truth your whole crew can use.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Feature icon={Truck} title="Vehicles & machinery">
              One record per asset with rego, VIN/serial, make, model, year, odometer and notes.
            </Feature>
            <Feature icon={ShieldCheck} title="Compliance dates">
              Registration, insurance, services, inspections, permits — all in one place.
            </Feature>
            <Feature icon={BellRing} title="Auto reminders">
              Email alerts 30, 14 and 7 days before any expiry. No more last-minute scrambles.
            </Feature>
            <Feature icon={FileCheck2} title="Document storage">
              Attach rego papers, COI certificates and service receipts as PDFs or photos.
            </Feature>
            <Feature icon={Users} title="Team access">
              Multiple users per company with Admin, Manager and Viewer roles.
            </Feature>
            <Feature icon={Gauge} title="Built for the field">
              Mobile-first dark UI optimised for utes, workshops and dusty job sites.
            </Feature>
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="border-t border-border/60 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Up and running in minutes</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <Step n={1} title="Create your company">
              Sign up, name your business and add your ABN. You're the first admin.
            </Step>
            <Step n={2} title="Add your fleet">
              Bulk-add vehicles and plant. Capture rego, insurance and service dates per asset.
            </Step>
            <Step n={3} title="Sleep easy">
              Fleetflow watches every expiry and emails the right people, automatically.
            </Step>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border/60 py-20">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
            Simple pricing
          </h2>
          <p className="mt-3 text-muted-foreground">Free during beta. Pay per asset later — no per-user fees.</p>
          <div className="surface-card mx-auto mt-8 max-w-md p-8 text-left">
            <div className="flex items-baseline justify-between">
              <div className="text-xl font-semibold">Beta access</div>
              <div className="text-3xl font-bold">Free</div>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-muted-foreground">
              <li>✓ Unlimited vehicles & machinery</li>
              <li>✓ Unlimited team members</li>
              <li>✓ Document uploads</li>
              <li>✓ Automatic 30/14/7-day reminders</li>
            </ul>
            <Button asChild className="mt-8 w-full" size="lg">
              <Link to="/auth" search={{ mode: "signup" }}>Create your account</Link>
            </Button>
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Logo size={16} />
            <span>© {new Date().getFullYear()} Fleetflow</span>
          </div>
          <div>Made for Australian operators · ABN-ready</div>
        </div>
      </footer>
    </div>
  );
}

function Logo({ size = 22 }: { size?: number }) {
  return (
    <div
      className="grid place-items-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground"
      style={{ width: size + 8, height: size + 8 }}
    >
      <Truck size={size - 4} />
    </div>
  );
}

function Feature({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card group p-6 transition hover:border-primary/40">
      <div className="grid size-10 place-items-center rounded-lg bg-primary/10 text-primary">
        <Icon className="size-5" />
      </div>
      <h3 className="mt-4 text-base font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function Step({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <div className="surface-card p-6">
      <div className="text-sm font-semibold text-primary">Step {n}</div>
      <div className="mt-1 text-lg font-semibold">{title}</div>
      <p className="mt-2 text-sm text-muted-foreground">{children}</p>
    </div>
  );
}

function MiniStat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-lg border border-border bg-card/40 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 text-2xl font-semibold">{value}</div>
      <div className="text-xs text-muted-foreground">{sub}</div>
    </div>
  );
}

function Pill({ tone, children }: { tone: "success" | "warning" | "danger"; children: React.ReactNode }) {
  const cls =
    tone === "success"
      ? "bg-success/15 text-success border-success/30"
      : tone === "warning"
        ? "bg-warning/15 text-warning border-warning/30"
        : "bg-destructive/15 text-destructive border-destructive/30";
  return <span className={`rounded-full border px-2 py-0.5 ${cls}`}>{children}</span>;
}
