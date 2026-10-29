import type { SupabaseClient } from '@supabase/supabase-js';
export type DurableResult = 'allowed' | 'limited' | 'unavailable' | 'missing';
// Calls the SECURITY DEFINER RPC (migration 0007) with the caller's own RLS
// client. The database derives the user from auth.uid() and verifies membership.
export async function consumeDurable(client: SupabaseClient<any>, companyId: string): Promise<DurableResult> {
  try {
    const { data, error } = await client.rpc('assistant_consume', { _company_id: companyId });
    if (error) return error.code === 'PGRST202' || error.code === '42883' ? 'missing' : 'unavailable';
    return data === true ? 'allowed' : 'limited';
  } catch { return 'unavailable'; }
}
// Fail closed. The only exception: on a preview host, if 0007 is not yet
// applied (function missing), fall back to the in-memory limiter.
export function durableAllows(result: DurableResult, preview: boolean) {
  return result === 'allowed' || (preview && result === 'missing');
}
