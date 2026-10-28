import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/integrations/supabase/types';
import { memberCompanyId } from '@/lib/company-membership';
import type { Audience } from './routes';
export type AssistantIdentity = { companyId: string | null; companyName: string | null; role: string | null; audience: Audience };
export function audienceFor(role: string | null): Audience {
  if (role === 'operator') return 'operator';
  if (['admin', 'manager', 'supervisor', 'super_admin'].includes(role ?? '')) return 'admin';
  return role ? 'office' : 'all';
}
export async function readAssistantContext(client: SupabaseClient<Database>, userId: string): Promise<AssistantIdentity> {
  const [{ data: profile, error: profileError }, { data: memberships, error: roleError }] = await Promise.all([
    client.from('profiles').select('company_id').eq('id', userId).maybeSingle(),
    client.from('user_roles').select('company_id,role').eq('user_id', userId),
  ]);
  if (profileError || roleError) throw new Error('Assistant context unavailable');
  const companyId = memberCompanyId(profile?.company_id, memberships ?? []);
  if (!companyId) return { companyId: null, companyName: null, role: null, audience: 'all' };
  const [{ data: role, error: currentRoleError }, { data: company, error: companyError }] = await Promise.all([
    client.rpc('current_role', { _company_id: companyId }),
    client.from('companies').select('name').eq('id', companyId).maybeSingle(),
  ]);
  if (currentRoleError || companyError || !company || !role || !memberships?.some(m => m.company_id === companyId && m.role === role)) throw new Error('Assistant context unavailable');
  // Only the active, membership-verified, RLS-scoped company is exposed to support.
  // Never include the company name or role in diagnostic logs.
  return { companyId, companyName: company.name, role, audience: audienceFor(role) };
}
