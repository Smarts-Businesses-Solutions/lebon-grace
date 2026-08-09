import Link from "next/link";

export const metadata = {
  // The description was still selling the dropship catalogue: "Affordable
  // workspace, travel, and home accessories." That is the line Google showed
  // under a link to a children's puzzle workshop.
  title: "About — Lebon Grace",
  description:
    "A small UAE workshop making wooden puzzles for children. Cut, sanded and finished by hand, made to order, with a name engraved free.",
};

export default function AboutPage() {
  return (
    <>
      <section className="bg-offwhite border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <h1 className="font-heading text-3xl lg:text-4xl font-semibold tracking-tight">About Lebon Grace</h1>
          {/* "Picks" was reseller language from the dropship site. Nothing here
              is picked; it is drawn and cut. */}
          <p className="mt-3 text-warm-gray text-sm tracking-wide">Cut by hand in the UAE, honest prices</p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24 space-y-16">
        {/* Brand Story */}
        <div>
          <h2 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight mb-6">Our Story</h2>
          <div className="space-y-4 text-charcoal text-sm leading-relaxed">
            <p>
              Lebon Grace started with a laser cutter and a simple thought: a wooden toy that teaches a child their letters should not cost a hundred dirhams, and it should not be made on the other side of the world either. So we draw them, cut them and sand them here, one order at a time.</p>
            <p>
              We are a small workshop in the UAE making wooden puzzles for children. Everything here is drawn as a cutting file, cut from MDF on our own laser, sanded by hand and checked before it goes out. Nothing is bought in and relabelled, and nothing sits in a warehouse waiting for someone to want it. Your puzzle does not exist until you order it, which is why it takes two or three days and why we can put your child’s name on it for nothing.
            </p>
            <p>
              Our name reflects our approach. “Lebon” means good in French. “Grace” means doing it with style. Together: good things, done well, at fair prices.
            </p>
          </div>
        </div>

        {/* Mission */}
        <div className="bg-charcoal text-offwhite rounded-sm p-8 lg:p-12">
          <h2 className="font-heading text-2xl font-semibold tracking-tight mb-4">Our Mission</h2>
          <p className="text-paper/90 text-sm leading-relaxed">
            To make toys that are worth keeping, at a price that does not make you think twice. A wooden alphabet board should not cost a hundred dirhams, and it should not fall apart either. Every puzzle we make is AED 15, with the name engraving included.
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
              <h3 className="font-heading text-lg font-semibold tracking-tight">Honest Pricing</h3>
              <p className="mt-3 text-paper/90 text-sm leading-relaxed">
                There is no middleman because there is no supplier. Every piece is drawn, cut, sanded and finished here, so you pay for the wood and the work, nothing else.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-sand/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-sand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <h3 className="font-heading text-lg font-semibold tracking-tight">Made to Order</h3>
              <p className="mt-3 text-paper/90 text-sm leading-relaxed">
                We hold no stock, so nothing is ever discontinued or out of stock. You order it, we make it, you collect it or we send it. Two to three working days, every time.
              </p>
            </div>
            <div className="text-center">
              <div className="w-12 h-12 mx-auto rounded-full bg-sand/10 flex items-center justify-center mb-4">
                <svg className="w-6 h-6 text-sand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </div>
              <h3 className="font-heading text-lg font-semibold tracking-tight">Customer First</h3>
              <p className="mt-3 text-paper/90 text-sm leading-relaxed">
                Free collection, WhatsApp support, and a free replacement within 7 days if anything arrives faulty. You do not send it back; we just make you another one.
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <p className="text-warm-gray text-sm mb-4">Come and see what we make</p>
          <Link href="/shop" className="inline-flex items-center px-8 py-3.5 bg-sand text-ink text-sm tracking-wider uppercase font-medium rounded-sm hover:bg-sand-dark transition-colors">
            Shop the Collection
          </Link>
        </div>
      </section>
    </>
  );
}
