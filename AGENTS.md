# Project rules
- Prestart and defect inserts return their IDs under user RLS; retain company-scoped submitter SELECT policies so QR-selected, unassigned assets work without granting access to other operators' records.
- Operator membership provisioning runs in a database trigger on user_roles so invitation acceptance and existing role-management paths share the same company-scoped linking behavior.
- Resolve the active company from verified user_roles, using profiles.company_id only when it identifies a membership; this prevents stale profile mappings from choosing an unauthorised company.