# FleetFlow Assistant — Phase 1, preview only

## What will be built
- 30–50 short Australian-English articles verified against existing FleetFlow behaviour; omit unconfirmed claims.
- Guidance-only Ask FleetFlow panel, admin header opener, operator Need help? tile and optional Contact & Feedback prefills. Users submit support requests themselves.
- Role-filtered retrieval, whitelisted internal links, server-verified identity and short numbered answers. Operators receive no admin/office articles.
- Component-memory history only; no emails, account actions, database changes, migrations, permission changes or publishing.

## Technical details
- New assistant modules under `src/lib/assistant/` and the panel under `src/components/`; application edits only in the four authorised mount/prefill files.
- Existing authenticated server-function middleware and caller's RLS-scoped client; read profile, verified memberships and company name, using existing `current_role`. Omit billing context unless an appropriate existing server-safe helper exists.
- Strip spoofed identity fields; enforce last-six-message, 2,000-character individual and 8,000-character total limits. Retrieve 3–6 appropriate articles and sanitise replies server-side.
- Authenticated model discovery confirmed `google/gemini-3.8-flash` on Chat Completions. Stream upstream and consume final output server-side, low temperature and approximately 700 output tokens. Avoid package changes by using fetch.
- In-memory per-instance limits: 10/minute/user, 100/day/user and 500/day/company. These reset on cold start and are not production-grade.
- Gateway rules prevent the requested artificial 20-second abort. Show friendly errors without stack traces or raw bodies; preserve safe terminal denial/configuration messages and never automatically retry blocked requests.
- If durable blocked-access storage or extra permissions become necessary, stop and report the blocker rather than add storage or migrations.
- One existing limitation: operators cannot access `/feedback` under the current route guard. Preserve that guard; the panel must explain the limitation rather than change permissions.

## Verification
- Add tests for routes, role isolation, spoofing, injection containment, limits, failures and false success claims; run full Vitest and report actual results.
- Project instructions prohibit manual builds/typechecks; report these as not run and inspect automatic preview build results.
- Check a real authenticated guidance request and desktop/mobile panel where available, without submitting feedback or changing account data.
- List every added/changed file and any unverified behaviour; keep the app unpublished.
