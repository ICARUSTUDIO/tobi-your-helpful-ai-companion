import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({ meta: [{ title: "Terms of Service — Tobi" }] }),
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="max-w-3xl mx-auto px-6 py-12">
        <div className="flex items-center gap-3 mb-8">
          <Link to="/" className="inline-flex rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            ← Back to Tobi
          </Link>
        </div>
        <h1 className="font-display text-4xl font-bold mb-8">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Last updated: May 25, 2026</p>

        <div className="space-y-8 text-sm leading-relaxed text-foreground/90">
          <section>
            <h2 className="font-display text-xl font-semibold mb-3 text-foreground">1. Acceptance of Terms</h2>
            <p>By accessing or using Tobi ("the Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use the Service. These terms apply to all visitors, users, and others who access or use the Service.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-3 text-foreground">2. Description of Service</h2>
            <p>Tobi is an interactive AI assistant designed to help with coding, research, debugging, location-based queries, and general conversational assistance. Tobi may use third-party APIs and services to fulfill requests. The Service is provided "as is" and may evolve over time.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-3 text-foreground">3. User Accounts</h2>
            <p>To access certain features, you may need to create an account. You are responsible for maintaining the confidentiality of your account credentials and for all activities that occur under your account. You agree to notify us immediately of any unauthorized use of your account.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-3 text-foreground">4. Acceptable Use</h2>
            <p>You agree not to use the Service to:</p>
            <ul className="list-disc ml-5 mt-2 space-y-1">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe on the intellectual property rights of others</li>
              <li>Transmit any harmful, threatening, abusive, or otherwise objectionable content</li>
              <li>Attempt to interfere with or disrupt the Service or its infrastructure</li>
              <li>Use the Service to generate or distribute malware or malicious code</li>
            </ul>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-3 text-foreground">5. AI-Generated Content</h2>
            <p>Tobi uses artificial intelligence to generate responses. While we strive for accuracy, AI-generated content may contain errors, hallucinations, or outdated information. You should verify important information independently. We do not guarantee the accuracy, completeness, or reliability of any AI-generated output.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-3 text-foreground">6. User Data &amp; Learning</h2>
            <p>Tobi may learn from conversational data to improve responses. You have the option to allow or deny this learning on a per-conversation basis. We limit the amount of data stored per user to prevent excessive storage use. See our <Link to="/privacy" className="underline text-tobi">Privacy Policy</Link> for details.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-3 text-foreground">7. Termination</h2>
            <p>We reserve the right to suspend or terminate your access to the Service at any time, with or without cause, and with or without notice. Upon termination, your right to use the Service will immediately cease.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-3 text-foreground">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Tobi and its operators shall not be liable for any indirect, incidental, special, consequential, or punitive damages arising out of or related to your use of the Service.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-3 text-foreground">9. Changes to Terms</h2>
            <p>We may update these Terms from time to time. We will notify you of significant changes by posting the new Terms on this page with an updated date. Your continued use of the Service after changes constitutes acceptance of the revised Terms.</p>
          </section>

          <section>
            <h2 className="font-display text-xl font-semibold mb-3 text-foreground">10. Contact</h2>
            <p>For questions about these Terms, please contact us at <a href="mailto:support@t-obi.xyz" className="underline text-tobi">support@t-obi.xyz</a>.</p>
          </section>
        </div>
      </div>
    </div>
  );
}
