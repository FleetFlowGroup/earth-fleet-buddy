# Project rules
- Manually applied SQL records in supabase/migrations are archival when their header prohibits execution; never replay them through tooling, because the database change has already been applied outside this repository.
- Prestart and defect inserts return their IDs under user RLS; retain company-scoped submitter SELECT policies so QR-selected, unassigned assets work without granting access to other operators' records.
- Operator membership provisioning runs in a database trigger on user_roles so invitation acceptance and existing role-management paths share the same company-scoped linking behavior.
- Resolve the active company from verified user_roles, using profiles.company_id only when it identifies a membership; this prevents stale profile mappings from choosing an unauthorised company.
- Store owner-granted free access in company_complimentary_access, enforced by both company billing and asset-limit functions; never fabricate Paddle subscriptions or count complimentary grants as paid revenue.
- Prestart submission uses the signature-first helper and admin signature-view helper; abort before inserting on signature failure and regenerate signed URLs on detail opening so saved signatures remain required and viewable.
- Keep the Phase 1 assistant preview-gated, read-only and isolated in assistant modules; use verified caller memberships and static retrieval so existing account workflows and permissions remain unchanged.
- Block authenticated child rendering until the current user role resolves; gate admin reads on a known non-operator role and resolve login destinations through the same current-user query to prevent pre-redirect query exposure.

## Migration record attribution correction (2026-10-28)

- `supabase/migrations/20261028074200_reserve_team_invite_email.sql`: the SQL it records was applied at approx. 18:42 AEDT (UTC+11) on 2026-10-28 and verified by Lovable (the AI assistant, via Lovable query tooling), not by the project owner.
- The file's header line "APPLIED MANUALLY on 2026-10-28 and verified by the project owner." is inaccurate. It is intentionally left unedited because `supabase/migrations/` is platform-protected and editing an applied migration could alter its recorded hash.
- The file remains an archival record only and must not be re-executed by tooling.
