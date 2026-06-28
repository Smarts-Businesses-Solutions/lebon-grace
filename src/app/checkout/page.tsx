"use client";

import Link from "next/link";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/products";

const emirates = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"];

export default function CheckoutPage() {
  const { items, subtotal, clearCart } = useCart();
  const shipping = subtotal >= 300 ? 0 : 25;
  const total = subtotal + shipping;
  const depositNow = Math.round(total / 2);

  const [form, setForm] = useState({
    email: "", phone: "+971", firstName: "", lastName: "",
    address: "", emirate: "Dubai", building: "", landmark: "",
    paymentMethod: "card", termsAccepted: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
  };

  const validate = () => {
    const ne: Record<string, string> = {};
    if (!form.email.trim()) ne.email = "Email is required";
    if (!form.phone.trim() || form.phone.length < 10) ne.phone = "Valid phone required";
    if (!form.firstName.trim()) ne.firstName = "Required";
    if (!form.lastName.trim()) ne.lastName = "Required";
    if (!form.address.trim()) ne.address = "Required";
    if (!form.building.trim()) ne.building = "Required";
    if (!form.termsAccepted) ne.terms = "Accept terms";
    return ne;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ne = validate();
    if (Object.keys(ne).length > 0) { setErrors(ne); return; }
    setSubmitting(true);
    setTimeout(() => { clearCart(); setOrderPlaced(true); setSubmitting(false); }, 1500);
  };

  if (items.length === 0 && !orderPlaced) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="font-heading text-2xl font-semibold">Nothing to Checkout</h1>
        <p className="mt-3 text-warm-gray text-sm">Your cart is empty.</p>
        <Link href="/shop" className="mt-6 inline-flex items-center px-6 py-3 bg-sand text-white text-sm tracking-wider uppercase font-medium rounded-sm hover:bg-sand-dark transition-colors">Shop Now</Link>
      </section>
    );
  }

  if (orderPlaced) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-sand/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-sand" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
        </div>
        <h1 className="mt-6 font-heading text-3xl font-semibold tracking-tight">Order Confirmed</h1>
        <p className="mt-4 text-warm-gray text-sm max-w-md mx-auto">
          Thank you for your order. You will receive a confirmation email shortly. You have paid 50% now and the remaining 50% will be collected on delivery.
        </p>
        <Link href="/shop" className="mt-8 inline-flex items-center px-6 py-3 bg-sand text-white text-sm tracking-wider uppercase font-medium rounded-sm hover:bg-sand-dark transition-colors">Continue Shopping</Link>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <h1 className="font-heading text-3xl lg:text-4xl font-semibold tracking-tight mb-8">Checkout</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          <div>
            <h2 className="font-heading text-lg font-semibold tracking-tight mb-4">Contact Information</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-charcoal tracking-wide mb-1.5">Email *</label>
                <input type="email" name="email" value={form.email} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-border rounded-sm text-sm text-dark focus:outline-none focus:border-sand transition-colors" placeholder="you@example.com" />
                {errors.email && <p className="mt-1 text-red-500 text-xs">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-xs text-charcoal tracking-wide mb-1.5">Phone *</label>
                <input type="tel" name="phone" value={form.phone} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-border rounded-sm text-sm text-dark focus:outline-none focus:border-sand transition-colors" placeholder="+971 50 123 4567" />
                {errors.phone && <p className="mt-1 text-red-500 text-xs">{errors.phone}</p>}
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-heading text-lg font-semibold tracking-tight mb-4">Shipping Address</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-charcoal tracking-wide mb-1.5">First Name *</label>
                <input type="text" name="firstName" value={form.firstName} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-border rounded-sm text-sm text-dark focus:outline-none focus:border-sand transition-colors" />
                {errors.firstName && <p className="mt-1 text-red-500 text-xs">{errors.firstName}</p>}
              </div>
              <div>
                <label className="block text-xs text-charcoal tracking-wide mb-1.5">Last Name *</label>
                <input type="text" name="lastName" value={form.lastName} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-border rounded-sm text-sm text-dark focus:outline-none focus:border-sand transition-colors" />
                {errors.lastName && <p className="mt-1 text-red-500 text-xs">{errors.lastName}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-charcoal tracking-wide mb-1.5">Address *</label>
                <input type="text" name="address" value={form.address} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-border rounded-sm text-sm text-dark focus:outline-none focus:border-sand transition-colors" placeholder="Street address" />
                {errors.address && <p className="mt-1 text-red-500 text-xs">{errors.address}</p>}
              </div>
              <div>
                <label className="block text-xs text-charcoal tracking-wide mb-1.5">Emirate *</label>
                <select name="emirate" value={form.emirate} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-border rounded-sm text-sm text-dark focus:outline-none focus:border-sand transition-colors">
                  {emirates.map((e) => (<option key={e} value={e}>{e}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-charcoal tracking-wide mb-1.5">Building / Villa *</label>
                <input type="text" name="building" value={form.building} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-border rounded-sm text-sm text-dark focus:outline-none focus:border-sand transition-colors" />
                {errors.building && <p className="mt-1 text-red-500 text-xs">{errors.building}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className="block text-xs text-charcoal tracking-wide mb-1.5">Landmark</label>
                <input type="text" name="landmark" value={form.landmark} onChange={handleChange} className="w-full px-4 py-2.5 bg-white border border-border rounded-sm text-sm text-dark focus:outline-none focus:border-sand transition-colors" placeholder="Near..." />
              </div>
            </div>
          </div>

          <div>
            <h2 className="font-heading text-lg font-semibold tracking-tight mb-4">Payment Method</h2>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-4 bg-white border border-border rounded-sm cursor-pointer hover:border-sand/40 transition-colors">
                <input type="radio" name="paymentMethod" value="card" checked={form.paymentMethod === "card"} onChange={handleChange} className="accent-[#C9A96E]" />
                <div>
                  <p className="text-sm font-medium text-charcoal">Credit Card (Stripe)</p>
                  <p className="text-xs text-warm-gray mt-0.5">Pay {formatPrice(depositNow)} now via secure card payment</p>
                </div>
              </label>
              <label className="flex items-center gap-3 p-4 bg-white border border-border rounded-sm cursor-pointer hover:border-sand/40 transition-colors">
                <input type="radio" name="paymentMethod" value="cod" checked={form.paymentMethod === "cod"} onChange={handleChange} className="accent-[#C9A96E]" />
                <div>
                  <p className="text-sm font-medium text-charcoal">Cash on Delivery</p>
                  <p className="text-xs text-warm-gray mt-0.5">Pay {formatPrice(total)} in full upon delivery</p>
                </div>
              </label>
            </div>
          </div>

          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" name="termsAccepted" checked={form.termsAccepted} onChange={handleChange} className="mt-0.5 accent-[#C9A96E]" />
              <span className="text-xs text-warm-gray leading-relaxed">
                I agree to the <Link href="/terms" className="text-sand hover:text-sand-dark underline">Terms of Service</Link> and <Link href="/privacy" className="text-sand hover:text-sand-dark underline">Privacy Policy</Link>. I understand that 50% of the order total will be charged now and the remaining 50% will be collected on delivery.
              </span>
            </label>
            {errors.terms && <p className="mt-1 text-red-500 text-xs">{errors.terms}</p>}
          </div>

          <button type="submit" disabled={submitting} className="w-full py-3.5 bg-sand text-white text-sm tracking-wider uppercase font-medium rounded-sm hover:bg-sand-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? "Processing..." : "Pay " + formatPrice(depositNow) + " & Place Order"}
          </button>
        </form>

        <div className="lg:col-span-1">
          <div className="bg-white border border-border rounded-sm p-6 sticky top-24">
            <h2 className="font-heading text-lg font-semibold tracking-tight mb-4">Order Summary</h2>
            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={item.product.slug} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-sm flex items-center justify-center flex-shrink-0" style={{ backgroundColor: item.product.imagePlaceholder.bg }}>
                    <span className="font-heading text-xs font-semibold" style={{ color: item.product.imagePlaceholder.bg === "#C9A96E" || item.product.imagePlaceholder.bg === "#D4BA85" ? "#2D2D2D" : "#FAF8F5" }}>{item.product.imagePlaceholder.initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-dark truncate">{item.product.name}</p>
                    <p className="text-xs text-warm-gray">Qty: {item.quantity}</p>
                  </div>
                  <span className="text-xs font-medium text-dark">{formatPrice(item.product.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-warm-gray">Subtotal</span><span>{formatPrice(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-warm-gray">Shipping</span><span>{shipping === 0 ? "Free" : formatPrice(shipping)}</span></div>
              <div className="flex justify-between font-medium border-t border-border pt-2"><span>Total</span><span>{formatPrice(total)}</span></div>
            </div>
            <div className="mt-4 p-3 bg-offwhite rounded-sm">
              <p className="text-xs text-charcoal font-medium mb-1">Payment Split</p>
              <p className="text-xs text-warm-gray">Now: {formatPrice(depositNow)} | Delivery: {formatPrice(total - depositNow)}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
