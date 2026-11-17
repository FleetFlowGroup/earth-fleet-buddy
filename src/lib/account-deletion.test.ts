import { describe, expect, it } from "vitest";
import {
  assertReauthEmail,
  decideAccountDeletion,
  deletionErrorMessage,
  parseDeletionPreview,
  type CompanyDeletionFacts,
} from "./account-deletion";

const company = (over: Partial<CompanyDeletionFacts> = {}): CompanyDeletionFacts => ({
  companyId: "11111111-1111-4111-8111-111111111111",
  name: "Summit Civil",
  isDemo: false,
  isAdmin: false,
  adminCount: 2,
  memberCount: 4,
  billing: "none",
  ...over,
});

describe("decideAccountDeletion", () => {
  it("lets a non-admin leave without deleting the company", () => {
    const decision = decideAccountDeletion({
      isPlatformAdmin: false,
      companies: [company()],
      mode: "leave",
      confirmation: "DELETE",
    });
    expect(decision.ok).toBe(true);
    expect(decision.deleteCompanyIds).toEqual([]);
  });

  it("refuses the sole admin leaving while other people remain", () => {
    const facts = company({ isAdmin: true, adminCount: 1, memberCount: 3, billing: "paddle" });
    const preview = decideAccountDeletion({
      isPlatformAdmin: false,
      companies: [facts],
      mode: null,
    });
    expect(preview.allowedModes).toEqual(["delete_companies"]);
    const refused = decideAccountDeletion({
      isPlatformAdmin: false,
      companies: [facts],
      mode: "leave",
      confirmation: "DELETE",
    });
    expect(refused.ok).toBe(false);
    expect(refused.code).toBe("sole_admin");
    const accepted = decideAccountDeletion({
      isPlatformAdmin: false,
      companies: [facts],
      mode: "delete_companies",
      confirmation: "DELETE",
      nativeShell: true,
    });
    expect(accepted.ok).toBe(true);
    expect(accepted.deleteCompanyIds).toEqual([facts.companyId]);
    expect(accepted.warnings.join(" ")).toMatch(/website/i);
    expect(accepted.warnings.join(" ")).not.toMatch(/paddle/i);
    const web = decideAccountDeletion({
      isPlatformAdmin: false,
      companies: [facts],
      mode: "delete_companies",
      confirmation: "DELETE",
    });
    expect(web.warnings.join(" ")).toMatch(/Paddle/);
  });

  it("tells an Apple subscriber to cancel in Apple settings and does not treat that as company deletion for a member", () => {
    const facts = company({ billing: "apple" });
    const decision = decideAccountDeletion({
      isPlatformAdmin: false,
      companies: [facts],
      mode: "leave",
      confirmation: "DELETE",
      nativeShell: true,
    });
    expect(decision.ok).toBe(true);
    expect(decision.warnings.join(" ")).toMatch(/Settings → Apple ID → Subscriptions/);
    expect(decision.deleteCompanyIds).toEqual([]);
  });

  it("requires DELETE, blocks the demo sole admin and platform owners", () => {
    const sole = company({ isAdmin: true, adminCount: 1, memberCount: 1 });
    expect(
      decideAccountDeletion({
        isPlatformAdmin: false,
        companies: [sole],
        mode: "delete_companies",
        confirmation: "delete",
      }).code,
    ).toBe("confirmation_required");
    expect(
      decideAccountDeletion({
        isPlatformAdmin: false,
        companies: [
          company({ isDemo: true, isAdmin: true, adminCount: 1, memberCount: 2, name: "Demo" }),
        ],
        mode: "delete_companies",
        confirmation: "DELETE",
      }).code,
    ).toBe("demo_company");
    expect(
      decideAccountDeletion({
        isPlatformAdmin: true,
        companies: [],
        mode: "leave",
        confirmation: "DELETE",
      }).code,
    ).toBe("platform_admin");
  });

  it("parses the preview payload and maps a missing database function", () => {
    const parsed = parseDeletionPreview({
      is_platform_admin: false,
      companies: [
        {
          company_id: "abc",
          name: "A",
          is_admin: true,
          admin_count: 1,
          member_count: 1,
          billing: "both",
          is_demo: false,
        },
      ],
    });
    expect(parsed.companies[0]).toMatchObject({ companyId: "abc", billing: "both", isAdmin: true });
    expect(
      deletionErrorMessage(new Error("Could not find the function public.delete_own_account")),
    ).toMatch(/isn't switched on yet/);
    expect(() => assertReauthEmail("a@fleetflow.group", "A@fleetflow.group")).not.toThrow();
    expect(() => assertReauthEmail("a@fleetflow.group", "other@fleetflow.group")).toThrow(
      /reauth_required/,
    );
  });
});
