# Operator Portal hardening

Most of what you asked for already exists in `/operator/*`:
prestart, defect, hours, photos, profile, operator-only sign-in,
admin "Preview as Operator" toggle, and per-company RLS. The gaps
are around the **QR-scan entry flow**, **multi-machine access**,
**audit trail**, and **hours validation messaging**.

## Scope

### 1. QR scan → operator-scoped machine page
- New public-on-the-URL, auth-gated route: `/m/$id`.
  - If signed out → redirect to `/auth?redirect=/m/$id`.
  - If signed in as **operator** → operator machine view (read-only
    info + action buttons that target *this* machine, not just the
    assigned one).
  - If signed in as **admin/manager/office_staff** → redirect to the
    existing `/assets/$id` admin view.
  - If signed in under a different company → "machine not found".
- Update `AssetQrButton` to encode `/m/<id>` instead of `/assets/<id>`.

### 2. Operator can act on any machine in their company (via QR)
- Today, `useOperatorAsset` resolves a single assigned machine.
  Add `useOperatorAssetById(assetId)` that loads any asset belonging
  to the operator's company.
- Extend `/operator/prestart`, `/operator/hours`, `/operator/defect`,
  `/operator/photos` to accept an optional `?asset=<id>` search param
  that overrides the assigned-machine lookup.
- RLS: today operators can only see/insert against their assigned
  asset. Migration to broaden operator INSERT on
  `prestart_checks`, `defect_reports`, `meter_readings`, `prestart_photos`,
  `defect_photos`, and SELECT on `assets`/`compliance_records`/`defect_reports`
  to any asset in the **same company** as the operator. (Still scoped
  by company — never cross-company.)

### 3. Audit trail (IP + device + timestamp)
- Add nullable `submitter_ip text`, `submitter_user_agent text` to
  `prestart_checks` and `defect_reports`.
- Pass `navigator.userAgent` from the client. Capture IP server-side
  by routing both submissions through a new `createServerFn`
  (`submitPrestart`, `submitDefect`) that reads `getRequestIP()` and
  writes via the authenticated supabase client.

### 4. Hours validation UX
- In `/operator/hours`: show "Hours since last service" derived from
  `last_service_*` columns + new value.
- Warn (non-blocking confirm) when new reading > previous + a
  reasonable daily delta (24h for engine hours, 1500km for odometer
  per day since last reading). Already blocks values lower than
  previous.

### 5. Defect notification (already exists, verify)
- `prestart_after_insert` trigger + `requires_attention` flag is in
  place. Confirm admin dashboard surfaces it (already does via the
  "Attention" tiles).

### 6. Out of scope (already implemented or no-op)
- Photo uploads, multi-photo, photo→defect linking — done.
- "Preview Operator View" admin button — done last batch.
- Role gating (no edit/delete/admin) — operators have no UI surface
  for those actions; RLS already denies writes.
- Mobile-first layout — done.
- QR token security — UUID `assetId` is already unguessable (v4),
  and the route requires sign-in + company match, so no extra token
  table is needed. Will note this in the report.

## Files

**New**
- `src/routes/m.$id.tsx` — QR landing dispatcher.
- `src/routes/_authenticated/operator.machine.$id.tsx` — operator
  machine detail page (mirrors `operator.index.tsx` for any machine).
- `src/lib/operator-submissions.functions.ts` — server fns for
  prestart + defect inserts that capture IP/UA.

**Edited**
- `src/lib/asset-qr.tsx` — QR URL → `/m/<id>`.
- `src/lib/operator-data.ts` — add `useOperatorAssetById`.
- `src/routes/_authenticated/operator.prestart.tsx`,
  `operator.hours.tsx`, `operator.defect.tsx`, `operator.photos.tsx`
  — accept `?asset=<id>` and use new server fns where applicable.
- `src/routes/_authenticated/operator.tsx` — also wrap `/m/*` would
  not work; banner stays on `/operator/*` only.

**Migrations**
- Add audit columns; broaden operator RLS to "any asset in same
  company" for the listed tables (SELECT + relevant INSERT).

## Acceptance

- Admin generates QR from an asset → scans on phone → signs in as
  operator → lands on operator view for *that* machine → completes
  prestart → row has `submitter_ip`, `submitter_user_agent`,
  `operator_id`, `performed_by`, `completed_at`.
- Admin scanning the same QR lands on the admin asset page.
- An operator from another company scanning the link gets "not
  found" (RLS-level).
- Hours screen shows "Since last service" and warns on jumps.
