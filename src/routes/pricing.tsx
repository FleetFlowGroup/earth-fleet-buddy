import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, Truck, ArrowRight } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — FleetFlow" },
      {
        name: "description",
        content:
          "Simple per-asset pricing for FleetFlow. From $99/month for up to 10 assets. 14-day free trial, cancel anytime.",
      },
    ],
  }),
  component: PricingPage,
});

const TIERS = [
  { id: "starter_plan", priceId: "starter_monthly", name: "Starter", price: 99, limit: "1–10 assets", featured: false },
  { id: "growth_plan", priceId: "growth_monthly", name: "Growth", price: 199, limit: "11–25 assets", featured: true },
  { id: "pro_plan", priceId: "pro_monthly", name: "Pro", price: 299, limit: "26–50 assets", featured: false },
  { id: "business_plan", priceId: "business_monthly", name: "Business", price: 499, limit: "51–100 assets", featured: false },
] as const;

const FEATURES = [
  "Unlimited team members",
  "Rego, insurance & service tracking",
  "Document storage",
  "Auto reminders (30/14/7 days)",
  "Operator portal & prestart checks",
  "Defect reports with photos",
];

function PricingPage() {
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const { openCheckout, loading } = usePaddleCheckout();

  async function subscribe(priceId: string) {
    if (!me?.userId || !me?.company?.id) {
      navigate({ to: "/auth", search: { mode: "signup" } });
      return;
    }
    await openCheckout({
      priceId,
      customerEmail: me.email,
      companyId: me.company.id,
      userId: me.userId,
      successUrl: `${window.location.origin}/billing?checkout=success`,
    });
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PaymentTestModeBanner />
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid size-8 place-items-center rounded-md bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
              <Truck className="size-4" />
            </div>
            <span className="text-base font-semibold tracking-tight">FleetFlow</span>
          </Link>
          <Button asChild variant="ghost" size="sm">
            <Link to={me ? "/dashboard" : "/auth"}>{me ? "Open app" : "Sign in"}</Link>
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Pricing</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Pay per asset, not per user. 14-day free trial on any plan. Cancel anytime.
          </p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-4">
          {TIERS.map((t) => (
            <div
              key={t.id}
              className={`surface-card relative flex flex-col p-6 ${
                t.featured ? "border-primary/60 ring-1 ring-primary/40" : ""
              }`}
            >
              {t.featured && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-primary px-3 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary-foreground">
                  Most popular
                </div>
              )}
              <div className="text-sm font-medium text-muted-foreground">{t.name}</div>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-4xl font-semibold">${t.price}</span>
                <span className="text-sm text-muted-foreground">/mo</span>
              </div>
              <div className="mt-1 text-sm text-foreground/80">{t.limit}</div>
              <ul className="mt-6 flex-1 space-y-2 text-sm text-muted-foreground">
                {FEATURES.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 text-primary" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button
                className="mt-6 w-full"
                variant={t.featured ? "default" : "outline"}
                disabled={loading}
                onClick={() => subscribe(t.priceId)}
              >
                {me ? "Subscribe" : "Start free trial"}
              </Button>
            </div>
          ))}
        </div>

        {/* Enterprise tier */}
        <div className="surface-card mt-6 flex flex-wrap items-center justify-between gap-4 p-6">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Enterprise</div>
            <div className="text-xl font-semibold">100+ assets</div>
            <div className="mt-1 text-sm text-muted-foreground">
              Custom pricing, dedicated onboarding, SSO and priority support.
            </div>
          </div>
          <Button asChild variant="outline">
            <a href="mailto:sales@fleetflow.app?subject=Enterprise%20quote">
              Contact sales <ArrowRight className="ml-1 size-4" />
            </a>
          </Button>
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Prices in USD. Taxes calculated at checkout where applicable. By subscribing you agree to our{" "}
          <Link to="/terms" className="underline">Terms</Link>,{" "}
          <Link to="/privacy" className="underline">Privacy Notice</Link> and{" "}
          <Link to="/refund" className="underline">Refund Policy</Link>.
        </p>
      </section>
    </div>
  );
}
