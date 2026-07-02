import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Check, Truck } from "lucide-react";
import { useCurrentUser } from "@/hooks/use-current-user";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { PLAN_INTRO_DISCOUNT_ID } from "@/hooks/use-subscription";
import { PaymentTestModeBanner } from "@/components/PaymentTestModeBanner";

export const Route = createFileRoute("/pricing")({
  head: () => ({
    meta: [
      { title: "Pricing — FleetFlow" },
      {
        name: "description",
        content:
          "Simple monthly pricing for FleetFlow. From $49 AUD/month for 25 assets, unlimited users on every plan. First month $9.99 AUD. Cancel anytime.",
      },
      { property: "og:title", content: "Pricing — FleetFlow" },
      { property: "og:description", content: "Simple monthly pricing for FleetFlow. From $49 AUD/month for 25 assets, unlimited users on every plan. First month $9.99 AUD. Cancel anytime." },
      { property: "og:url", content: "https://fleetflow.group/pricing" },
    ],
    links: [
      { rel: "canonical", href: "https://fleetflow.group/pricing" },
    ],
  }),
  component: PricingPage,
});

type Tier = {
  id: "starter_plan" | "growth_plan" | "pro_plan" | "business_plan";
  priceId: string;
  name: string;
  price: number;
  limit: string;
  tagline: string;
  featured?: boolean;
  extraFeatures?: string[];
};

const TIERS: Tier[] = [
  { id: "starter_plan", priceId: "starter_monthly", name: "Starter", price: 49, limit: "Up to 25 assets", tagline: "Small crews getting started" },
  { id: "growth_plan", priceId: "growth_monthly", name: "Growth", price: 99, limit: "Up to 75 assets", tagline: "Growing operations", featured: true },
  { id: "pro_plan", priceId: "pro_monthly", name: "Business", price: 199, limit: "Up to 200 assets", tagline: "Established fleets" },
  { id: "business_plan", priceId: "business_monthly", name: "Enterprise", price: 299, limit: "Unlimited assets", tagline: "Large operations & multi-yard", extraFeatures: ["Unlimited assets", "Priority support"] },
];

const CORE_FEATURES = [
  "Digital pre-starts",
  "Asset management",
  "Service reminders",
  "Registration reminders",
  "QR code machine access",
  "Operator logins",
  "Unlimited users",
  "Email notifications",
  "Mobile-friendly platform",
];

function PricingPage() {
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const { openCheckout, loading } = usePaddleCheckout();

  async function subscribe(productId: string, priceId: string) {
    if (!me?.userId || !me?.company?.id) {
      navigate({ to: "/auth", search: { mode: "signup" } });
      return;
    }
    if (me.role !== "admin" && me.role !== "super_admin") {
      // Only the company admin pays. Invited staff are covered by the admin's plan.
      navigate({ to: "/dashboard" });
      return;
    }
    await openCheckout({
      priceId,
      discountId: PLAN_INTRO_DISCOUNT_ID[productId],
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

      <main>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="text-center">
          <h1 className="text-4xl font-semibold tracking-tight sm:text-5xl">Pricing</h1>
          <p className="mx-auto mt-3 max-w-xl text-muted-foreground">
            Pay by asset count, never by user. <span className="font-medium text-foreground">Unlimited admins and operators on every plan.</span> First month just $9.99 AUD. Cancel anytime.
          </p>
          <p className="mt-2 text-xs text-muted-foreground">All prices in AUD.</p>
        </div>

        <div className="mt-12 grid gap-5 lg:grid-cols-4">
          {TIERS.map((t) => {
            const features = [...CORE_FEATURES, ...(t.extraFeatures ?? [])];
            return (
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
                  <span className="text-sm text-muted-foreground">AUD/mo</span>
                </div>
                <div className="mt-1 text-xs font-medium text-primary">First month $9.99 AUD</div>
                <div className="mt-1 text-sm text-foreground/80">{t.limit}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{t.tagline}</div>
                <ul className="mt-6 flex-1 space-y-2 text-sm text-muted-foreground">
                  {features.map((f) => (
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
                  onClick={() => subscribe(t.id, t.priceId)}
                >
                  {me ? "Subscribe" : "Get started — $9.99 AUD"}
                </Button>
              </div>
            );
          })}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          Prices in AUD. Taxes calculated at checkout where applicable. By subscribing you agree to our{" "}
          <Link to="/terms" className="underline">Terms</Link>,{" "}
          <Link to="/privacy" className="underline">Privacy Notice</Link> and{" "}
          <Link to="/refund" className="underline">Refund Policy</Link>.
        </p>
      </section>
      </main>
    </div>
  );
}

