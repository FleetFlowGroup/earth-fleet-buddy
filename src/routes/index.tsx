import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  Truck,
  ShieldCheck,
  ClipboardCheck,
  QrCode,
  Wrench,
  Users,
  Gauge,
  ArrowRight,
  Check,
  Menu,
  X,
  HardHat,
  Quote,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FleetFlow — Digital Pre-Starts & Fleet Management for Earthmoving Businesses" },
      {
        name: "description",
        content:
          "FleetFlow helps earthmoving, civil, and plant hire businesses replace paper pre-start books with digital inspections, fleet tracking, and compliance management — all from one platform.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    let active = true;
    supabase.auth.getUser().then(async ({ data }) => {
      if (!active || !data.user) return;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", data.user.id);
      const set = new Set((roles ?? []).map((r) => r.role as string));
      const dest = set.has("operator") && set.size === 1 ? "/operator" : "/dashboard";
      if (active) navigate({ to: dest, replace: true });
    });
    return () => {
      active = false;
    };
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/60 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <Logo />
            <span className="text-base font-semibold tracking-tight">Fleetflow</span>
          </Link>
          <nav className="hidden items-center gap-7 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground">Features</a>
            <a href="#how" className="hover:text-foreground">How it works</a>
            <a href="#pricing" className="hover:text-foreground">Pricing</a>
            <Link to="/contact" className="hover:text-foreground">Contact</Link>
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Button asChild variant="ghost" size="sm"><Link to="/auth">Sign in</Link></Button>
          </div>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-md border border-border text-foreground md:hidden"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Toggle menu"
          >
            {menuOpen ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
        {menuOpen && (
          <div className="border-t border-border bg-background md:hidden">
            <div className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3 text-sm">
              <a href="#features" onClick={() => setMenuOpen(false)} className="rounded-md px-2 py-2 hover:bg-muted">Features</a>
              <a href="#how" onClick={() => setMenuOpen(false)} className="rounded-md px-2 py-2 hover:bg-muted">How it works</a>
              <a href="#pricing" onClick={() => setMenuOpen(false)} className="rounded-md px-2 py-2 hover:bg-muted">Pricing</a>
              <Link to="/contact" onClick={() => setMenuOpen(false)} className="rounded-md px-2 py-2 hover:bg-muted">Contact</Link>
              <div className="mt-2">
                <Button asChild variant="outline" size="sm" className="w-full"><Link to="/auth">Sign in</Link></Button>
              </div>
            </div>
          </div>
        )}
      </header>

      {/* Hero — split */}
      <section className="relative overflow-hidden">
        <div className="hero-glow absolute inset-x-0 top-0 h-[520px]" />
        <div className="relative mx-auto grid max-w-6xl gap-12 px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:grid-cols-2 lg:items-center lg:gap-16">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              Built for Australian earthmoving & transport
            </div>
            <h1 className="mt-6 text-4xl font-semibold leading-[1.05] tracking-tight sm:text-5xl lg:text-6xl">
              Ditch the paper pre-start books. <span className="brand-gradient-text">Run your fleet from your phone</span>.
            </h1>
            <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
              FleetFlow is the all-in-one platform for earthmoving, civil, and plant hire businesses. Digital pre-starts, fleet management, compliance, and maintenance — all in one place.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button asChild size="lg" variant="outline">
                <a href="#how">See How It Works</a>
              </Button>
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              Built for Australian earthmoving, civil, mining, and plant hire businesses.
            </p>
          </div>

          {/* Right: live-looking compliance surface */}
          <div className="relative">
            <div className="surface-card overflow-hidden p-2">
              <div className="rounded-lg border border-border bg-background/60">
                <div className="flex items-center justify-between border-b border-border px-4 py-3">
                  <div>
                    <div className="text-[10px] uppercase tracking-widest text-muted-foreground">
                      Dashboard
                    </div>
                    <div className="text-sm font-semibold">Compliance overview</div>
                  </div>
                  <div className="flex gap-1.5 text-[10px]">
                    <Pill tone="success">14 OK</Pill>
                    <Pill tone="warning">3 Due</Pill>
                    <Pill tone="danger">1 Expired</Pill>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 border-b border-border p-3">
                  <MiniStat label="Active" value="18" />
                  <MiniStat label="Expiring 30d" value="4" />
                  <MiniStat label="Docs" value="96" />
                </div>
                <ul className="divide-y divide-border">
                  <AssetRow code="TR-04" name="Kenworth T909" sub="Rego · 12 Jan" tone="warning" badge="Due 14d" />
                  <AssetRow code="EX-12" name="CAT 320 Excavator" sub="Service · 500 hr" tone="success" badge="OK" />
                  <AssetRow code="DZ-01" name="Komatsu D65 Dozer" sub="Insurance · 02 Dec" tone="danger" badge="Expired" />
                  <AssetRow code="TR-08" name="Mack Super-Liner" sub="Rego · 27 Feb" tone="success" badge="OK" />
                </ul>
              </div>
            </div>
            <p className="mt-2 text-center text-[10px] uppercase tracking-widest text-muted-foreground">
              Example dashboard
            </p>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-border/60 bg-card/30 py-10">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-center text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Built with input from Australian civil and haulage crews
          </p>
          <div className="mt-6 grid grid-cols-2 gap-y-4 text-center text-sm font-medium text-muted-foreground sm:grid-cols-4">
            <div>Earthmoving</div>
            <div>Heavy haulage</div>
            <div>Civil construction</div>
            <div>Plant hire</div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="max-w-2xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Everything your business needs to run properly
            </h2>
            <p className="mt-3 text-muted-foreground">
              Replace the whiteboard, the wall calendar and the lost paper folders with one source of truth your whole crew can use.
            </p>
          </div>

          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Feature icon={ClipboardCheck} title="Digital Pre-Start Inspections">
              Operators complete machine pre-starts from their phone before every shift. Results go straight to management, creating a permanent record and reducing your compliance risk.
            </Feature>
            <Feature icon={QrCode} title="QR Code Machine Access">
              Every machine gets its own QR code. Operators scan it and land directly on that machine's pre-start — fast, consistent, and impossible to mix up.
            </Feature>
            <Feature icon={Truck} title="Fleet & Asset Management">
              Manage every piece of equipment in one place. Registration, serial numbers, service intervals, inspection history, and documents — all attached to the right machine.
            </Feature>
            <Feature icon={Wrench} title="Maintenance & Service Tracking">
              Record service history and track upcoming maintenance. Reduce unexpected breakdowns and keep your equipment running longer.
            </Feature>
            <Feature icon={ShieldCheck} title="Compliance Made Simple">
              Store operator licences, expiry dates, machine documentation, and safety records in one secure place. When an audit comes, you're ready.
            </Feature>
            <Feature icon={Users} title="Operator Management">
              Invite your team with a single link. Each operator gets their own account with the right permissions — they see what they need, nothing they don't.
            </Feature>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="border-t border-border/60 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">
            Trusted by operators in the field
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-2">
            <div className="surface-card p-6">
              <Quote className="size-6 text-primary/40" />
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                "We used to run everything off paper pre-start books and a group chat. FleetFlow replaced all of it. Our inspections are done before the machine even starts."
              </p>
              <div className="mt-4 text-xs font-medium text-foreground">
                — Site Supervisor, Civil Contractor — QLD
              </div>
            </div>
            <div className="surface-card p-6">
              <Quote className="size-6 text-primary/40" />
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                "The QR codes are the best part. The guys just scan the machine and they're straight into their pre-start. No excuses for skipping it."
              </p>
              <div className="mt-4 text-xs font-medium text-foreground">
                — Fleet Manager, Plant Hire Business — NSW
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How */}
      <section id="how" className="border-t border-border/60 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Up and running in minutes</h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            <Step n={1} title="Add your machines">
              Add your fleet to FleetFlow in minutes. Excavators, trucks, dozers, attachments — every piece of plant in one place.
            </Step>
            <Step n={2} title="Operators scan and go">
              Each machine gets its own QR code. Operators scan it on their phone and go straight to their pre-start checklist — no app download, no login hassle.
            </Step>
            <Step n={3} title="Management stays across everything">
              Inspections, defects, service records, and compliance documents are instantly available in your dashboard. No chasing paper, no missing records.
            </Step>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="border-t border-border/60 py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">Simple pricing. No per-user fees.</h2>
            <p className="mt-3 text-muted-foreground">
              Only administrators need a paid plan. Your operators, mechanics, and supervisors join for free under your subscription — no matter how many you have.
            </p>
            <p className="mt-2 text-xs text-muted-foreground">Prices in AUD. Cancel anytime — no contracts, no cancellation fees.</p>
          </div>

          <div className="mt-6 rounded-lg border border-primary/30 bg-primary/5 p-4 text-center text-sm font-medium text-primary">
            Unlimited operators included on every plan. You only pay for admin seats. <span className="font-semibold">Cancel anytime from Billing.</span>
          </div>


          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <PlanCard
              name="Starter"
              price={99}
              limit="1–10 assets"
              tagline="Solo operators & small yards"
              features={[
                "All compliance tracking",
                "Email expiry reminders",
                "Document storage",
                "1 admin user",
              ]}
            />
            <PlanCard
              name="Growth"
              price={199}
              limit="11–25 assets"
              tagline="Growing crews"
              featured
              features={[
                "Everything in Starter",
                "Operator portal + prestarts",
                "Defect reports & photos",
                "Unlimited team members",
              ]}
            />
            <PlanCard
              name="Pro"
              price={299}
              limit="26–50 assets"
              tagline="Active ops teams"
              features={[
                "Everything in Growth",
                "Operator licence tracking",
                "Reports & CSV export",
                "Unlimited team members",
              ]}
            />
            <PlanCard
              name="Business"
              price={499}
              limit="51–100 assets"
              tagline="Multi-yard operations"
              features={[
                "Everything in Pro",
                "Multi-yard / multi-depot",
                "API access (beta)",
                "Priority email support",
              ]}
            />
          </div>

          <div className="surface-card mt-4 flex flex-wrap items-center justify-between gap-4 p-6">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Enterprise</div>
              <div className="text-lg font-semibold">100+ assets — custom quote, SSO, dedicated support</div>
            </div>
            <Button asChild variant="outline" size="sm">
              <Link to="/contact">Contact sales</Link>
            </Button>
          </div>

          <div className="mt-8 text-center">
            <Button asChild size="lg">
              <Link to="/pricing">See full plan details</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-border/60 py-20">
        <div className="mx-auto max-w-3xl px-4 sm:px-6">
          <h2 className="text-center text-3xl font-semibold tracking-tight sm:text-4xl">Common questions</h2>
          <div className="mt-10 space-y-4">
            <FaqItem
              question="Do my operators need a paid subscription?"
              answer="No. Only company administrators require a paid plan. Operators, mechanics, supervisors, and any other staff join under your subscription at no extra cost."
            />
            <FaqItem
              question="Do operators need to download an app?"
              answer="FleetFlow works in any modern web browser — no app download required. Operators can access it from any phone, tablet, or computer."
            />
            <FaqItem
              question="Can I import my existing data?"
              answer="Yes. You can add your assets and operator details manually or contact us and we'll help you get set up quickly."
            />
            <FaqItem
              question="Where is my data stored?"
              answer="FleetFlow is cloud-based and your data is securely stored and isolated to your company only. No other organisation can see your information."
            />
            <FaqItem
              question="How does the $9.99 first month work?"
              answer="Pick any plan and your first month is just $9.99 AUD. After that, your plan renews at its standard monthly price (in AUD). Cancel anytime from Billing."
            />
            <FaqItem
              question="Can I cancel my subscription?"
              answer="Yes — any plan can be cancelled at any time, directly from the Billing page in your account. There are no contracts, no lock-ins, and no cancellation fees. You keep access until the end of your current billing period."
            />

              question="Is FleetFlow suitable for small businesses?"
              answer="Yes. FleetFlow is designed to scale — whether you're running 3 machines or 300, the platform works the same way."
            />
          </div>
        </div>
      </section>

      <footer className="border-t border-border/60 py-10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-4 text-xs text-muted-foreground sm:flex-row sm:px-6">
          <div className="flex items-center gap-2">
            <Logo size={16} />
            <span>© {new Date().getFullYear()} FleetFlow</span>
          </div>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/pricing" className="hover:text-foreground">Pricing</Link>
            <Link to="/contact" className="hover:text-foreground">Contact</Link>
            <Link to="/terms" className="hover:text-foreground">Terms</Link>
            <Link to="/privacy" className="hover:text-foreground">Privacy</Link>
            <Link to="/refund" className="hover:text-foreground">Refunds</Link>
          </div>
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

function FaqItem({ question, answer }: { question: string; answer: string }) {
  return (
    <div className="surface-card p-5">
      <h3 className="text-sm font-semibold">{question}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{answer}</p>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border bg-card/40 p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-lg font-semibold">{value}</div>
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
  return <span className={`rounded-full border px-2 py-0.5 font-semibold ${cls}`}>{children}</span>;
}

function AssetRow({
  code,
  name,
  sub,
  tone,
  badge,
}: {
  code: string;
  name: string;
  sub: string;
  tone: "success" | "warning" | "danger";
  badge: string;
}) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <div className="grid size-9 shrink-0 place-items-center rounded-md bg-muted text-[10px] font-bold uppercase text-muted-foreground">
        {code}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{sub}</div>
      </div>
      <Pill tone={tone}>{badge}</Pill>
    </li>
  );
}

function PlanCard({
  name,
  price,
  limit,
  tagline,
  features,
  featured,
}: {
  name: string;
  price: number;
  limit: string;
  tagline: string;
  features: string[];
  featured?: boolean;
}) {
  return (
    <div
      className={`surface-card relative flex flex-col p-6 ${
        featured ? "border-primary/60 ring-1 ring-primary/40" : ""
      }`}
    >
      {featured && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-primary-foreground">
          Most popular
        </div>
      )}
      <div className="text-sm font-medium text-muted-foreground">{name}</div>
      <div className="mt-2 flex items-baseline gap-1">
        <span className="text-3xl font-semibold">${price} AUD</span>
        <span className="text-sm text-muted-foreground">/mo</span>
      </div>
      <div className="mt-1 text-sm text-foreground/80">{limit}</div>
      <div className="mt-1 text-xs text-muted-foreground">{tagline}</div>
      <ul className="mt-5 space-y-2 text-sm">
        {features.map((f) => (
          <li key={f} className="flex items-start gap-2">
            <Check className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>{f}</span>
          </li>
        ))}
      </ul>
      <Button asChild size="sm" variant={featured ? "default" : "outline"} className="mt-6 w-full">
        <Link to="/auth" search={{ mode: "signup" }}>Get started — $9.99 AUD first month</Link>
      </Button>
    </div>
  );
}
