import { describe, it } from "node:test";
import { deepStrictEqual, strictEqual, throws } from "node:assert";
import { memberCompanyId, prestartIdentity } from "./company-membership";

const userId = "ea8b07ef-ecfc-453c-8d5f-e978236d970e";
const companyId = "0c8e6d9b-9d86-4e21-9e54-efa298d99493";
const asset = { id: "36871961-a8e8-4519-85f2-129c1a060be5", company_id: companyId };
const operator = { id: "operator-daniel", user_id: userId, company_id: companyId };
describe("prestart company isolation", () => {
  it("sets the authenticated submitter and company for a linked member", () => {
    deepStrictEqual(prestartIdentity({ userId, companyId, asset, operator }), { performed_by: userId, company_id: companyId, asset_id: asset.id, operator_id: operator.id });
  });
  it("rejects another company's asset", () => {
    throws(() => prestartIdentity({ userId, companyId, asset: { ...asset, company_id: "other-company" }, operator }));
  });
  it("rejects another user's operator identity", () => {
    throws(() => prestartIdentity({ userId, companyId, asset, operator: { ...operator, user_id: "other-user" } }));
  });
  it("rejects an unlinked team member", () => {
    throws(() => prestartIdentity({ userId, companyId, asset, operator: null }));
  });
  it("uses a single verified membership instead of a stale profile company", () => {
    strictEqual(memberCompanyId("old-company", [{ company_id: companyId, role: "operator" }]), companyId);
  });
  it("does not invent company membership", () => {
    strictEqual(memberCompanyId(companyId, []), null);
  });
  it("preserves an authorised active company for multi-company users", () => {
    strictEqual(memberCompanyId(companyId, [{ company_id: companyId, role: "admin" }, { company_id: "other-company", role: "admin" }]), companyId);
  });
});