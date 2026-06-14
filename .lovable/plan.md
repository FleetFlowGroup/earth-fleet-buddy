## Goal
Build a seamless prestart system: operators pick today's machine (search or QR), complete a mobile-first prestart in <2min; admins get a full Prestarts management page with filters, export, defect resolution, and live stats. Reinforce strict per-company isolation and add an audit trail.

## What's already in place (no rework)
- `prestart_checks`, `defect_reports`, `prestart_photos`, `meter_readings`, `assets`, `operators`, `companies`, `user_roles` tables with company-scoped RLS.
- QR dispatcher at `/m/$id` → operator/admin routing.
- Operator prestart/hours/defect/photos pages with `?asset=` override.
- `record_operator_meter` SECURITY DEFINER RPC; signature capture; auto-defect on fail; `requires_attention` flag on assets.
- Platform-admin restricted enquiries page pattern.

## Changes

### 1. Database (one migration)
- New table `public.audit_log` (company_id, user_id, action, entity_type, entity_id, metadata jsonb, ip, user_agent, created_at). RLS: company members read own; service_role all; insert via SECURITY DEFINER fn `log_audit(...)`.
- Add `gps_lat`, `gps_lng`, `gps_accuracy` (numeric, nullable) to `prestart_checks`.
- Add `admin_notes` (text, nullable) to `prestart_checks`.
- Helper view `prestart_checks_enriched` (security_invoker) joining operator name, asset name/rego/fleet for fast list queries.
- Confirm/strengthen RLS: every public.* table that scopes by company_id has `is_company_member(auth.uid(), company_id)` SELECT and writes scoped to role.

### 2. Operator Portal redesign (mobile-first)
- `/operator` (index): if no `?asset=`, show **"Which machine are you operating today?"** screen:
  - Search input (debounced) over company assets by name / fleet_number / registration / asset id.
  - "Recently used" chips: last 5 distinct `asset_id`s from `prestart_checks` where `performed_by = me`.
  - Selecting a machine → `/operator?asset=<id>` (current flow).
- Selected-machine header card: photo (from asset_photos), make/model, current hours/km, service status badge, active defect badge, last prestart timestamp.
- Big primary buttons: **Daily prestart**, **Update hours**, **Report defect**, **Upload photos**, **Change machine**.
- Capture GPS on prestart submit (navigator.geolocation, best-effort, non-blocking) → stored on `prestart_checks`.

### 3. Admin Prestarts page — `/admin/prestarts`
- Sidebar nav item "Prestarts" visible to admin/manager/office_staff.
- Filters: search (operator/machine), date range, status (pass/fail/all), site (if applicable; using asset.location), defect-only toggle.
- Table columns: Operator · Machine · Rego · Date/time · Hours · Status · Notes · Photos · Signature · GPS.
- Row → detail drawer with full checklist breakdown, photos gallery, signature image, defect link, admin notes, "Mark defect resolved" button, "Print PDF" (window.print on detail), "Export CSV" for current filter, "Export Excel" via CSV with .xlsx? → ship CSV + simple xlsx via SheetJS-free approach: just CSV initially (Excel opens CSV).
- Stats cards (top): Prestarts today · Outstanding (operators w/o today's prestart) · Machines with active defects · Operators yet to complete today.

### 4. Audit logging
- Client helper `logAudit(action, entityType, entityId, metadata)` → calls SECURITY DEFINER RPC `log_audit`.
- Hooks: auth signin (root listener), QR scan (`/m/$id`), machine selection, prestart insert, hours update, photo upload, defect insert, admin resolve/notes actions.

### 5. Permissions / isolation hardening
- Audit existing operator-touched RLS to ensure no cross-company SELECT.
- Add `assets.location` to selectable view if missing (already exists likely).
- Operator role check in `/admin/prestarts` route guard → redirect non-admin/staff.

## Files

**Migration**
- `supabase/migrations/<ts>_prestarts_v2.sql`

**New**
- `src/routes/_authenticated/admin.prestarts.tsx`
- `src/routes/_authenticated/operator.select.tsx` (or render inline in operator.index)
- `src/lib/audit-log.ts`
- `src/lib/prestarts-admin.ts` (queries/exports)

**Edited**
- `src/routes/_authenticated/operator.index.tsx` (machine selection UI + recently used)
- `src/routes/_authenticated/operator.prestart.tsx` (GPS capture, audit log)
- `src/routes/_authenticated/operator.hours.tsx` / `operator.defect.tsx` / `operator.photos.tsx` (audit log)
- `src/components/app-shell.tsx` (Prestarts nav link for admin/manager/office_staff)
- `src/routes/m.$id.tsx` (audit log scan event)
- `src/routes/__root.tsx` (audit signin events)

## Out of scope (this round)
- Native XLSX export (CSV ships first; XLSX later if requested).
- Push notifications (defect alerts surface as in-app badge already wired).
- Site/project hierarchy beyond `assets.location` string.
- Operator profile editing.

Confirm and I'll implement.