import Link from "next/link";

export const metadata = {
  title: "Terms of Service — Lebon Grace",
  description: "Terms and conditions for shopping with Lebon Grace.",
};

export default function TermsPage() {
  return (
    <>
      <section className="bg-offwhite border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <h1 className="font-heading text-3xl lg:text-4xl font-semibold tracking-tight">Terms of Service</h1>
          <p className="mt-3 text-warm-gray text-sm tracking-wide">Last updated: June 2026</p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16 space-y-8">
        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">1. Introduction</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            Welcome to Lebon Grace. By accessing or using our website and services, you agree to be bound by these Terms of Service. If you do not agree to these terms, please do not use our services.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">2. Products and Pricing</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            All products are subject to availability. We reserve the right to discontinue any product at any time. Prices are displayed in AED (United Arab Emirates Dirham) and include all applicable taxes unless otherwise stated. We reserve the right to change prices without prior notice.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">3. Orders and Payment</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            By placing an order, you are making an offer to purchase a product. All orders are subject to acceptance by us. Our 50/50 payment model requires 50% of the order total to be paid upfront via credit card, with the remaining 50% collected as cash on delivery. We accept all major credit and debit cards through our secure Stripe payment gateway.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">4. Shipping and Delivery</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            We deliver to all seven emirates in the UAE. Standard delivery takes 10-14 business days. Free shipping is offered on orders over AED 300. A flat fee of AED 25 applies to orders under AED 300. We also offer a free pickup option — select "Pick up" at checkout and collect your order at no additional cost. Delivery times are estimates and may vary due to unforeseen circumstances.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">5. Returns and Refunds</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            Due to the nature of our business — sourcing affordable products directly from international suppliers — <strong>we do not offer returns or refunds</strong> once an order has been delivered. All sales are final. We are a small company committed to keeping prices as low as possible, and the cost of international return shipping would make returns impractical for both parties.
          </p>
          <p className="text-charcoal text-sm leading-relaxed mt-3">
            We encourage you to review product details, images, and sizing information carefully before placing your order. If you receive a damaged or incorrect item, please contact us within 48 hours of delivery with photos, and we will work with you to resolve the issue — including a replacement or store credit where applicable.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">6. Order Modifications and Cancellations</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            <strong>All orders are final once placed.</strong> We do not offer modifications or cancellations. As a small company sourcing products from international suppliers, our fulfillment process begins immediately after an order is received to ensure the fastest possible delivery. Please review your order carefully before completing your purchase.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">7. Intellectual Property</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            All content on this website, including text, images, logos, and design elements, is the property of Lebon Grace and is protected by applicable intellectual property laws. You may not reproduce, distribute, or create derivative works without our express written permission.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">8. Limitation of Liability</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            Lebon Grace shall not be liable for any indirect, incidental, or consequential damages arising from the use of our products or services. Our total liability shall not exceed the amount paid for the product in question.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">9. Governing Law</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            These Terms of Service are governed by and construed in accordance with the laws of the United Arab Emirates. Any disputes shall be subject to the exclusive jurisdiction of the courts of Dubai.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">10. Contact</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            If you have any questions about these Terms of Service, please contact us at{" "}
            <a href="mailto:care@lebon-grace.com" className="text-sand hover:text-sand-dark underline">care@lebon-grace.com</a>{" "}
            or write to: Sharjah Media City, Al Messaned, Al Bataeh, Sharjah, UAE.
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
