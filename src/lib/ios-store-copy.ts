/** Copy that is safe to show inside the iOS app for guideline 3.1.1. No web prices, no Paddle. */

export const IAP_SUBSCRIPTION_DISCLOSURE =
  "Payment is charged to your Apple ID at confirmation. The subscription renews automatically unless you cancel at least 24 hours before the end of the period. Your Apple ID is charged for renewal within 24 hours before the period ends. Manage or cancel anytime in Settings → Apple ID → Subscriptions. Deleting your FleetFlow account does not cancel the Apple subscription.";

export const NATIVE_ALREADY_SUBSCRIBED =
  "You're already subscribed. This subscription is managed on the web, so in-app purchase isn't available.";

export const NATIVE_MANAGE_ON_WEB =
  "Manage it from a web browser. The app can't start a second subscription.";

const PRICE_OR_PADDLE = /paddle|\$\s?\d|aud\/mo|9\.99/i;

export function iosCopyIsStoreSafe(text: string): boolean {
  return !PRICE_OR_PADDLE.test(text) && !/https?:\/\/(?!apps\.apple\.com)/i.test(text);
}

export function landingFaqsForShell<T extends { question: string; answer: string }>(
  native: boolean,
  faqs: T[],
): T[] {
  if (!native) return faqs;
  return faqs.flatMap((faq) => {
    if (/\$|9\.99|AUD/.test(`${faq.question} ${faq.answer}`)) {
      if (/cancel/i.test(faq.question)) {
        return [
          {
            ...faq,
            answer:
              "Subscriptions purchased in the iOS app renew until you cancel them in Settings → Apple ID → Subscriptions. Deleting your FleetFlow account does not cancel an Apple subscription.",
          },
        ];
      }
      return [];
    }
    return [faq];
  });
}

export const NATIVE_UA_TOKEN = "FleetFlowiOS/";

export function isFleetFlowIosUserAgent(ua: string | null | undefined): boolean {
  return !!ua && ua.includes(NATIVE_UA_TOKEN);
}
