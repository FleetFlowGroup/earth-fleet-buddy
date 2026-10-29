import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PLAN_LABEL, PLAN_LIMIT, PLAN_ORDER, isUnlimitedAssetLimit } from "@/hooks/use-subscription";
import {
  APPLE_MANAGE_SUBSCRIPTIONS_URL,
  iapAvailable,
  loadIapProducts,
  purchaseIapPlan,
  restoreIapPurchases,
  type IapProduct,
} from "@/lib/iap";

/** iOS app only. Apple rules: no links to web checkout here. */
export function IapBillingPanel({
  companyId,
  currentProductId,
  provider,
}: {
  companyId: string;
  currentProductId: string | null;
  provider: "paddle" | "apple" | null;
}) {
  const qc = useQueryClient();
  const [products, setProducts] = useState<IapProduct[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (provider === "paddle" || !iapAvailable()) return;
    loadIapProducts(companyId).then(setProducts).catch(() => setProducts([]));
  }, [companyId, provider]);

  if (provider === "paddle") {
    return (
      <div className="surface-card p-6 text-sm text-muted-foreground">
        Your subscription is billed through your FleetFlow web account. Manage it from a web browser.
      </div>
    );
  }
  if (!iapAvailable()) {
    return <div className="surface-card p-6 text-sm text-muted-foreground">In-app purchases aren't available on this device.</div>;
  }

  const refresh = async () => {
    // The webhook updates the subscription a few seconds after Apple confirms.
    for (const delay of [1500, 4000, 8000]) {
      await new Promise((r) => setTimeout(r, delay));
      await qc.invalidateQueries({ queryKey: ["billing-state"] });
      await qc.invalidateQueries({ queryKey: ["billing-provider"] });
    }
  };

  async function buy(planId: string) {
    setBusy(planId);
    try {
      if (await purchaseIapPlan(companyId, planId)) {
        toast.success(`Subscribed to ${PLAN_LABEL[planId]}`);
        await refresh();
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Purchase failed");
    } finally {
      setBusy(null);
    }
  }

  async function restore() {
    setBusy("restore");
    try {
      await restoreIapPurchases(companyId);
      toast.success("Purchases restored");
      await refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Restore failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="surface-card p-6">
      <div className="text-sm font-semibold">{provider === "apple" ? "Change plan" : "Choose a plan"}</div>
      <p className="mt-1 text-xs text-muted-foreground">Billed monthly through your Apple ID. Cancel anytime in Settings.</p>
      {products === null ? (
        <Loader2 className="mt-4 size-4 animate-spin" />
      ) : products.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Plans couldn't be loaded from the App Store. Try again later.</p>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {PLAN_ORDER.map((id) => {
            const p = products.find((x) => x.planId === id);
            if (!p) return null;
            const isCurrent = provider === "apple" && currentProductId === id;
            return (
              <div key={id} className={`flex flex-col rounded-lg border p-4 ${isCurrent ? "border-primary bg-primary/5" : "border-border bg-card/40"}`}>
                <div className="text-sm font-medium">{PLAN_LABEL[id]}</div>
                <div className="mt-1 text-xs text-muted-foreground">{isUnlimitedAssetLimit(PLAN_LIMIT[id]) ? "Unlimited assets" : `Up to ${PLAN_LIMIT[id]} assets`}</div>
                <div className="mt-3 text-xl font-semibold">{p.priceString} <span className="text-xs font-normal text-muted-foreground">/month</span></div>
                <Button size="sm" className="mt-4 w-full" variant={isCurrent ? "outline" : "default"} disabled={isCurrent || !!busy} onClick={() => buy(id)}>
                  {busy === id ? <Loader2 className="mr-2 size-4 animate-spin" /> : isCurrent ? <Check className="mr-1 size-4" /> : null}
                  {isCurrent ? "Current" : "Subscribe"}
                </Button>
              </div>
            );
          })}
        </div>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        <Button variant="ghost" size="sm" disabled={!!busy} onClick={restore}>
          {busy === "restore" ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}Restore purchases
        </Button>
        {provider === "apple" && (
          <Button variant="ghost" size="sm" onClick={() => window.open(APPLE_MANAGE_SUBSCRIPTIONS_URL, "_blank")}>
            Manage subscription
          </Button>
        )}
      </div>
    </div>
  );
}
