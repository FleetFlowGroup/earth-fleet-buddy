import { describe, expect, it } from "vitest";
import {
  IAP_SUBSCRIPTION_DISCLOSURE,
  NATIVE_ALREADY_SUBSCRIBED,
  NATIVE_MANAGE_ON_WEB,
  iosCopyIsStoreSafe,
  isFleetFlowIosUserAgent,
  landingFaqsForShell,
} from "./ios-store-copy";

const FAQS = [
  { question: "How does the $9.99 first month work?", answer: "Your first month is $9.99 AUD." },
  {
    question: "Can I cancel my subscription?",
    answer: "Cancel anytime from the Billing page. Plans are $49 AUD.",
  },
  { question: "Where is my data stored?", answer: "Your data is isolated to your company." },
];

describe("iOS store copy", () => {
  it("keeps subscription disclosure free of web prices and Paddle", () => {
    for (const text of [
      IAP_SUBSCRIPTION_DISCLOSURE,
      NATIVE_ALREADY_SUBSCRIBED,
      NATIVE_MANAGE_ON_WEB,
    ]) {
      expect(iosCopyIsStoreSafe(text)).toBe(true);
    }
    expect(IAP_SUBSCRIPTION_DISCLOSURE).toMatch(/Apple ID/);
    expect(NATIVE_ALREADY_SUBSCRIBED).toMatch(/already subscribed/i);
  });

  it("drops web prices from the marketing FAQ inside the iOS shell and keeps a data question", () => {
    const web = landingFaqsForShell(false, FAQS);
    expect(web).toHaveLength(3);
    const native = landingFaqsForShell(true, FAQS);
    expect(native.map((faq) => faq.question)).toEqual([
      "Can I cancel my subscription?",
      "Where is my data stored?",
    ]);
    expect(native.map((faq) => faq.answer).join(" ")).not.toMatch(/paddle|\$|AUD/i);
    expect(native[0].answer).toMatch(/Apple ID/);
  });

  it("recognises the Capacitor user agent token", () => {
    expect(isFleetFlowIosUserAgent("Mozilla FleetFlowiOS/1")).toBe(true);
    expect(isFleetFlowIosUserAgent("Mozilla/5.0")).toBe(false);
  });
});
