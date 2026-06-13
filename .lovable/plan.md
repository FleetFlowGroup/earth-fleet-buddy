# FleetFlow Update Plan

A large but cohesive update. I'll ship it as one release across DB, backend, and UI.

## 1. New "Operators" module (replaces Operator Licences on assets)

**Database (new migration)**
- `operators` table: full_name, employee_id, phone, email, position, depot, status (`active`/`inactive`), company_id, timestamps. Company-scoped RLS using existing `is_company_member` / `can_edit_company`.
- `operator_licences` table: operator_id, licence_type (enum + `custom`), custom_name, licence_number, issue_date, expiry_date, certificate_path (storage), notes, company_id, timestamps.
- Reuse existing `documents` bucket `compliance-docs` for certificate uploads (new folder `operators/{id}/...`).
- Remove `operator_licence` from the compliance type list shown on assets (keep enum value for back-compat but hide it from the asset UI).

**UI**
- New nav item **Operators** → `/_authenticated/operators`
  - List with search + filters: Expiring Soon / Expired / Active / Missing Certificate.
  - Per-operator detail page: profile fields + licences table with Add/Edit/Delete and certificate upload.
- Remove the operator-licence option from the asset compliance dialog.

## 2. Service tracking upgrades

**Asset detail page**
- New prominent **Service Management** card replacing the current compact summary. Shows last service date, last km, last hours, next due date/km/hours, current km/hours, and a coloured status badge:
  - 🟢 Up to date, 🟠 Due soon (≤500 km or ≤50 h, or ≤14 days for time-based), 🔴 Overdue.
- Adds optional `service_interval_days` to assets for time-based intervals (next-service date).
- Big **Complete Service** button → modal: date, current km, current hours, workshop, technician, cost, notes, parts replaced, invoice upload, photo uploads.
  - Inserts a new `service_history` row (history preserved — never overwritten).
  - Updates asset `last_service_date`, `last_service_odometer`, `last_service_hours` only.
  - Next service is *derived* from interval + last service (no overwrite of history).
- Big **Update Hours / KMs** button → quick modal (single field based on meter mode) that writes a `meter_readings` row and updates the asset's current meter, then recomputes status live.

## 3. Dashboard upgrades

- New top banner **Attention Required Today**, listing overdue services, services due soon, expiring registrations, insurance, and operator licences. Each row links to its asset/operator.
- New **Services Due** widget grouped into: Overdue, Due Today, Due This Week, Due This Month. Rows link straight to the asset.
- Existing upcoming-expiries list stays below.

## 4. Reminders

- Extend the existing `/api/public/hooks/check-expiries` cron route to also scan `operator_licences` at 90/60/30/14/7-day thresholds and on expiry, writing into `reminder_log` and sending via the existing email queue.

## Technical notes
- All new tables: `GRANT` to `authenticated` + `service_role`, RLS via existing `is_company_member` / `can_edit_company` helpers.
- Storage: reuse `compliance-docs` bucket; add per-operator path prefix.
- No breaking changes to assets schema beyond adding `service_interval_days` (nullable).
- No new packages required.

## Out of scope (call out if you want them next)
- Operator → asset assignment / "who's driving what today".
- SMS reminders (email only, via existing queue).
- Bulk CSV import of operators or licences.
