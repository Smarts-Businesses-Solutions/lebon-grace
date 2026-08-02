"use client";

import { useState } from "react";

/**
 * Reveals the phone number and WhatsApp link on click.
 *
 * The details are NOT in this file and NOT in the JavaScript bundle. They are
 * fetched from /api/contact/reveal when a visitor asks for them, which is what
 * keeps them out of page source and away from crawlers that never run scripts.
 *
 * The previous version base64-encoded the number, but also kept the plain value
 * in `rawPhone`, in `displayPhone`, and inside a wa.me URL. The number shipped
 * to every visitor in clear text three times over, and base64 is a decode
 * rather than a cipher. Encoding a value you also ship in the open protects
 * nothing.
 */
export default function ContactInfo() {
  const [details, setDetails] = useState<{ phone: string; whatsapp: string } | null>(null);
  const [loading, setLoading] = useState(false);

  async function reveal() {
    if (details || loading) return;
    setLoading(true);
    try {
      const r = await fetch("/api/contact/reveal");
      if (r.ok) setDetails(await r.json());
    } finally {
      setLoading(false);
    }
  }

  if (!details) {
    return (
      <button
        type="button"
        onClick={reveal}
        className="inline-flex items-center gap-1.5 text-sm hover:text-[#C9A96E] transition-colors"
        aria-label="Show contact number"
      >
        <svg className="w-4 h-4 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.941 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.67-.167-.67-.167h-.57c-.197 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.273-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.904-9.884 2.605 0 5.06 1.023 6.9 2.863a9.835 9.835 0 012.863 6.914c-.003 5.45-4.437 9.884-9.89 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.924c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.926 0-.026 0-.055 0-.083A11.942 11.942 0 0021.85 5.737" />
        </svg>
        {loading ? "…" : "Show WhatsApp number"}
      </button>
    );
  }

  return (
    <a
      href={details.whatsapp}
      target="_blank"
      rel="noopener noreferrer nofollow"
      className="inline-flex items-center gap-2 text-sm hover:text-[#C9A96E] transition-colors"
    >
      <svg className="w-4 h-4 text-[#25D366]" fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.941 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.67-.167-.67-.167h-.57c-.197 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.273-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.904-9.884 2.605 0 5.06 1.023 6.9 2.863a9.835 9.835 0 012.863 6.914c-.003 5.45-4.437 9.884-9.89 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.924c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.926 0-.026 0-.055 0-.083A11.942 11.942 0 0021.85 5.737" />
      </svg>
      {details.phone}
    </a>
  );
}
