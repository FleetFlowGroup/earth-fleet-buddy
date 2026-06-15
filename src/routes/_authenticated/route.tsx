import { createFileRoute, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getRestoredUser } from "@/lib/auth-ready";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useBillingState } from "@/hooks/use-subscription";
import { isOperatorPreviewOn } from "@/lib/operator-preview";
import { rememberRoute } from "@/lib/last-route";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getRestoredUser();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: AuthedLayout,
});

// Paths that remain accessible without an active subscription so users can
// pay, finish onboarding, or use the operator portal.
const SUBSCRIPTION_EXEMPT_PREFIXES = ["/billing", "/onboarding", "/operator"];

function AuthedLayout() {
  const { data: me, isLoading } = useCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();
  const companyId = me?.company?.id;
  const { data: billing, isLoading: billingLoading } = useBillingState(companyId);

  // Remember the user's last authenticated route so we can return them
  // here after refresh or re-login.
  useEffect(() => {
    rememberRoute(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (isLoading || !me) return;
    if (isOperatorPreviewOn()) return; // admin preview mode is opt-in
    // Operators may only access the operator portal — even by typing URLs.
    if (me.role === "operator" && !location.pathname.startsWith("/operator")) {
      navigate({ to: "/operator", replace: true });
    }
  }, [me, isLoading, location.pathname, navigate]);

  // Subscription paywall: non-operator users must have an active billing
  // state (trial, subscribed, or canceled_grace) to access the portal.
  // Without it we redirect them to /billing to subscribe.
  useEffect(() => {
    if (isLoading || !me) return;
    if (me.role === "operator") return;
    if (isOperatorPreviewOn()) return;
    if (!companyId) return;
    if (billingLoading) return;
    const exempt = SUBSCRIPTION_EXEMPT_PREFIXES.some((p) => location.pathname.startsWith(p));
    if (exempt) return;
    const state = billing?.state ?? "none";
    if (state === "none") {
      navigate({ to: "/billing", replace: true });
    }
  }, [me, isLoading, companyId, billing, billingLoading, location.pathname, navigate]);

  return <Outlet />;
}
