import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/refund")({
  head: () => ({
    meta: [
      { title: "Refund Policy — FleetFlow" },
      { name: "description", content: "FleetFlow 30-day money-back refund policy." },
    ],
  }),
  component: Refund,
});

function Refund() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 prose prose-invert">
      <p className="text-sm text-muted-foreground">
        <Link to="/" className="underline">← Back to FleetFlow</Link>
      </p>
      <h1>Refund Policy</h1>
      <p><em>Last updated: 14 June 2026</em></p>

      <h2>30-day money-back guarantee</h2>
      <p>
        We offer a <strong>30-day money-back guarantee</strong> on FleetFlow subscriptions. If you are not
        satisfied with your purchase, you can request a full refund within 30 days of the order date.
      </p>

      <h2>How to request a refund</h2>
      <p>
        Refunds are processed by our payment provider, <strong>Paddle.com</strong>, which is the Merchant of
        Record for FleetFlow purchases. To request a refund:
      </p>
      <ol>
        <li>
          Visit <a href="https://paddle.net" target="_blank" rel="noreferrer">paddle.net</a> and find the
          transaction using the email used at checkout, or
        </li>
        <li>
          Email <a href="mailto:support@fleetflow.app">support@fleetflow.app</a> with your order number and
          we'll forward the request to Paddle.
        </li>
      </ol>

      <h2>Subscription renewals</h2>
      <p>
        After the initial 30-day window, subscription renewals are non-refundable as a default but you can
        cancel at any time to stop future renewals. Refunds may still be granted in exceptional circumstances
        at our discretion.
      </p>

      <h2>Cancellation</h2>
      <p>
        Cancel your subscription anytime from the Billing page in FleetFlow, or via the link in any Paddle
        receipt email. Your access continues until the end of the current billing period.
      </p>
    </div>
  );
}
