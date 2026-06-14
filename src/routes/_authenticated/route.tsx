import { createFileRoute, Outlet, redirect, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { getRestoredUser } from "@/lib/auth-ready";
import { useCurrentUser } from "@/hooks/use-current-user";
import { isOperatorPreviewOn } from "@/lib/operator-preview";

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
  const { data: me, isLoading } = useCurrentUser();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (isLoading || !me) return;
    if (isOperatorPreviewOn()) return; // admin preview mode is opt-in
    // Operators may only access the operator portal — even by typing URLs.
    if (me.role === "operator" && !location.pathname.startsWith("/operator")) {
      navigate({ to: "/operator", replace: true });
    }
  }, [me, isLoading, location.pathname, navigate]);

  return <Outlet />;
}
