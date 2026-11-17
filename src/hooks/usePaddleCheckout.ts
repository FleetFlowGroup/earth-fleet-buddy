import { useState } from "react";
import { toast } from "sonner";
import { initializePaddle, getPaddlePriceId, getPaddleEnvironment } from "@/lib/paddle";
import { guardPaddleCheckout } from "@/utils/payments.functions";

type OpenOptions = {
  priceId: string;
  customerEmail?: string;
  companyId: string;
  userId: string;
  successUrl?: string;
  discountId?: string;
};

export function usePaddleCheckout() {
  const [loading, setLoading] = useState(false);

  async function openCheckout(opts: OpenOptions) {
    setLoading(true);
    try {
      await guardPaddleCheckout({
        data: { companyId: opts.companyId, environment: getPaddleEnvironment() },
      });
      await initializePaddle();
      const paddlePriceId = await getPaddlePriceId(opts.priceId);
      window.Paddle.Checkout.open({
        items: [{ priceId: paddlePriceId, quantity: 1 }],
        customer: opts.customerEmail ? { email: opts.customerEmail } : undefined,
        customData: { companyId: opts.companyId, userId: opts.userId },
        discountId: opts.discountId,
        settings: {
          displayMode: "overlay",
          successUrl: opts.successUrl ?? `${window.location.origin}/billing?checkout=success`,
          allowLogout: false,
          variant: "one-page",
        },
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not start checkout");
      throw error;
    } finally {
      setLoading(false);
    }
  }

  return { openCheckout, loading };
}
