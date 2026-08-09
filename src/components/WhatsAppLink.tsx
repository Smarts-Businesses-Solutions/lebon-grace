"use client";

import { useState } from "react";

/**
 * A WhatsApp button that does not put the number in the page.
 *
 * A wa.me href necessarily contains the number, so any such link in the served
 * HTML is a free harvest for a crawler. This fetches the link from
 * /api/contact/reveal on click and then opens it, so the number never appears
 * in page source or in the JS bundle.
 *
 * The trade is one extra round trip on click. For a support link that is
 * clicked rarely and deliberately, that is not a cost worth worrying about.
 */
export default function WhatsAppLink({
  message,
  className,
  children,
}: {
  message?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);

  async function open() {
    if (loading) return;
    setLoading(true);
    try {
      const r = await fetch("/api/contact/reveal");
      if (!r.ok) return;
      const { whatsapp } = await r.json();
      const url = message
        ? `${whatsapp.split("?")[0]}?text=${encodeURIComponent(message)}`
        : whatsapp;
      window.open(url, "_blank", "noopener,noreferrer");
    } finally {
      setLoading(false);
    }
  }

  return (
    <button type="button" onClick={open} className={className} aria-busy={loading}>
      {children}
    </button>
  );
}
