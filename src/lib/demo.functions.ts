import { createServerFn } from "@tanstack/react-start";

// Public demo credentials — intentionally shared. The demo tenant is
// rebuilt on each call so visitors can't damage anything persistent.
export const DEMO_EMAIL = "demo@summitcivil.example";
export const DEMO_PASSWORD = "FleetFlowDemo2026!";

/**
 * Ensure the demo auth user exists and (re)seed the Summit Civil demo
 * company. Returns the credentials the client should sign in with.
 *
 * Idempotent: safe to call repeatedly. Each call wipes any prior demo
 * company and rebuilds it from scratch via `public.seed_demo_company`.
 */
export const startDemoSession = createServerFn({ method: "POST" }).handler(
  async () => {
    const { supabaseAdmin } = await import(
      "@/integrations/supabase/client.server"
    );

    // 1. Find or create the demo auth user.
    let demoUserId: string | null = null;
    // listUsers is the simplest "find by email" path on the admin API.
    const { data: list, error: listErr } =
      await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (listErr) throw new Error(listErr.message);
    const existing = list.users.find(
      (u) => (u.email ?? "").toLowerCase() === DEMO_EMAIL,
    );
    if (existing) {
      demoUserId = existing.id;
      // Make sure password is always the published one (in case it drifted).
      await supabaseAdmin.auth.admin.updateUserById(existing.id, {
        password: DEMO_PASSWORD,
        email_confirm: true,
      });
    } else {
      const { data: created, error: createErr } =
        await supabaseAdmin.auth.admin.createUser({
          email: DEMO_EMAIL,
          password: DEMO_PASSWORD,
          email_confirm: true,
          user_metadata: { full_name: "Demo Admin" },
        });
      if (createErr) throw new Error(createErr.message);
      demoUserId = created.user?.id ?? null;
    }
    if (!demoUserId) throw new Error("Could not provision demo user");

    // 2. Rebuild the demo company.
    const { error: seedErr } = await supabaseAdmin.rpc(
      "seed_demo_company" as never,
      { _admin_user_id: demoUserId } as never,
    );
    if (seedErr) throw new Error(seedErr.message);

    return { email: DEMO_EMAIL, password: DEMO_PASSWORD };
  },
);
