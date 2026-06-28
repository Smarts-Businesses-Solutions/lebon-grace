import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — Lebon Grace",
  description: "Privacy policy for Lebon Grace. How we handle your data.",
};

export default function PrivacyPage() {
  return (
    <>
      <section className="bg-offwhite border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <h1 className="font-heading text-3xl lg:text-4xl font-semibold tracking-tight">Privacy Policy</h1>
          <p className="mt-3 text-warm-gray text-sm tracking-wide">Last updated: January 2026</p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-8">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">1. Information We Collect</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            We collect information you provide directly to us, including your name, email address, phone number, shipping address, and payment information. We also collect certain information automatically when you visit our website, such as your IP address, browser type, and browsing activity.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">2. How We Use Your Information</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            We use your information to process and fulfill your orders, communicate with you about your orders and account, send you marketing communications (with your consent), improve our website and services, and comply with legal obligations.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">3. Information Sharing</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            We do not sell or rent your personal information to third parties. We share your information only with service providers who assist us in operating our business, such as payment processors (Stripe), shipping carriers, and email service providers. These providers are contractually obligated to protect your information.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">4. Data Security</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            We implement appropriate technical and organizational measures to protect your personal information against unauthorized access, alteration, disclosure, or destruction. Payment information is processed securely through Stripe and is never stored on our servers.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">5. Cookies</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            Our website uses cookies to improve your browsing experience, analyze website traffic, and personalize content. You can control cookie preferences through your browser settings. Essential cookies required for the website to function cannot be disabled.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">6. Your Rights</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            You have the right to access, correct, or delete your personal information. You can update your account information at any time by contacting us. You may also opt out of marketing communications by clicking the unsubscribe link in our emails.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">7. Data Retention</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            We retain your personal information for as long as necessary to fulfill the purposes outlined in this policy, unless a longer retention period is required or permitted by law. Order information is retained for a minimum of 5 years for tax and legal compliance.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">8. Children's Privacy</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            Our services are not intended for individuals under the age of 18. We do not knowingly collect personal information from children. If we become aware that we have collected information from a child, we will take steps to delete it promptly.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">9. Changes to This Policy</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            We may update this Privacy Policy from time to time. We will notify you of any material changes by posting the new policy on this page and updating the "Last updated" date. Your continued use of our services after any changes constitutes acceptance of the updated policy.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">10. Contact Us</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            If you have any questions about this Privacy Policy or how we handle your data, please contact us at{" "}
            <a href="mailto:hello@lebongrace.com" className="text-sand hover:text-sand-dark underline">hello@lebongrace.com</a>.
          </p>
        </div>

        <div className="pt-6 border-t border-border">
          <Link href="/shop" className="text-sand text-sm font-medium hover:text-sand-dark transition-colors">
            Back to Shop
          </Link>
        </div>
      </section>
    </>
  );
}
