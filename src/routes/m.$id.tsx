// QR-scan landing for a machine. Public URL `/m/<assetId>`.
// - Signed out → /auth?redirect=/m/<id>
// - Operator → /operator?asset=<id> (operator view targeted at that machine)
// - Admin / manager / office / workshop → /assets/<id> (full admin view)
// - Other company → not found message
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

export const Route = createFileRoute("/m/$id")({
  ssr: false,
  head: () => ({ meta: [{ title: "Machine · FleetFlow" }] }),
  component: MachineDispatcher,
});

function MachineDispatcher() {
  const { id } = Route.useParams();
  const navigate = useNavigate();

  const { data, isLoading, error } = useQuery({
    queryKey: ["m-dispatch", id],
    queryFn: async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const user = userRes.user;
      if (!user) {
        navigate({ to: "/auth", search: { redirect: `/m/${id}` } as any, replace: true });
        return null;
      }
      // Fetch asset (RLS will block cross-company)
      const { data: asset } = await (supabase as any)
        .from("assets").select("id, company_id").eq("id", id).maybeSingle();
      if (!asset) return { notFound: true } as any;

      // Pick highest-priority role within that company
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("company_id", asset.company_id);
      const rs = (roles ?? []).map((r: any) => r.role);
      const isOperatorOnly = rs.length === 1 && rs[0] === "operator";
      const isAdminLike = rs.some((r) => ["admin", "manager", "office_staff", "workshop"].includes(r));

      if (isAdminLike) {
        navigate({ to: "/assets/$id", params: { id }, replace: true });
      } else if (isOperatorOnly) {
        navigate({ to: "/operator", search: { asset: id } as any, replace: true });
      } else {
        return { notFound: true } as any;
      }
      return { dispatched: true } as any;
    },
  });

  if (isLoading || data?.dispatched) {
    return (
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (error || data?.notFound) {
    return (
      <div className="grid min-h-screen place-items-center bg-background p-6">
        <div className="surface-card max-w-sm p-6 text-center">
          <AlertCircle className="mx-auto mb-3 size-8 text-destructive" />
          <h1 className="text-lg font-semibold">Machine not available</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            This machine isn't part of your company, or you don't have access. Sign in with the correct account.
          </p>
        </div>
      </div>
    );
  }
  return null;
}
