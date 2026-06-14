import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Notice — FleetFlow" },
      { name: "description", content: "FleetFlow Privacy Notice." },
    ],
  }),
  component: Privacy,
});

function Privacy() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 prose prose-invert">
      <p className="text-sm text-muted-foreground">
        <Link to="/" className="underline">← Back to FleetFlow</Link>
      </p>
      <h1>Privacy Notice</h1>
      <p><em>Last updated: 14 June 2026</em></p>

      <h2>1. Who we are</h2>
      <p>
        FleetFlow ("we", "us") is the data controller for personal data collected through the service.
        Contact: <a href="mailto:privacy@fleetflow.app">privacy@fleetflow.app</a>.
      </p>

      <h2>2. What we collect</h2>
      <ul>
        <li><strong>Account data</strong>: name, email, password hash, company name, role.</li>
        <li><strong>Fleet data</strong>: vehicle and machinery details, operators, compliance dates, documents and photos you upload.</li>
        <li><strong>Usage / telemetry</strong>: pages visited, actions taken, device type, IP address.</li>
        <li><strong>Support communications</strong>: messages you send us.</li>
      </ul>

      <h2>3. Why we collect it</h2>
      <ul>
        <li>To create and operate your account (contract performance).</li>
        <li>To provide compliance tracking and reminders (contract performance).</li>
        <li>To prevent fraud, abuse and secure the service (legitimate interest).</li>
        <li>To improve FleetFlow (legitimate interest).</li>
        <li>To provide customer support (contract performance).</li>
      </ul>

      <h2>4. Who we share it with</h2>
      <ul>
        <li><strong>Service providers / subprocessors</strong>: hosting, database, email delivery, analytics.</li>
        <li><strong>Merchant of Record</strong>: Paddle.com Market Limited handles payments, subscription management, tax compliance and invoicing on our behalf.</li>
        <li><strong>Professional advisers</strong> (legal, accounting) when needed.</li>
        <li><strong>Authorities</strong> where required by law.</li>
      </ul>

      <h2>5. Retention</h2>
      <p>
        We keep account and fleet data while your account is active and for a reasonable period afterwards for
        legal, accounting and dispute-resolution purposes. You can request deletion at any time.
      </p>

      <h2>6. International transfers</h2>
      <p>
        Some subprocessors are based outside Australia / the EEA / UK. Where required we use Standard
        Contractual Clauses or rely on adequacy decisions to safeguard transfers.
      </p>

      <h2>7. Your rights</h2>
      <p>
        Subject to applicable law, you have the right to access, correct, delete, restrict or port your
        personal data, to object to processing, and to withdraw consent. EU/UK residents may also lodge a
        complaint with their supervisory authority. Email{" "}
        <a href="mailto:privacy@fleetflow.app">privacy@fleetflow.app</a> to exercise these rights — we
        respond within one month.
      </p>

      <h2>8. Security</h2>
      <p>
        We use appropriate technical and organisational measures including TLS in transit, encryption at rest
        for backups, role-based access control and audit logging.
      </p>

      <h2>9. Cookies</h2>
      <p>
        FleetFlow uses essential cookies to keep you signed in. We do not currently use advertising cookies.
      </p>

      <h2>10. Changes</h2>
      <p>We may update this notice. The "last updated" date will change when we do.</p>
    </div>
  );
}
