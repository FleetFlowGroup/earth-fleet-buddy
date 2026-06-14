# Plan: Performance, Expiry Reminders, Operator Tickets

Three independent workstreams. I'll do them in this order so each can be tested as it lands.

---

## 1. Performance pass (marketing + app)

**What it fixes:** 2–3s blank screen on navigation.

- **Route-level code splitting.** Convert the heaviest routes (dashboard, assets, operators, reports, admin, billing, settings, marketing pages) to TanStack's `.lazy.tsx` pattern so each page ships as its own chunk instead of one big bundle.
- **Loading fallback.** Add a `defaultPendingComponent` to the router so every route transition shows a branded skeleton/spinner immediately — no more white screen.
- **Image optimisation.**
  - Audit `src/assets/` and convert large JPG/PNGs to compressed WebP (any >200KB).
  - Add `loading="lazy"` and explicit `width`/`height` to non-hero `<img>` tags.
  - Preload the hero image on `/` via `head().links` with `rel="preload" as="image" fetchpriority="high"`.
- **Preload critical assets.** Add `<link rel="preconnect">` for the Supabase domain in `__root.tsx` so the first auth/data request doesn't wait on a fresh TCP+TLS handshake.

**Out of scope:** rewriting components, switching state libraries, server-side rendering changes.

---

## 2. Expiry reminder emails (real send + test)

You already have:
- A cron endpoint (`/api/public/hooks/check-expiries`) that scans compliance records and operator licences at 90/60/30/14/7 days out and writes rows to `reminder_log` with `status='queued'`.
- A working email queue (`/lovable/email/transactional/send`, `process-email-queue` cron, templates registry).

**What I'll add:**

1. **Two new email templates** in `src/lib/email-templates/`:
   - `compliance-expiry-reminder.tsx` — "Your {asset} {label} expires in {days} days"
   - `licence-expiry-reminder.tsx` — "{Operator}'s {licence} expires in {days} days"
2. **Update `check-expiries`** to actually enqueue each reminder via the existing email queue (using the server-side `sendTransactionalServer` helper), then mark the `reminder_log` row `sent` (or `failed` on error). De-dupe so the same `(record, days_before, recipient)` only fires once.
3. **Keep your existing 90/60/30/14/7 thresholds** for both compliance and licences.
4. **Test run:** after wiring, I'll seed one compliance record with an expiry ~30 days from today owned by your account, then call the endpoint so a real reminder lands at **brodyfairbrother9@gmail.com**. (Reminders go to all company members — make sure that address is the email on your admin account, or tell me which company to target.)

---

## 3. Operator Tickets (new feature)

**Model you described:** admin uploads a ticket → admin assigns one or more operators to it → those operators (and any admin/manager in the company) can see it in their portal. No one else.

### Database

- New table `public.tickets`
  - `company_id`, `title`, `description`, `file_path` (Supabase Storage), `file_type`, `uploaded_by`, timestamps
- New table `public.ticket_assignments`
  - `ticket_id`, `operator_id`, `assigned_at`, `assigned_by` — unique `(ticket_id, operator_id)`
- RLS:
  - Admins/managers in the company can do everything.
  - Operators can `SELECT` only tickets where a row in `ticket_assignments` links them to that ticket.
  - Storage: tickets go in a new private `operator-tickets` bucket under `{company_id}/{ticket_id}/…` with policies matching the same access rules.

### UI

- **Admin side** — new page `/_authenticated/tickets` (and a "Tickets" tab on each operator detail page):
  - List of all company tickets with thumbnail + filename.
  - "Upload ticket" dialog → title, optional description, file picker (image or PDF), multi-select operator assignment.
  - Edit/delete + manage assignments on an existing ticket.
- **Operator side** — new screen `/_authenticated/operator/documents` (linked from the operator portal home alongside Tickets & Licences):
  - Lists tickets assigned to this operator with a "View/Download" button (signed Storage URL).
  - "My tickets & licences" page stays as-is for HR/HC/excavator tickets; the new screen is for admin-uploaded documents.

> **Naming note:** your existing `/operator/tickets` page already shows licences (HR, excavator, etc.). To avoid confusion, I'll call the new admin-uploaded files **"Documents"** in the operator portal and **"Tickets"** in the admin panel — matches your wording while keeping the two distinct. Tell me if you'd rather rename either side.

---

## Technical details (for reference)

- Code splitting uses TanStack's `createLazyFileRoute` so loaders stay in the critical bundle but components/error boundaries lazy-load.
- Reminder dedup keyed on `(compliance_id|operator_licence_id, days_before, recipient_email)` — a unique partial index will be added.
- Tickets RLS uses an `EXISTS` subquery against `ticket_assignments` joined to `operators.user_id = auth.uid()` — no recursion risk.
- Storage RLS mirrors the row policies using `storage.foldername(name)[1] = company_id::text` plus an EXISTS check.

## Order of work

1. Migration + storage bucket for Tickets.
2. Performance pass (no DB dependency — safe to ship first).
3. Email templates + wire up reminders + test send.
4. Tickets UI (admin + operator).

Reply "go" (or with any tweaks) and I'll start.
