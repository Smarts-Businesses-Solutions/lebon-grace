"use client";

import { useState } from "react";

const faqs = [
  {
    question: "How does the 50/50 payment work?",
    answer: "When you place your order, you pay 50% of the total via credit card through our secure Stripe checkout. The remaining 50% is collected as cash on delivery (COD) when your order arrives at your door. This way, you only commit half upfront and pay the rest once you receive your items.",
  },
  {
    question: "How long does delivery take?",
    answer: "All orders are delivered within 10-14 business days across the UAE. We ship to all seven emirates: Dubai, Abu Dhabi, Sharjah, Ajman, Ras Al Khaimah, Fujairah, and Umm Al Quwain. You will receive tracking information once your order has been dispatched.",
  },
  {
    question: "Is there free shipping?",
    answer: "Yes, we offer free shipping on all orders over AED 300. For orders under AED 300, a flat shipping fee of AED 25 applies. You can also choose to pick up your order for free — select 'Pick up' at checkout and collect at no additional cost.",
  },
  {
    question: "What is your return policy?",
    answer: "As a small company sourcing affordable products directly from international suppliers, we do not offer returns or refunds once an order has been delivered — all sales are final. This helps us keep our prices as low as possible. We encourage you to review product details carefully before ordering. If you receive a damaged or incorrect item, please contact us within 48 hours of delivery with photos, and we will arrange a replacement or store credit.",
  },
  {
    question: "Can I track my order?",
    answer: "Yes, you will receive a tracking number via email once your order has been dispatched. You can use this to track your delivery in real time. If you have any issues with tracking, please reach out to our support team.",
  },
  {
    question: "Do you ship outside the UAE?",
    answer: "Currently, we only deliver within the United Arab Emirates. We are working on expanding to other GCC countries in the future. Sign up for our newsletter to be the first to know when we expand.",
  },
  {
    question: "Can I change or cancel my order?",
    answer: "All orders are final once placed. As a small company sourcing products from international suppliers, we are unable to modify or cancel orders after they have been submitted. Our fulfillment process begins immediately to ensure fast delivery. Please review your cart and details carefully before completing your purchase.",
  },
  {
    question: "Can I pick up my order instead of delivery?",
    answer: "Yes! We offer a free pickup option. Simply select 'Pick up' at checkout instead of 'Deliver to me'. You won't pay any shipping fee. We'll notify you via WhatsApp when your order is ready for collection.",
  },
  {
    question: "What payment methods do you accept?",
    answer: "We accept all major credit and debit cards through our secure Stripe payment gateway. For the remaining 50%, we accept cash on delivery. We do not currently accept bank transfers or digital wallets.",
  },
  {
    question: "Are the product images accurate?",
    answer: "We strive to represent our products as accurately as possible. Due to the handcrafted nature of some items, there may be slight variations in color, texture, or shape. These variations are part of what makes each piece unique.",
  },
  {
    question: "How can I contact customer support?",
    answer: "You can reach us at care@lebon-grace.com or through our social media channels. We respond to all inquiries within 24 hours during business days (Monday through Saturday).",
  },
];

export default function FAQPage() {
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
          <a href="mailto:care@lebon-grace.com" className="text-sand text-sm font-medium hover:text-sand-dark transition-colors">
            Contact us at care@lebon-grace.com
          </a>
        </div>
      </section>
    </>
  );
}
