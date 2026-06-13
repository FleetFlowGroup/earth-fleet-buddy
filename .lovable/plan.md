# FleetFlow V2 — Roles, Permissions & Operator Experience

This is a big change set. I'll deliver it in three phases so each piece is testable before the next lands. Reply "go" (or pick a phase) and I'll start.

---

## Phase A — Roles & Permissions Foundation

**Database**
- Extend the `app_role` enum: add `office_staff`, `workshop`, `operator` (keep existing `admin`/`manager`/`viewer` aliased to admin/office/operator for back-compat).
- Add `operators.user_id uuid` (nullable, links a real login to an operator record) so an operator user only sees *their* machine.
- Helper SQL functions: `current_role(company_id)`, `is_admin`, `is_office`, `is_workshop`, `is_operator` (all SECURITY DEFINER, search_path=public).
- Tighten RLS on `assets`, `asset_expenses`, `service_history`, `compliance_records`, `documents`, `operators`, `operator_licences` to use those helpers (operators only see rows tied to their assigned asset; workshop sees no `current_value`/financials via a view).

**Frontend permission layer**
- New `src/lib/permissions.ts` — single source of truth: `can(role, "assets.delete")`, `can(role, "billing.view")`, etc., plus a `nav(role)` returning the menu.
- `useCurrentUser()` already returns `role` — extend to return a `permissions` object.
- App shell sidebar filters by `nav(role)`.
- Route guards: each `_authenticated/*` route adds a `beforeLoad` check; unauthorized → redirect to `/dashboard` with toast. Direct-URL access blocked.
- Hide financial columns/widgets (current value, costs, billing) for `workshop` and `operator`.

---

## Phase B — Operator Experience

**New route group**: `src/routes/_authenticated/operator/` — large-button mobile-first UI.
- `/operator` dashboard: greeting, assigned machine card, current hours, 4 big action buttons (Start Prestart, Update Hours, Report Defect, Upload Photos), then expiring licence / outstanding defects / next service.
- `/operator/prestart/new` and `/operator/prestart/history`.
- `/operator/hours` — hour entry with optional meter-photo upload.
- `/operator/defects/new` — defect report with multi-photo.
- `/operator/licences` — read-only list of operator's own licences.
- `/operator/profile`.
- When a user with role=`operator` signs in, root redirect sends them to `/operator` instead of `/dashboard`.

**New tables**
- `prestart_checks` (asset_id, operator_id, completed_at, checklist jsonb, notes, signature_url, status pass/fail).
- `defect_reports` (asset_id, operator_id, severity, description, status open/in_progress/resolved, reported_at, resolved_at).
- `defect_photos` (defect_id, storage_path).
- `prestart_photos` (prestart_id, storage_path).
- All with full GRANT + RLS (operator can insert their own; office/admin/workshop can read all for their company).

---

## Phase C — Photo Upload Fixes (cross-cutting)

- Shared `src/lib/photo-upload.ts` helper: client-side compression (canvas → JPEG quality 0.8, max 1920px long edge) using `browser-image-compression` (or a small home-rolled compressor — no native deps, Worker-safe).
- Mobile camera capture: `<input type="file" accept="image/*" capture="environment">`.
- Multi-file selection works on iOS Safari + Android Chrome + desktop.
- Reusable `<PhotoUploader assetId? defectId? prestartId? serviceId?>` component used by:
  - Asset photo gallery (already exists — swap to shared uploader)
  - Service history entries (new "photos" relation)
  - Defect reports
  - Prestart checks
  - Hours-meter snapshot
- New `service_photos` table mirroring `asset_photos` shape.
- Signed-URL display already works for `asset-photos` bucket; reuse bucket with subfolders `defects/`, `prestarts/`, `services/`.

---

## Out of scope for now (called out for later)
- **Custom roles with toggle-per-permission UI** (Phase D). Foundation will support it because permissions are data-driven, but the admin UI to edit them is a separate build.
- Billing page (not built yet) — permission stub only.
- AI assistant & audit log pages — permission stubs only.

---

## Technical notes (for me, not the user)
- Operator → asset link uses existing `assets.assigned_operator_id`. We add `operators.user_id` so an auth user maps to an operator row, then policies join `auth.uid() = operators.user_id` and `assets.assigned_operator_id = operators.id`.
- Workshop financial hiding is enforced via a `assets_workshop` view + RLS denying SELECT on `current_value` column? Postgres doesn't do column RLS — so we'll project safe columns in a view and route workshop UI through it.
- Image compression library: prefer `browser-image-compression` (~10KB, no native deps, Worker-irrelevant since it runs in the browser).

---

Reply **"go"** to start Phase A, or name the phase you want first (e.g. "start with photo upload" → Phase C).