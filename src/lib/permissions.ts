// Centralised role-based permission map for FleetFlow.
// Roles map to a fixed permission set today; a future "custom roles" feature
// will swap this static table for a DB-driven matrix without touching callers.

export type Role =
  | "super_admin"
  | "admin"
  | "manager"
  | "supervisor"
  | "office_staff"
  | "workshop"
  | "mechanic"
  | "viewer"
  | "operator"
  | null
  | undefined;


export type Permission =
  | "dashboard.view"
  | "assets.view"
  | "assets.edit"
  | "assets.delete"
  | "assets.value.view"
  | "operators.view"
  | "operators.edit"
  | "services.view"
  | "services.edit"
  | "defects.view"
  | "defects.edit"
  | "compliance.view"
  | "compliance.edit"
  | "documents.view"
  | "documents.edit"
  | "tickets.manage"
  | "reports.view"
  | "team.view"
  | "team.manage"
  | "settings.view"
  | "settings.edit"
  | "billing.view"
  | "billing.manage"
  | "audit.view"
  | "operator.portal";

const PERMS: Record<Exclude<Role, null | undefined>, Permission[]> = {
  super_admin: [
    "dashboard.view", "assets.view", "assets.edit", "assets.delete", "assets.value.view",
    "operators.view", "operators.edit", "services.view", "services.edit",
    "defects.view", "defects.edit", "compliance.view", "compliance.edit",
    "documents.view", "documents.edit", "reports.view",
    "team.view", "team.manage", "settings.view", "settings.edit",
    "billing.view", "billing.manage", "audit.view",
  ],
  admin: [
    "dashboard.view", "assets.view", "assets.edit", "assets.delete", "assets.value.view",
    "operators.view", "operators.edit", "services.view", "services.edit",
    "defects.view", "defects.edit", "compliance.view", "compliance.edit",
    "documents.view", "documents.edit", "reports.view",
    "team.view", "team.manage", "settings.view", "settings.edit",
    "billing.view", "billing.manage", "audit.view",
  ],
  manager: [
    "dashboard.view", "assets.view", "assets.edit", "assets.value.view",
    "operators.view", "operators.edit", "services.view", "services.edit",
    "defects.view", "defects.edit", "compliance.view", "compliance.edit",
    "documents.view", "documents.edit", "reports.view",
    "team.view", "team.manage", "settings.view",
  ],
  supervisor: [
    "dashboard.view", "assets.view", "assets.edit",
    "operators.view", "operators.edit", "services.view", "services.edit",
    "defects.view", "defects.edit", "compliance.view",
    "documents.view", "reports.view", "team.view",
  ],
  office_staff: [
    "dashboard.view", "assets.view", "assets.edit",
    "operators.view", "operators.edit", "services.view", "services.edit",
    "defects.view", "defects.edit", "compliance.view", "compliance.edit",
    "documents.view", "documents.edit", "reports.view",
  ],
  workshop: [
    "assets.view", "services.view", "services.edit",
    "defects.view", "defects.edit", "documents.view",
  ],
  mechanic: [
    "assets.view", "services.view", "services.edit",
    "defects.view", "defects.edit", "documents.view",
  ],
  viewer: [
    "dashboard.view", "assets.view", "operators.view", "services.view",
    "defects.view", "compliance.view", "documents.view", "reports.view",
  ],
  operator: ["operator.portal"],
};


export function can(role: Role, perm: Permission): boolean {
  if (!role) return false;
  return PERMS[role]?.includes(perm) ?? false;
}

export function canAny(role: Role, perms: Permission[]): boolean {
  return perms.some((p) => can(role, p));
}

export type NavItem = {
  to: string;
  label: string;
  perm: Permission;
};

export const NAV_ITEMS: NavItem[] = [
  { to: "/dashboard", label: "Dashboard", perm: "dashboard.view" },
  { to: "/assets", label: "Assets", perm: "assets.view" },
  { to: "/operators", label: "Operators", perm: "operators.view" },
  { to: "/admin/prestarts", label: "Prestarts", perm: "defects.view" },
  { to: "/reports", label: "Reports", perm: "reports.view" },
  { to: "/team", label: "Team", perm: "team.view" },
  { to: "/billing", label: "Billing", perm: "billing.view" },
  { to: "/settings", label: "Settings", perm: "settings.view" },
];

export function navFor(role: Role): NavItem[] {
  if (role === "operator") return [];
  return NAV_ITEMS.filter((n) => can(role, n.perm));
}

export function homeFor(role: Role): string {
  if (role === "operator") return "/operator";
  if (role === "workshop") return "/assets";
  return "/dashboard";
}

export const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  admin: "Company Admin",
  manager: "Manager",
  supervisor: "Supervisor",
  office_staff: "Office Staff",
  workshop: "Workshop",
  mechanic: "Mechanic",
  viewer: "Viewer",
  operator: "Operator",
};

