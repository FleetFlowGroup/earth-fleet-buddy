import { createFileRoute, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getRestoredUser } from "@/lib/auth-ready";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useBillingState } from "@/hooks/use-subscription";
import { isOperatorPreviewOn } from "@/lib/operator-preview";
import { rememberRoute } from "@/lib/last-route";
import { AssistantProvider } from "@/components/assistant-panel";
import { authenticatedRedirectDestination, isSubscriptionExemptPath, shouldRenderAuthedOutlet } from "@/lib/operator-access";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getRestoredUser();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: AuthedLayout,
});

function AuthedLayout() {
  const { data: me, isLoading, isError } = useCurrentUser();
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
    if (isLoading || isError || !me) return;
    const destination = authenticatedRedirectDestination(
      me.role, location.pathname, isOperatorPreviewOn(), { hasCompany: !!me.company },
    );
    if (destination) navigate({ to: destination, replace: true });
  }, [me, isLoading, isError, location.pathname, navigate]);

  // Subscription paywall: non-operator users must have an active billing
  // state (trial, subscribed, or canceled_grace) to access the portal.
  // Without it we redirect them to /billing to subscribe.
  useEffect(() => {
    if (isLoading || !me) return;
    if (me.role === "operator") return;
    if (isOperatorPreviewOn()) return;
    if (!companyId) return;
    if (billingLoading) return;
    const exempt = isSubscriptionExemptPath(location.pathname);
    if (exempt) return;
    const state = billing?.state ?? "none";
    if (state === "none") {
      navigate({ to: "/billing", replace: true });
    }
  }, [me, isLoading, companyId, billing, billingLoading, location.pathname, navigate]);

  if (!shouldRenderAuthedOutlet(me?.role, location.pathname, isOperatorPreviewOn(), isLoading, isError, me ? { hasCompany: !!me.company } : null)) {
    return <div className="grid min-h-screen place-items-center bg-background" role="status" aria-label="Loading account"><Loader2 className="size-6 animate-spin text-muted-foreground" /></div>;
  }

  return <AssistantProvider><Outlet /></AssistantProvider>;
}
