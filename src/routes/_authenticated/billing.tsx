import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell, PageHeader } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useBillingState, useAssetCount, PLAN_LABEL, PLAN_LIMIT, PLAN_ORDER, PLAN_PRICE_ID, PLAN_PRICE_AUD, PLAN_INTRO_DISCOUNT_ID } from "@/hooks/use-subscription";
import { usePaddleCheckout } from "@/hooks/usePaddleCheckout";
import { changeSubscriptionPlan, createPortalSession } from "@/utils/payments.functions";
import { getPaddleEnvironment } from "@/lib/paddle";
import { useQueryClient } from "@tanstack/react-query";

import { toast } from "sonner";
import { Loader2, ExternalLink, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/billing")({
  head: () => ({ meta: [{ title: "Billing · FleetFlow" }] }),
  component: BillingPage,
});

function BillingPage() {
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const companyId = me?.company?.id;
  const isAdmin = me?.role === "admin";

  const { data: billing, isLoading } = useBillingState(companyId);
  const { data: assetCount = 0 } = useAssetCount(companyId);
  const { openCheckout, loading: checkoutLoading } = usePaddleCheckout();
  const [busy, setBusy] = useState<string | null>(null);

  if (!isAdmin) {
    return (
      <AppShell>
        <PageHeader title="Billing" />
        <div className="px-4 py-10 sm:px-8">
          <p className="text-sm text-muted-foreground">Only company administrators can manage billing.</p>
        </div>
      </AppShell>
    );
  }

  async function subscribe(priceId: string) {
    if (!me?.userId || !companyId) return;
    await openCheckout({
      priceId,
      customerEmail: me.email,
      companyId,
      userId: me.userId,
      successUrl: `${window.location.origin}/billing?checkout=success`,
    });
  }

  async function changePlan(productId: string) {
    if (!companyId) return;
    setBusy(productId);
    try {
      await changeSubscriptionPlan({
        data: { companyId, newPriceId: PLAN_PRICE_ID[productId], environment: getPaddleEnvironment() },
      });
      toast.success(`Plan changed to ${PLAN_LABEL[productId]}`);
      await qc.invalidateQueries({ queryKey: ["billing-state"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not change plan");
    } finally {
      setBusy(null);
    }
  }

  async function openPortal() {
    if (!companyId) return;
    setBusy("portal");
    try {
      const { url } = await createPortalSession({
        data: { companyId, environment: getPaddleEnvironment() },
      });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not open portal");
    } finally {
      setBusy(null);
    }
  }

  return (
    <AppShell>
      <PageHeader title="Billing" description="Manage your FleetFlow subscription, plan and payment method." />
      <div className="space-y-6 px-4 py-6 sm:px-8">
        {isLoading || !billing ? (
          <div className="surface-card p-6"><Loader2 className="size-4 animate-spin" /></div>
        ) : (
          <>
            {/* Current plan card */}
            <div className="surface-card p-6">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">Current plan</div>
                  <div className="mt-1 text-2xl font-semibold">
                    {billing.state === "none"
                      ? "No active plan"
                      : PLAN_LABEL[billing.product_id ?? ""] ?? "—"}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {billing.state === "subscribed" && billing.period_end
                      ? `Renews ${new Date(billing.period_end).toLocaleDateString()}`
                      : billing.state === "canceled_grace" && billing.period_end
                        ? `Access ends ${new Date(billing.period_end).toLocaleDateString()}`
                        : "Subscribe to start using FleetFlow — first month $9.99 AUD."}
                  </div>
                  {billing.status === "past_due" && (
                    <div className="mt-2 inline-block rounded-md bg-destructive/15 px-2 py-0.5 text-xs text-destructive">
                      Payment failed — update your card to keep your access
                    </div>
                  )}
                </div>
                {billing.state === "subscribed" && (
                  <Button variant="outline" disabled={busy === "portal"} onClick={openPortal}>
                    {busy === "portal" ? <Loader2 className="mr-2 size-4 animate-spin" /> : <ExternalLink className="mr-2 size-4" />}
                    Manage payment / cancel
                  </Button>
                )}
              </div>

              {/* Usage */}
              <div className="mt-6 rounded-lg border border-border bg-card/40 p-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Assets used</span>
                  <span className="font-medium">
                    {assetCount} / {billing.asset_limit}
                  </span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={`h-full ${assetCount >= billing.asset_limit ? "bg-destructive" : "bg-primary"}`}
                    style={{ width: `${billing.asset_limit ? Math.min(100, (assetCount / billing.asset_limit) * 100) : 0}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Plan picker */}
            <div className="surface-card p-6">
              <div className="text-sm font-semibold">
                {billing.state === "subscribed" || billing.state === "canceled_grace" ? "Change plan" : "Choose a plan"}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Upgrades are prorated immediately. Downgrades take effect at the next renewal.
              </p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {PLAN_ORDER.map((id) => {
                  const isCurrent = billing.product_id === id;
                  return (
                    <div
                      key={id}
                      className={`flex flex-col rounded-lg border p-4 ${
                        isCurrent ? "border-primary bg-primary/5" : "border-border bg-card/40"
                      }`}
                    >
                      <div className="text-sm font-medium">{PLAN_LABEL[id]}</div>
                      <div className="mt-1 text-xs text-muted-foreground">Up to {PLAN_LIMIT[id]} assets</div>
                      <div className="mt-3 text-xl font-semibold">${PLAN_PRICE_AUD[id]} <span className="text-xs font-normal text-muted-foreground">AUD/mo</span></div>
                      {billing.state !== "subscribed" && billing.state !== "canceled_grace" && (
                        <div className="mt-1 text-[11px] font-medium text-primary">First month $9.99 AUD</div>
                      )}
                      <Button
                        size="sm"
                        variant={isCurrent ? "outline" : "default"}
                        className="mt-4 w-full"
                        disabled={isCurrent || busy === id || checkoutLoading}
                        onClick={() =>
                          billing.state === "subscribed" || billing.state === "canceled_grace"
                            ? changePlan(id)
                            : subscribe(PLAN_PRICE_ID[id])
                        }
                      >
                        {busy === id ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
                        {isCurrent ? (
                          <>
                            <Check className="mr-1 size-4" />
                            Current
                          </>
                        ) : billing.state === "subscribed" || billing.state === "canceled_grace" ? (
                          "Switch to this"
                        ) : (
                          "Subscribe"
                        )}
                      </Button>
                    </div>
                  );
                })}
              </div>
              <div className="mt-4 text-center">
                <Button variant="ghost" size="sm" onClick={() => navigate({ to: "/pricing" })}>
                  Compare plans →
                </Button>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              Payments are processed by Paddle.com, our reseller and merchant of record. Refunds within 30 days.
            </p>
          </>
        )}
      </div>
    </AppShell>
  );
}
