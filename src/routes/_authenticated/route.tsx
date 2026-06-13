import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { getRestoredUser } from "@/lib/auth-ready";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const user = await getRestoredUser();
    if (!user) throw redirect({ to: "/auth" });
    return { user };
  },
  component: () => <Outlet />,
});
