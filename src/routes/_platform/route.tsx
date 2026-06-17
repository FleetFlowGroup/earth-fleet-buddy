import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Shield, Loader2 } from "lucide-react";

/**
 * /_platform — pathless layout that gates the entire Mission Control surface.
 *
 * Security:
 *  - ssr:false because the auth session lives in localStorage.
 *  - beforeLoad checks the user is signed in.
 *  - Component then verifies `is_platform_admin()` against the DB. On failure
 *    the user sees a 403 page and the attempt is recorded in the audit log.
 *  - Every server function called from this subtree also checks the RPC,
 *    so a forged route component still can't read any data.
 */
export const Route = createFileRoute("/_platform")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) {
      throw redirect({ to: "/auth" });
    }
  },
  component: PlatformGate,
});

function PlatformGate() {
  const [state, setState] = useState<"checking" | "ok" | "denied">("checking");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await (supabase as any).rpc("is_platform_admin");
        if (cancelled) return;
        if (error || !data) {
          // Audit the denied attempt with as much context as possible.
          try {
            await (supabase as any).rpc("log_audit", {
              _company_id: null,
              _action: "platform.access_denied",
              _entity_type: "mission_control",
              _entity_id: null,
              _metadata: { path: window.location.pathname },
              _user_agent: navigator.userAgent.slice(0, 500),
            });
          } catch { /* ignore */ }
          setState("denied");
          return;
        }
        setState("ok");
        try {
          await (supabase as any).rpc("log_audit", {
            _company_id: null,
            _action: "platform.viewed",
            _entity_type: "mission_control",
            _entity_id: null,
            _metadata: { path: window.location.pathname },
            _user_agent: navigator.userAgent.slice(0, 500),
          });
        } catch { /* ignore */ }
      } catch {
        if (!cancelled) setState("denied");
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (state === "checking") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05070d] text-white">
        <div className="flex flex-col items-center gap-3 text-zinc-400">
          <Loader2 className="size-6 animate-spin" />
          <span className="text-xs uppercase tracking-[0.2em]">Verifying clearance…</span>
        </div>
      </div>
    );
  }

  if (state === "denied") {
    return (
      <div className="grid min-h-screen place-items-center bg-[#05070d] px-4 text-white">
        <div className="max-w-md text-center">
          <div className="mx-auto grid size-14 place-items-center rounded-full bg-red-500/10 ring-1 ring-red-500/40">
            <Shield className="size-7 text-red-400" />
          </div>
          <h1 className="mt-5 text-3xl font-bold">403 — Access Denied</h1>
          <p className="mt-2 text-sm text-zinc-400">
            This area is restricted to FleetFlow Platform Administrators. This attempt has been logged.
          </p>
          <a href="/" className="mt-6 inline-block rounded-md border border-white/10 px-4 py-2 text-sm hover:bg-white/5">
            Return to safety
          </a>
        </div>
      </div>
    );
  }

  return <Outlet />;
}
