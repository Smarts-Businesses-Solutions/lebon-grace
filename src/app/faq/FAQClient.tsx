"use client";

import { useState } from "react";

const faqs = [
  {
    question: "How does the ordering and collection work?",
    answer: "You pay in full at checkout through our secure Stripe page, and we start making your piece straight away. Everything is cut, sanded and finished to order, which takes 2 to 3 working days. Collection from the workshop is free, or we can deliver anywhere in the UAE for AED 20, free on orders over AED 150.",
  },
  {
    question: "How long does delivery take?",
    answer: "Every piece is made to order, so allow 2 to 3 working days for us to cut, sand and finish it. We will message you the moment it is ready. Collection from the workshop is free; UAE delivery usually arrives within 1 to 2 days after that.",
  },
  {
    question: "Is there free shipping?",
    answer: "Collection from our workshop is always free, and it is the option we recommend. UAE delivery is a flat AED 20, and free on orders over AED 150.",
  },
  {
    question: "What is your return policy?",
    answer: "Each puzzle is cut only after you order it, so made-to-order items cannot be returned if you simply change your mind. Personalised pieces cannot be returned either, since a name makes them yours alone. If anything arrives faulty, damaged or wrong, send us a photo within 7 days and we will make you a new one free of charge, with nothing to send back. Clearance items are existing stock and can be returned within 7 days, unused.",
  },
  {
    // Was: "you will receive a tracking number via email once your order has been
    // dispatched... track your delivery in real time." Pickup is the default and
    // is never dispatched, so most orders have no tracking number at all.
    question: "Can I track my order?",
    answer: "Yes. Go to Track Order and enter your order number and the phone number you ordered with. You will see where your piece is: still being cut, ready, or on its way. If you chose collection there is no courier involved, so we simply message you on WhatsApp the moment it is ready. For UAE delivery we add the courier's tracking number to your order as soon as it is handed over.",
  },
  {
    question: "Do you ship outside the UAE?",
    answer: "Yes, on request. Contact us before ordering with your country and what you would like, and we will quote for delivery. Any customs or import charges are the recipient's responsibility.",
  },
  {
    question: "Can I change or cancel my order?",
    answer: "Contact us as soon as you can. If we have not started cutting your piece we will cancel it and refund you in full. Once the wood is cut, or a name engraved, we cannot cancel it. Please double check the spelling of any personalisation before you pay, because we engrave exactly what you give us.",
  },
  {
    question: "Can I pick up my order instead of delivery?",
    answer: "Yes, and it is free. Pickup is selected by default at checkout. Collection is in Dubai, and we send you the exact location and a time on WhatsApp or by email once your piece is ready, which is 2 to 3 working days after you order. If Dubai is not convenient, choose delivery instead: AED 20 anywhere in the UAE, free over AED 150.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit and debit cards through our secure Stripe payment gateway. Payment is taken in full at checkout. We do not currently accept bank transfers or digital wallets.",
  },
  {
    question: "Are the product images accurate?",
    answer: "The photographs show pieces we have made. Because everything is cut and sanded by hand from natural material, the grain and tone of your piece will differ slightly. That variation is the point: no two are identical.",
  },
  {
    // Was: "or through our social media channels" — there are none.
    question: "How can I contact you?",
    answer: "Use the form on the Contact page, or message us on WhatsApp. The WhatsApp number is on the Contact page behind a click, which keeps it away from the bots that scrape numbers for scam and phishing lists. We answer within 24 hours, Monday to Saturday.",
  },
  {
    question: "Is name engraving really free?",
    answer: "Yes, on every puzzle, and there is no minimum order. Type the name you want at checkout and we engrave it before the piece is sanded. It costs us nothing but laser time, so we do not charge for it. Please check the spelling: we engrave exactly what you type, and a personalised piece cannot be returned or resold.",
  },
  {
    question: "How big are the puzzles?",
    answer: "Sizes vary by design and are printed on the third photograph of every product, so you can check before you buy. Most sit between roughly 13 and 20 cm on the longest side, which suits small hands and fits on a tray or a car seat.",
  },
  {
    question: "What are they made of, and what age are they for?",
    answer: "Each piece is cut from MDF board and sanded by hand, with a white paper matte finish on the face. Ages are shown on each product page. Please use your own judgement with children under three: several designs have small pieces that a toddler could put in their mouth, and those should only be used with an adult sitting with the child.",
  },
];

export default function FAQClient() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <>
      <section className="bg-offwhite border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <h1 className="font-heading text-3xl lg:text-4xl font-semibold tracking-tight">Frequently Asked Questions</h1>
          <p className="mt-3 text-warm-gray text-sm tracking-wide">Everything you need to know about shopping with Lebon Grace</p>
        </div>
      </section>

      <section className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <div className="space-y-0 border-t border-border">
          {faqs.map((faq, index) => (
            <div key={index} className="border-b border-border">
              <button
                onClick={() => setOpenIndex(openIndex === index ? null : index)}
                className="w-full flex items-center justify-between py-5 text-left group"
              >
                <span className="font-heading text-base font-medium tracking-tight text-dark group-hover:text-sand transition-colors pr-4">
                  {faq.question}
                </span>
                <svg
                  className={`w-5 h-5 text-warm-gray flex-shrink-0 transition-transform duration-300 ${openIndex === index ? "rotate-180" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </button>
              {openIndex === index && (
                <div className="pb-5 pr-8">
                  <p className="text-warm-gray text-sm leading-relaxed">{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <p className="text-warm-gray text-sm mb-3">Still have questions?</p>
          <a href="/contact" className="text-sand text-sm font-medium hover:text-sand-dark transition-colors">
            Contact us at our contact form
          </a>
        </div>
      </section>
    </>
  );
}
