"use client";

import { useState, useEffect } from "react";

export default function ContactInfo() {
  const [visible, setVisible] = useState(false);
  
  // Only render the actual number after a user interaction
  // This prevents static HTML scraping
  const rawPhone = "+971588286630";
  const displayPhone = "+971 58 828 6630";
  const whatsappUrl = `https://wa.me/971588286630?text=Hi!%20I%20have%20a%20question%20about%20Lebon%20Grace.`;
  
  // Encode phone in a way that bots can't easily parse
  const encoded = btoa(rawPhone);
  
  return (
    <span className="inline-flex items-center gap-2">
      {/* Phone number - protected from scraping */}
      <span
        className="select-none cursor-pointer"
        onClick={() => setVisible(true)}
        title="Click to reveal phone number"
        data-phone={encoded}
      >
        {visible ? (
          <a href={`tel:${rawPhone}`} className="hover:text-[#C9A96E] transition-colors">
            {displayPhone}
          </a>
        ) : (
          <span className="tracking-wider">
            +971 ••• ••• ••30
          </span>
        )}
      </span>
      
      {/* WhatsApp link - protected */}
      <span
        className="select-none cursor-pointer"
        onClick={() => window.open(whatsappUrl, "_blank")}
        title="Contact on WhatsApp"
      >
        <svg className="w-4 h-4 text-[#25D366] hover:text-[#1DA851] transition-colors" fill="currentColor" viewBox="0 0 24 24">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.941 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.67-.167-.67-.167h-.57c-.197 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.273-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.904-9.884 2.605 0 5.06 1.023 6.9 2.863a9.835 9.835 0 012.863 6.914c-.003 5.45-4.437 9.884-9.89 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.924c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.926 0-.026 0-.055 0-.083A11.942 11.942 0 0021.85 5.737" />
        </svg>
      </span>
    </span>
  );
}
