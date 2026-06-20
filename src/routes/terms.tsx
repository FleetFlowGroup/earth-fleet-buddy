import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms & Conditions — FleetFlow" },
      { name: "description", content: "FleetFlow terms and conditions of use. Read the rules governing your access to our fleet management platform." },
      { property: "og:title", content: "Terms & Conditions — FleetFlow" },
      { property: "og:description", content: "FleetFlow terms and conditions of use. Read the rules governing your access to our fleet management platform." },
      { property: "og:url", content: "https://fleetflow.group/terms" },
    ],
    links: [
      { rel: "canonical", href: "https://fleetflow.group/terms" },
    ],
  }),
  component: Terms,
});

function Terms() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 prose prose-invert">
      <p className="text-sm text-muted-foreground">
        <Link to="/" className="underline">← Back to FleetFlow</Link>
      </p>
      <h1>Terms &amp; Conditions</h1>
      <p><em>Last updated: 14 June 2026</em></p>

      <h2>1. Who we are</h2>
      <p>
        FleetFlow ("FleetFlow", "we", "us", "our") provides a fleet compliance management service for
        earthmoving and transport businesses. By creating an account or using the service you ("you", "User")
        agree to these Terms &amp; Conditions.
      </p>

      <h2>2. Acceptance</h2>
      <p>By continued use of FleetFlow you agree to these Terms. If you do not agree, do not use the service.</p>

      <h2>3. Your account</h2>
      <p>
        You must provide accurate information, keep your credentials confidential, and are responsible for all
        activity under your account. You must have authority to bind your business if signing up on its behalf.
      </p>

      <h2>4. Acceptable use</h2>
      <p>You must not:</p>
      <ul>
        <li>use the service unlawfully or for fraud, spam or harassment;</li>
        <li>infringe intellectual property rights;</li>
        <li>introduce malware, probe, scrape or otherwise interfere with the service's security or availability;</li>
        <li>resell, sublicense or redistribute the service without our written consent.</li>
      </ul>

      <h2>5. Intellectual property</h2>
      <p>
        We retain ownership of FleetFlow, its software, branding and documentation. You retain ownership of
        data and content you upload, and grant us a limited licence to host and process it solely to provide
        the service.
      </p>

      <h2>6. Service level</h2>
      <p>
        We work hard to keep FleetFlow available but do not guarantee uninterrupted or error-free operation.
        Scheduled maintenance and outages may occur.
      </p>

      <h2>7. Payment and subscriptions</h2>
      <p>
        Our order process is conducted by our online reseller Paddle.com. <strong>Paddle.com is the Merchant of
        Record for all our orders.</strong> Paddle provides all customer service inquiries and handles returns.
        For payment, billing, tax, cancellation and refund terms, see Paddle's{" "}
        <a href="https://www.paddle.com/legal/checkout-buyer-terms" target="_blank" rel="noreferrer">
          Buyer Terms
        </a>{" "}
        and our <Link to="/refund">Refund Policy</Link>.
      </p>

      <h2>8. Suspension and termination</h2>
      <p>
        We may suspend or terminate access for material breach of these Terms, non-payment, security or fraud
        risk, or repeated policy violations. On termination, you may export your data within 30 days.
      </p>

      <h2>9. Warranties and liability</h2>
      <p>
        To the fullest extent permitted by law, we disclaim implied warranties (merchantability, fitness for
        purpose). Our aggregate liability is capped at fees you paid in the 12 months preceding the claim. We
        exclude liability for indirect, consequential or special damages, except where liability cannot be
        excluded by law.
      </p>

      <h2>10. User indemnity</h2>
      <p>
        You indemnify FleetFlow against claims arising from your content, your unlawful use, or your breach of
        these Terms.
      </p>

      <h2>11. Governing law</h2>
      <p>These Terms are governed by the laws of the seller's jurisdiction. Disputes are subject to the exclusive jurisdiction of its courts.</p>

      <h2>12. Changes</h2>
      <p>We may update these Terms; the "last updated" date will change. Continued use means you accept the updated Terms.</p>

      <h2>13. Contact</h2>
      <p>Questions: <a href="mailto:support@fleetflow.app">support@fleetflow.app</a></p>
    </main>
  );
}