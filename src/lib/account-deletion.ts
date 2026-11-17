/**
 * Account-deletion rules for Apple guideline 5.1.1(v).
 * The unapplied SQL function public.delete_own_account implements the same
 * decisions and is the authority at runtime. This module drives the UI copy
 * and the unit tests. It never deletes data by itself.
 *
 * Sole Company Admin means the only user with role admin or super_admin.
 * Leaving would orphan that company, so the account can be deleted only
 * together with the company, and only after an explicit choice. The shared
 * demo company (ABN DEMO-SUMMIT) and platform-owner accounts are refused.
 * Neither Apple nor Paddle billing is cancelled here.
 */

export type AccountBilling = "paddle" | "apple" | "both" | "none";
export type AccountDeletionMode = "leave" | "delete_companies";

export interface CompanyDeletionFacts {
  companyId: string;
  name: string;
  isDemo: boolean;
  isAdmin: boolean;
  adminCount: number;
  memberCount: number;
  billing: AccountBilling;
}

export interface AccountDeletionInput {
  isPlatformAdmin: boolean;
  companies: CompanyDeletionFacts[];
  /** null = preview only (no confirmation yet). */
  mode: AccountDeletionMode | null;
  confirmation?: string;
  /** When true, billing copy must not name Paddle or link to a web checkout. */
  nativeShell?: boolean;
}

export interface AccountDeletionDecision {
  ok: boolean;
  code:
    | "ok"
    | "platform_admin"
    | "demo_company"
    | "sole_admin"
    | "confirmation_required"
    | "invalid_mode";
  message: string;
  allowedModes: AccountDeletionMode[];
  /** Companies removed only when mode is delete_companies and ok. */
  deleteCompanyIds: string[];
  warnings: string[];
}

const ADMIN_ROLES_NOTE = "admin or super_admin";

export function isSoleCompanyAdmin(company: CompanyDeletionFacts): boolean {
  return company.isAdmin && company.adminCount <= 1;
}

export function companiesRequiringDeletion(
  companies: CompanyDeletionFacts[],
): CompanyDeletionFacts[] {
  return companies.filter((company) => isSoleCompanyAdmin(company) && !company.isDemo);
}

export function decideAccountDeletion(input: AccountDeletionInput): AccountDeletionDecision {
  const native = !!input.nativeShell;
  const sole = companiesRequiringDeletion(input.companies);
  const demoBlocked = input.companies.some(
    (company) => company.isDemo && isSoleCompanyAdmin(company),
  );
  const allowedModes: AccountDeletionMode[] =
    demoBlocked || input.isPlatformAdmin ? [] : sole.length > 0 ? ["delete_companies"] : ["leave"];
  const warnings = billingWarnings(input.companies, sole, native);

  if (input.isPlatformAdmin) {
    return {
      ok: false,
      code: "platform_admin",
      message:
        "This platform owner account can't be deleted in the app. Ask another owner to remove access first.",
      allowedModes,
      deleteCompanyIds: [],
      warnings,
    };
  }
  if (demoBlocked) {
    return {
      ok: false,
      code: "demo_company",
      message:
        "The shared demo workspace can't be deleted, and you are its only Company Admin. Use a normal company account to delete your login.",
      allowedModes,
      deleteCompanyIds: [],
      warnings,
    };
  }
  if (input.mode == null) {
    return {
      ok: false,
      code: allowedModes.length ? "confirmation_required" : "invalid_mode",
      message: previewMessage(input.companies, sole),
      allowedModes,
      deleteCompanyIds: [],
      warnings,
    };
  }
  if (input.confirmation !== "DELETE") {
    return {
      ok: false,
      code: "confirmation_required",
      message: "Type DELETE to confirm. Nothing has been removed.",
      allowedModes,
      deleteCompanyIds: [],
      warnings,
    };
  }
  if (!allowedModes.includes(input.mode)) {
    return {
      ok: false,
      code: sole.length > 0 && input.mode === "leave" ? "sole_admin" : "invalid_mode",
      message:
        sole.length > 0
          ? soleAdminMessage(sole)
          : "That deletion choice doesn't apply to this account. Nothing has been removed.",
      allowedModes,
      deleteCompanyIds: [],
      warnings,
    };
  }
  return {
    ok: true,
    code: "ok",
    message:
      input.mode === "delete_companies"
        ? "Your login will be deleted and the companies listed below will be removed for every member."
        : "Your login will be deleted. Company records stay with the company.",
    allowedModes,
    deleteCompanyIds:
      input.mode === "delete_companies" ? sole.map((company) => company.companyId) : [],
    warnings,
  };
}

function previewMessage(companies: CompanyDeletionFacts[], sole: CompanyDeletionFacts[]): string {
  if (companies.length === 0)
    return "This deletes your FleetFlow login and profile. You can sign up again later with the same email.";
  if (sole.length === 0)
    return "This deletes your login and removes you from your company. Other people, machines and records stay.";
  return soleAdminMessage(sole);
}

function soleAdminMessage(sole: CompanyDeletionFacts[]): string {
  const names = sole.map((company) => company.name || "your company").join(", ");
  const withOthers = sole.filter((company) => company.memberCount > 1);
  if (withOthers.length > 0) {
    return `You are the only Company Admin (${ADMIN_ROLES_NOTE}) of ${names}. Other people still belong there. Promote another admin from Team, or delete the company and its data together with your account. Leaving on your own is not available.`;
  }
  return `You are the only person in ${names}. Deleting your account also deletes that company and its fleet data.`;
}

export function billingWarnings(
  companies: CompanyDeletionFacts[],
  deletedCompanies: CompanyDeletionFacts[],
  native: boolean,
): string[] {
  const warnings: string[] = [];
  const deleted = new Set(deletedCompanies.map((company) => company.companyId));
  const affected = companies.filter((company) => company.billing !== "none");
  for (const company of affected) {
    const closing = deleted.has(company.companyId);
    if (company.billing === "apple" || company.billing === "both") {
      warnings.push(
        closing
          ? `${company.name}: cancel the Apple subscription in Settings → Apple ID → Subscriptions. Deleting the FleetFlow account does not cancel it, and Apple can keep billing until you cancel.`
          : `${company.name}: the Apple subscription stays with the company. Deleting your login does not cancel it. If it is billed to your Apple ID, cancel it in Settings → Apple ID → Subscriptions.`,
      );
    }
    if (company.billing === "paddle" || company.billing === "both") {
      warnings.push(
        closing
          ? native
            ? `${company.name}: a subscription billed on the FleetFlow website is not cancelled by deleting the company. Cancel that subscription in a web browser before you continue, or it can keep renewing.`
            : `${company.name}: the Paddle subscription is not cancelled by deleting the company. Cancel it from Billing on the website first, or it can keep renewing.`
          : `${company.name}: the company subscription stays in place and is not cancelled.`,
      );
    }
  }
  return warnings;
}

export function assertReauthEmail(claimEmail: unknown, typed: string): void {
  const claim = typeof claimEmail === "string" ? claimEmail.trim().toLowerCase() : "";
  const given = typed.trim().toLowerCase();
  if (!claim || claim !== given) throw new Error("reauth_required");
}

export function deletionErrorMessage(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  if (/platform_admin/.test(raw)) return "This platform owner account can't be deleted in the app.";
  if (/demo_company/.test(raw)) return "The shared demo workspace can't be deleted.";
  if (/sole_admin/.test(raw))
    return "You are the only Company Admin. Promote another admin, or confirm company deletion.";
  if (/confirmation_required/.test(raw)) return "Type DELETE to confirm.";
  if (/reauth_required/.test(raw)) return "Enter the email on this account to confirm it's you.";
  if (
    /delete_own_account|preview_own_account_deletion|PGRST202|schema cache|Could not find the function/i.test(
      raw,
    )
  ) {
    return "Account deletion isn't switched on yet. The database update still needs to be approved. Nothing was deleted.";
  }
  return raw || "Could not delete the account. Nothing was deleted.";
}

interface PreviewCompany {
  company_id?: string;
  name?: string;
  is_demo?: boolean;
  is_admin?: boolean;
  admin_count?: number;
  member_count?: number;
  billing?: string;
}

export function parseDeletionPreview(raw: unknown): {
  isPlatformAdmin: boolean;
  companies: CompanyDeletionFacts[];
} {
  const body = (raw ?? {}) as { is_platform_admin?: boolean; companies?: PreviewCompany[] };
  const companies = Array.isArray(body.companies) ? body.companies : [];
  return {
    isPlatformAdmin: !!body.is_platform_admin,
    companies: companies
      .filter((company) => typeof company.company_id === "string")
      .map((company) => ({
        companyId: company.company_id as string,
        name: company.name || "Company",
        isDemo: !!company.is_demo,
        isAdmin: !!company.is_admin,
        adminCount: Number(company.admin_count ?? 0),
        memberCount: Number(company.member_count ?? 0),
        billing: normalizeBilling(company.billing),
      })),
  };
}

function normalizeBilling(value: string | undefined): AccountBilling {
  if (value === "paddle" || value === "apple" || value === "both") return value;
  return "none";
}
