# Prestart submission repair
## Applied invitation SQL record
- [x] Recorded the exact owner-confirmed Variant 2 SQL in supabase/migrations/20261028074200_reserve_team_invite_email.sql with a manually-applied/do-not-reexecute header and no outer transaction; proposal superseded. No SQL execution, migration-tool use, emails, data changes or publishing.
- [x] Full offline Vitest suite: 84 passed, 0 failed across 2 files (31 security + 53 handler tests); Bun isolation suite: 7 passed, 0 failed across 1 file.
- [x] No separate staging/test database is configured: project context states preview and published share one backend; local environment configuration is consistent and draft listing shows no drafts. Payment test/live modes do not isolate the database. External unconfigured databases are not independently verifiable.
## Phase 1 browser email security
- [x] Saved atomic reservation and both index variants under supabase/proposed only; sender fails closed on missing RPC. Offline tests: 84 Vitest + 7 existing isolation tests passed; automatic build OK. No DDL, emails, data changes or publishing; real database concurrency remains untested until separately approved SQL application.
- [x] Final hardening: verified emails, new-company controls, sanitised names and last-moment state/permission checks; 65 mocked/pure invitation tests and 7 existing isolation tests passed; automatic build OK. Atomic reservation and indexes proposed as text only, not applied.
- [x] Restrict browser sends to verified, authorised team invitations and log-backed limits; no sends, deployment, policies, or migrations.
- [x] Audit callers and trusted server imports; 31 offline authorisation/limit tests and 7 existing isolation tests passed.

## Previous repair
- [x] Investigate membership, operator links, and policies without contacting the separate customer company.
- [x] Apply secure submission policies and future operator provisioning; isolation tests pass.
- [ ] Verify the affected user's saved prestart and QR flow — blocked by no permission to impersonate or submit customer test records.
- [x] Apply required package security update.
- [x] Record the instruction not to send the separate company anything.
- [x] Repair the existing affected customer's missing operator link without changing their role or contacting them; verified an active operator linked to their user and company.