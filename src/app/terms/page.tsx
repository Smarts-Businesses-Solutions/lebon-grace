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
            By placing an order, you are making an offer to purchase a product. All orders are subject to acceptance by us. Payment is taken in full at checkout via credit card. Items are made to order and production begins once payment is received. We accept all major credit and debit cards through our secure Stripe payment gateway.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">4. Shipping and Delivery</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            Every piece is made to order. We cut, sand and finish your item within 2 to 3 working days and contact you as soon as it is ready. Collection from our workshop is free and is the default option at checkout. Delivery anywhere in the UAE is AED 20, and free on orders over AED 150. International delivery is available on request: contact us before ordering and we will quote for your country. Any customs duties or import charges outside the UAE are the responsibility of the recipient.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">5. Returns and Refunds</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            Every puzzle is cut and finished only after you order it, so it is made specifically for you. For that reason <strong>made-to-order items cannot be returned or exchanged if you simply change your mind</strong>. This includes any item personalised with a name, which cannot be resold to anyone else. Clearance items are different: they are existing stock and may be returned within 7 days, unused and in their original packaging.
          </p>
          <p className="text-charcoal text-sm leading-relaxed mt-3">
            <strong>If anything arrives faulty, damaged or not what you ordered, we replace it free of charge.</strong> Send us a photo within 7 days of receiving it and we will make a new one and get it to you at no cost, with no need to return the original. Where a replacement is not possible we will refund you in full. Nothing here affects your statutory rights under UAE consumer protection law.
          </p>
        </div>

        <div>
          <h2 className="font-heading text-xl font-semibold tracking-tight mb-3">6. Order Modifications and Cancellations</h2>
          <p className="text-charcoal text-sm leading-relaxed">
            Because production starts soon after payment, please contact us as quickly as possible if you need to change or cancel an order. <strong>If we have not yet begun cutting your piece we will cancel it and refund you in full.</strong> Once the wood has been cut, or a name has been engraved, the item cannot be cancelled or refunded. If you have asked for personalisation, please check the spelling carefully at checkout: we engrave exactly what you give us.
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
            <a href="/contact" className="text-sand hover:text-sand-dark underline">our contact form</a>{" "}
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
