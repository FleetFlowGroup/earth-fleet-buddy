# FleetFlow Assistant — preview only

## Architecture
`assistant.functions.ts` is an authenticated POST RPC; the existing bearer middleware is retained. The handler checks the request hostname (localhost/editor preview only), reads the caller's profile, verified memberships, existing `current_role` and company name through `context.supabase`, then retrieves up to six static articles. Company names are read to validate the accessible company but not forwarded to AI. No billing helper is used. `kb.ts` contains 44 code-grounded articles with source references. Retrieval is the only capability: no tools, SQL, writes, uploads, emails or action APIs.

The gateway request is server-only, uses catalog-verified `google/gemini-3.8-flash` at Chat Completions, temperature 0.2, max_tokens 700, documented Gemini thinking level `reasoning.effort: minimal`, and upstream SSE streaming consumed to the final response. Truncated output is treated as a failure rather than complete guidance. Requests carry a gateway-issued run ID via the shared server-only helper. No package additions. No artificial 20-second abort, because gateway rules prohibit timer-based cancellation. No automatic retries. Errors expose only friendly text or the gateway's documented safe denial/credit-remedy message, never raw bodies/stacks.

## Security and limitations
Client schemas strip role/companyId/system fields, require user/assistant roles and cap last-six messages at 2,000 chars each and 8,000 total. The current role comes from the existing database helper, checked against verified memberships; stale profiles cannot choose another company. Operators and users with no membership never retrieve admin/office articles. No records from other companies are fetched. The fixed system prompt treats articles/history as untrusted data; this reduces injection risk but does not prove model obedience. Replies are plain text; URL-shaped text is removed and navigation is independently whitelisted and restricted to retrieved article routes. A conservative post-filter replaces unsupported account-action/success claims.

The rate limiter is **in-memory, per-instance**, resets on cold start and is **NOT production-grade**. Limits: 10/minute/user (fixed first-request window), 100/UTC day/user, 500/UTC day/company. It requires persistent storage before production. No persistent blocked-access state can be implemented under this phase's no-storage rule: if a provider denial or credit/policy block is encountered, stop verification and report that durable pause handling requires separately approved storage; do not publish this phase. No background or automated requests exist.

History is browser-only **component state**, last six messages (three complete turns), never localStorage/sessionStorage or database. It resets on reload, sign-out, company/role change and Clear conversation. The only browser navigation is to server-authorised internal paths. Contact support prefills the existing feedback form; the user must submit it. Operators cannot reach feedback under the existing guard, so they are directed to their company admin instead. Existing guards and submit logic remain unchanged.

## Verification
Tests cover input stripping, mock RLS context, membership isolation, limits, retrieval, injection-shaped inputs, route sanitisation, SSE fragmentation and gateway errors, plus success claims. Full Vitest is run. Manual typechecks/builds are prohibited by project instructions; automatic preview compilation is checked separately. Live model verification is performed only without customer writes/messages and stops at terminal gateway blockers.

## Approved fixes: service-rule exceptions
The requested 20–25 second timer is NOT added. Exact rule from `knowledge://skill/ai-apps-gateway-no-artificial-timeouts/SKILL.md`:
> Never wrap a Gateway fetch in `AbortSignal.timeout(...)`, an `AbortController` armed by `setTimeout`, a `Promise.race` deadline, or an HTTP-client timeout option. If a deadline is truly unavoidable, set it to a large multiple of the worst case — minutes, not seconds.

Safe alternative (proposal only): keep the existing upstream streaming and waiting indicator; add browser-visible streaming and an explicit Stop action with cancellation propagated upstream in a separately approved scope. Do not automatically retry slow requests. Real upstream 408/504 or TimeoutError failures receive the fixed timeout reply without introducing a timer.

Complete denial/credit masking is also NOT implemented: `knowledge://ai-gateway-error-semantics` requires:
> Show the response's safe error message in the UI, never a generic assistant reply.
> Preserve upstream `403` and its safe denial reason before streaming.
> `402` — insufficient AI credits. Show the response's `message`, which names the remedy, including temporary holds when applicable.

Accordingly the mandatory safe 402/403 reason and existing 403 status remain. Refusals, busy, timeout, empty and unexpected errors otherwise use fixed replies and a closed code union; arbitrary upstream bodies and all other error messages are discarded. Logs contain only status, code and latency. Provider-denial/credit live verification still stops immediately; durable pause state is not possible within the no-storage scope.

Feedback prefill uses a pure Zod helper: subject 150 characters, message 2,000 characters, only the existing four categories. Unknown values are ignored and text is truncated. Lazy useState initialisers apply these values only on initial mount; query changes do not overwrite drafts and no prefill code can submit a message. The existing submission block remains byte-identical.

## Release controls (server-enforced)
- `ASSISTANT_ENABLED` (server env): default OFF. Only the exact value `true` enables it on non-preview hosts. **Kill switch:** unset it or set it to `false`; `askFleetFlow` then returns "not available" before any DB or model call, and `getAssistantStatus` hides the UI.
- `ASSISTANT_COMPANY_ALLOWLIST` (optional): comma-separated company UUIDs. If it's non-empty, only those companies are allowed (staged rollout). Users without a company are refused.
- Preview hosts (`id-preview--*.lovable.app`, localhost) are always allowed.
- The UI asks `getAssistantStatus`; hiding it is cosmetic. `askFleetFlow` re-checks the flag and the allowlist after deriving identity on the server.

## Rate limits
1. The in-memory limiter runs first (per instance).
2. The durable limit is the RPC `assistant_consume(_company_id)` (migration 0007, SECURITY DEFINER). It's called with the caller's RLS client before the model. The user comes from `auth.uid()` and membership is verified. Limits: 10/min and 100/day per user, 500/day per company (UTC day), counted atomically under advisory locks. The `assistant_usage` table has RLS on and no client policies or grants.
3. **Fails closed:** any RPC error or a false result returns the friendly busy/limit message, and the model isn't called. The only exception is on a preview host: if the function doesn't exist yet (PGRST202), it falls back to the in-memory limiter so preview works before 0007 is applied. Production never falls back, so **apply 0007 before setting ASSISTANT_ENABLED=true**.
