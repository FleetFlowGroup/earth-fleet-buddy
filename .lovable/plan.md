# FleetFlow V2 Upgrade Plan

This is a large release. I'll ship it in 4 sequential phases so you can review after each one rather than waiting for everything at once. Tell me which phase to start with (or "all in order") and I'll begin.

---

## Phase 1 — Executive Dashboard & Action Centre

The biggest visible change. Rebuilds `/dashboard` as the landing experience.

- **Fleet Health Score** (big gauge at top, auto-calculated from overdue + expiring items, colour-coded 🟢🟠🔴)
- **Action Centre** — prioritised, clickable list of every item needing attention (your EX002 / EX001 / Float 3 / John Smith example), with one-click jump to the asset/operator
- **Quick Stats row** — 8 stat cards (Assets, Operators, Overdue, Expiring 30d, Documents, Services Due, Insurance Due, Rego Due)
- **Compliance Savings widget** — late fees avoided, services completed, renewals tracked (gives users the "why I pay" feeling)
- **Upcoming Costs widget** — 30/60/90 day projected spend
- **Charts** — fleet compliance %, monthly expenses, services completed, overdue trend, assets by type, upcoming renewals (Recharts)
- **Calendar view** — full month grid with colour-coded events (services, rego, insurance, licences, inspections); click an event → asset/operator page
- **Recent Activity feed** + **Quick Add Asset** button

## Phase 2 — Assets, Photos, Costs & Maintenance

- **Asset photo gallery** — multi-upload, thumbnails on list, lightbox viewer, type-based default icons when empty
- **Full asset detail fields** — VIN, serial, purchase date/price, current value, assigned operator, location, notes (schema additions)
- **Cost tracking module** — new `asset_expenses` table with categories (repairs, servicing, tyres, tracks, hydraulics, fuel, rego, insurance, roadworthy, inspection, other). Per-asset yearly totals + line chart over time + "this machine cost $X this year" headline
- **Maintenance scheduling** — recurring services by hours / km / days / months (extends the work already in place); auto-creates next due reminder
- **QR codes** — per-asset QR generated client-side, printable label view; scanning opens `/assets/{id}` directly

## Phase 3 — Operators, Team Roles, Documents & Search

- **Operator profile expansion** — photo, VOC expiry, medical expiry, emergency contact, training records, assigned assets list
- **Documents** — unlimited uploads per asset/operator with category tags + full-text search across filenames/notes
- **Team roles** — add `workshop`, `office`, `owner`, `read_only` to existing role enum; permission matrix enforced via RLS + UI guards
- **Global search** (⌘K) — instant find across assets, operators, rego, VIN, serial, documents, reports

## Phase 4 — Notifications, Reports & Mobile Polish

- **Notification centre** — in-app bell + per-user reminder preferences (90/60/30/14/7/3/1/today/overdue toggles, email + SMS + push channels). SMS/push are wired with provider stubs that activate when you add Twilio / web-push keys — I'll ask for them when we get there
- **Reports** — PDF + Excel export for fleet summary, service history, rego, insurance, operator licences, cost analysis, compliance audit, upcoming renewals, full asset register
- **Mobile optimisation pass** — sticky action bars, large touch targets, simplified nav on every page
- **Integration-ready architecture** — typed adapter layer + webhook endpoints stubbed for Xero / MYOB / QuickBooks / GPS / telematics / fuel cards (no live integrations yet — just the seams so they slot in later without a rewrite)

---

## Technical notes

- All new tables: RLS via existing `is_company_member` / `can_edit_company`, GRANTs to `authenticated` + `service_role`
- New tables: `asset_expenses`, `asset_photos`, `notification_preferences`, `notifications`, `activity_log`
- Schema additions to `assets`: `vin`, `serial_number`, `purchase_date`, `purchase_price`, `current_value`, `assigned_operator_id`, `location`, `notes`
- Schema additions to `operators`: `photo_path`, `voc_expiry`, `medical_expiry`, `emergency_contact_name`, `emergency_phone`
- New packages: `recharts` (charts), `qrcode` (QR), `jspdf` + `xlsx` (reports), `react-day-picker` already present for calendar
- Dark theme retained; design tokens already in `styles.css` extended for chart colours
- No breaking changes to existing data

## Out of scope for this release (call out if you want them sooner)

- Live GPS/telematics ingestion (architecture ready, no provider wired)
- Live accounting sync (Xero/MYOB/QuickBooks) — OAuth flows are non-trivial
- Native mobile apps (the web app will be fully mobile-optimised)
- Government rego database lookups (no public API in AU)

---

**How do you want to proceed?**
1. "Start Phase 1" — I build the dashboard + action centre first, you review, then I move on
2. "All in order" — I build all 4 phases back-to-back without stopping (long run, big diff)
3. Pick specific items only — tell me which bits matter most and I'll cherry-pick
