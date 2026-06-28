"use client";

import { useState, useEffect } from "react";
import { getCartEmail, getCartAge, saveCartEmail, useCart } from "@/lib/cart-context";

export default function CartRecoveryBanner() {
  const { items, total } = useCart();
  const [email, setEmail] = useState("");
  const [showBanner, setShowBanner] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    // Show banner if cart has items and is > 60 min old
    const age = getCartAge();
    if (items.length > 0 && age > 60) {
      setShowBanner(true);
      const savedEmail = getCartEmail();
      if (savedEmail) setEmail(savedEmail);
    }
  }, [items.length]);

  const handleSendRecovery = async () => {
    if (!email || !email.includes("@")) return;
    setSending(true);
    saveCartEmail(email);

    try {
      await fetch("/api/cart-recovery", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          items: items.map((i) => ({
            product: { name: i.product.name, price: i.product.price, slug: i.product.slug },
            quantity: i.quantity,
          })),
          total,
        }),
      });
      setSent(true);
    } catch {
      // silent fail
    }
    setSending(false);
  };

  if (!showBanner || items.length === 0) return null;

  if (sent) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-6">
        <p className="text-sm text-green-700 font-medium">✅ We&apos;ve sent a reminder to {email}. Check your inbox!</p>
      </div>
    );
  }

  return (
    <div className="bg-[#C9A96E]/5 border border-[#C9A96E]/20 rounded-xl p-5 mb-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        <div className="flex-1">
          <p className="text-sm font-semibold text-gray-900">Still thinking about it? 🛒</p>
          <p className="text-xs text-gray-500 mt-1">
            Save your cart and we&apos;ll send you a reminder with a quick checkout link.
          </p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            className="px-3 py-2 border border-gray-200 rounded-lg text-sm flex-1 sm:w-48 focus:border-[#C9A96E] outline-none"
          />
          <button
            onClick={handleSendRecovery}
            disabled={sending || !email.includes("@")}
            className="px-4 py-2 bg-[#C9A96E] text-white rounded-lg text-sm font-medium hover:bg-[#B89A5E] transition-colors disabled:opacity-50 whitespace-nowrap"
          >
            {sending ? "..." : "Save Cart"}
          </button>
        </div>
      </div>
    </div>
  );
}
