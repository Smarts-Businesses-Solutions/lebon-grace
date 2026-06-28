import Link from "next/link";

export const metadata = {
  title: "About — Lebon Grace",
  description: "The story behind Lebon Grace. Quality over quantity, transparency, respect.",
};

export default function AboutPage() {
  return (
    <>
      <section className="bg-offwhite border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <h1 className="font-heading text-3xl lg:text-4xl font-semibold tracking-tight">About Lebon Grace</h1>
          <p className="mt-3 text-warm-gray text-sm tracking-wide">Quality picks, honest prices</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 space-y-16">
        {/* Brand Story */}
        <div>
          <h2 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight mb-6">Our Story</h2>
          <div className="space-y-4 text-charcoal text-sm leading-relaxed">
            <p>
              Lebon Grace was born from a simple observation: the most beautiful objects are often the quietest. In a world saturated with noise, we chose to listen. In a market driven by excess, we chose restraint.
            </p>
            <p>
              Founded in the UAE, we curate workspace, travel, and home accessories that speak through material, form, and function rather than logos and trends. Every piece in our collection has been selected with intention, tested for quality, and priced with transparency.
            </p>
            <p>
              Our name reflects our philosophy. "Lebon" speaks to the good and the refined. "Grace" embodies the elegance of simplicity. Together, they represent our commitment to offering goods that enhance your daily life without overwhelming it.
            </p>
          </div>
        </div>

        {/* Mission */}
        <div className="bg-charcoal text-offwhite rounded-sm p-8 lg:p-12">
          <h2 className="font-heading text-2xl font-semibold tracking-tight mb-4">Our Mission</h2>
          <p className="text-warm-gray text-sm leading-relaxed">
            To make quality products accessible to everyone. We believe that beautiful, well-made objects should not be reserved for the few. Through thoughtful sourcing and transparent pricing, we bring everyday quality to everyday life.
          </p>
        </div>

        {/* Values */}
        <div>
          <h2 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight mb-8 text-center">Our Values</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-sand/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-sand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </div>
              <h3 className="font-heading text-lg font-semibold tracking-tight">Quality Over Quantity</h3>
              <p className="mt-3 text-warm-gray text-sm leading-relaxed">
                We would rather offer ten exceptional products than a hundred mediocre ones. Every item is chosen for its craftsmanship, durability, and timeless design.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-sand/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-sand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-heading text-lg font-semibold tracking-tight">Transparency</h3>
              <p className="mt-3 text-warm-gray text-sm leading-relaxed">
                No hidden fees. No misleading claims. Our 50/50 payment model reflects our belief that trust is earned through honest practices.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-sand/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-sand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </div>
              <h3 className="font-heading text-lg font-semibold tracking-tight">Respect</h3>
              <p className="mt-3 text-warm-gray text-sm leading-relaxed">
                Respect for our customers, our materials, and our craft. We listen to what you need and deliver it with care, every time.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-warm-gray text-sm mb-4">Ready to explore our curated collection?</p>
          <Link href="/shop" className="inline-flex items-center px-8 py-3.5 bg-sand text-white text-sm tracking-wider uppercase font-medium rounded-sm hover:bg-sand-dark transition-colors">
            Shop the Collection
          </Link>
        </div>
      </section>
    </>
  );
}
