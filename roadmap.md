# Prestart submission repair
## Applied invitation SQL record
- [ ] Record the owner-confirmed, manually applied Variant 2 SQL without executing SQL or publishing; supersede the proposal.
- [ ] Rerun the full offline Vitest suite and Bun isolation tests; report exact results.
- [ ] Check whether preview, production, or drafts have separate databases using read-only configuration evidence.
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