/**
 * Apple In-App Purchase for the iOS app (Capacitor) via RevenueCat. Web never loads this SDK
 * (dynamic import inside isNativeApp() branches) and keeps Paddle checkout.
 * Identity: RevenueCat app user id == company id, so the subscription belongs to the company and
 * the RevenueCat webhook (src/routes/api/public/payments/revenuecat-webhook.ts) maps it back.
 * Only company admins reach these calls (billing page is admin-only).
 */
import { isNativeApp, nativePlatform } from "./native";
import { PLAN_ORDER } from "@/hooks/use-subscription";

export const APPLE_MANAGE_SUBSCRIPTIONS_URL = "https://apps.apple.com/account/subscriptions";

export function appleProductIdForPlan(planId: string): string | null {
  const m = /^(starter|growth|pro|business)_plan$/.exec(planId);
  return m ? `group.fleetflow.app.${m[1]}.monthly` : null;
}

export function iapAvailable(): boolean {
  return isNativeApp() && nativePlatform() === "ios" && !!import.meta.env.VITE_REVENUECAT_IOS_KEY;
}

async function rc() {
  const mod = await import("@revenuecat/purchases-capacitor");
  return mod.Purchases;
}

let configuredFor: string | null = null;

/** Configure (once) and log in as the company. */
export async function ensureIapCompany(companyId: string): Promise<void> {
  if (!iapAvailable()) throw new Error("In-app purchases are not available");
  const Purchases = await rc();
  const { isConfigured } = await Purchases.isConfigured();
  if (!isConfigured) {
    await Purchases.configure({ apiKey: import.meta.env.VITE_REVENUECAT_IOS_KEY as string, appUserID: companyId });
  } else if (configuredFor !== companyId) {
    await Purchases.logIn({ appUserID: companyId });
  }
  configuredFor = companyId;
}

export interface IapProduct {
  planId: string;
  storeProductId: string;
  priceString: string;
}

export async function loadIapProducts(companyId: string): Promise<IapProduct[]> {
  await ensureIapCompany(companyId);
  const Purchases = await rc();
  const ids = PLAN_ORDER.map(appleProductIdForPlan).filter((x): x is string => !!x);
  const { products } = await Purchases.getProducts({ productIdentifiers: ids });
  return PLAN_ORDER.flatMap((planId) => {
    const p = products.find((x) => x.identifier === appleProductIdForPlan(planId));
    return p ? [{ planId, storeProductId: p.identifier, priceString: p.priceString }] : [];
  });
}

/** Returns false if the user cancelled the Apple sheet. Entitlement arrives via webhook. */
export async function purchaseIapPlan(companyId: string, planId: string): Promise<boolean> {
  await ensureIapCompany(companyId);
  const Purchases = await rc();
  const id = appleProductIdForPlan(planId);
  const { products } = await Purchases.getProducts({ productIdentifiers: id ? [id] : [] });
  if (!products[0]) throw new Error("This plan is not available in the App Store yet");
  try {
    await Purchases.purchaseStoreProduct({ product: products[0] });
    return true;
  } catch (e) {
    if ((e as { userCancelled?: boolean })?.userCancelled) return false;
    throw e;
  }
}

export async function restoreIapPurchases(companyId: string): Promise<void> {
  await ensureIapCompany(companyId);
  const Purchases = await rc();
  await Purchases.restorePurchases();
}
