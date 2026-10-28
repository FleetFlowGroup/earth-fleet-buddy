type Membership = { company_id: string; role: string };

// A stale profile is not permission to use a company. Only fall back when
// there is exactly one company membership, avoiding arbitrary company choice.
export function memberCompanyId(profileCompanyId: string | null | undefined, memberships: Membership[]): string | null {
  const companies = [...new Set(memberships.map((row) => row.company_id))];
  if (profileCompanyId && companies.includes(profileCompanyId)) return profileCompanyId;
  return companies.length === 1 ? companies[0] : null;
}

export function prestartIdentity(args: {
  userId: string; companyId: string; asset: { id: string; company_id: string };
  operator: { id: string; user_id: string | null; company_id: string } | null;
  preview?: boolean;
}) {
  if (args.asset.company_id !== args.companyId) throw new Error("This machine isn't part of your active company.");
  if (args.operator && (args.operator.company_id !== args.companyId || args.operator.user_id !== args.userId)) {
    throw new Error("Your operator account is not linked to this company. Ask your admin to check your team access.");
  }
  if (!args.operator && !args.preview) throw new Error("Your operator account is not linked. Ask your admin to check your team access.");
  return { company_id: args.companyId, asset_id: args.asset.id, operator_id: args.operator?.id ?? null, performed_by: args.userId };
}