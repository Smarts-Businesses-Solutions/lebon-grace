import type { Metadata } from "next";
import FAQClient from "./FAQClient";

/**
 * The FAQ was a single "use client" file, and a client component cannot export
 * metadata. So this page inherited the generic site-wide title and had no
 * description of its own, despite being linked from the footer of every page.
 * Splitting the interactive accordion into FAQClient lets the route carry
 * proper metadata, the same way /track and /account already do.
 */
export const metadata: Metadata = {
  title: "FAQ — Delivery, Returns and Engraving | Lebon Grace",
  description:
    "Answers on made-to-order lead times, free collection in the UAE, delivery costs, free name engraving, puzzle sizes and our 7 day replacement.",
};

export default function FAQPage() {
  return <FAQClient />;
}
