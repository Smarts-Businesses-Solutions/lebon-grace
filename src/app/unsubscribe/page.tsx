import type { Metadata } from "next";
import UnsubscribeClient from "./UnsubscribeClient";

export const metadata: Metadata = {
  title: "Unsubscribe — Lebon Grace",
  description: "Remove your email address from the Lebon Grace mailing list.",
  robots: { index: false, follow: false },
};

export default function UnsubscribePage() {
  return <UnsubscribeClient />;
}
