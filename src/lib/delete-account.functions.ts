import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertReauthEmail } from "@/lib/account-deletion";

const schema = z.object({
  mode: z.enum(["leave", "delete_companies"]),
  confirmation: z.literal("DELETE"),
  reauthEmail: z.string().trim().email().max(320),
});

/**
 * Deletes the signed-in account only. The SQL function (migration 0010, NOT APPLIED)
 * checks auth.uid(), company membership and the sole-admin rule. This handler uses
 * the caller's JWT client, never the service role.
 */
export const deleteOwnAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => schema.parse(input))
  .handler(async ({ data, context }) => {
    const { data: userData, error: userError } = await context.supabase.auth.getUser();
    if (userError) throw new Error("reauth_required");
    assertReauthEmail(userData.user?.email, data.reauthEmail);

    const { data: result, error } = await (
      context.supabase as unknown as {
        rpc: (
          fn: string,
          args: Record<string, string>,
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
      }
    ).rpc("delete_own_account", {
      _mode: data.mode,
      _confirmation: data.confirmation,
    });
    if (error) throw new Error(error.message);
    return result ?? { deleted: true };
  });
