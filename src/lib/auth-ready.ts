import { supabase } from "@/integrations/supabase/client";

export async function getRestoredUser() {
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session?.user) return data.session.user;
  } catch {
    // Fall through to the verified user request below.
  }

  try {
    const { data } = await supabase.auth.getUser();
    return data.user ?? null;
  } catch {
    return null;
  }
}
