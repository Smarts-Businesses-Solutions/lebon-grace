import type { Metadata } from "next";
import ContactClient from "./ContactClient";

/**
 * Same split as /faq: the form is interactive so it has to be a client
 * component, which meant the route could not export metadata and fell back to
 * the generic site title.
 */
export const metadata: Metadata = {
  title: "Contact Us — Lebon Grace",
  description:
    "Questions about an order, a custom design or international delivery? Send us a message, or reach the workshop on WhatsApp.",
};

export default function ContactPage() {
  return <ContactClient />;
}
