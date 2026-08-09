"use client";

import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import { useEffect, useState } from "react";
import { useCart, saveCartEmail, clearCartRecovery } from "@/lib/cart-context";
import { formatPrice } from "@/lib/products";
import { isDeliverableEmail } from "@/lib/email-address";
import { isUsablePhone } from "@/lib/phone";

const emirates = ["Dubai", "Abu Dhabi", "Sharjah", "Ajman", "Ras Al Khaimah", "Fujairah", "Umm Al Quwain"];

export default function CheckoutPage() {
  const { items, subtotal, deliveryMethod, shipping, total, depositNow, payOnDelivery, clearCart, ready } = useCart();

  const [form, setForm] = useState({
    email: "", phone: "+971", firstName: "", lastName: "",
    address: "", emirate: "Dubai", building: "", landmark: "",
    paymentMethod: "card", termsAccepted: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);

  // Stripe returns here as /checkout?success=true&session_id=… (the success_url
  // set in api/checkout). Nothing read it, so a customer who had actually paid
  // came back to the checkout form with their basket still full and no
  // confirmation. Read from window rather than useSearchParams to avoid
  // wrapping this whole page in a Suspense boundary for one query parameter.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("success") !== "true") return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOrderPlaced(true);
    // Waits for `ready`. Effects run child-before-parent, so clearing here on
    // first mount happened BEFORE CartProvider restored from localStorage — and
    // the restore then put the paid-for basket straight back.
    if (!ready) return;
    clearCart();
    clearCartRecovery();
  }, [clearCart, ready]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setForm((prev) => ({ ...prev, [name]: type === "checkbox" ? (e.target as HTMLInputElement).checked : value }));
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: "" }));
    // Save email for cart recovery
    if (name === "email" && value.includes("@")) saveCartEmail(value);
  };

  const validate = () => {
    const ne: Record<string, string> = {};
    // Not just non-empty: `a@b` satisfied both this check and HTML5's
    // type="email", and the confirmation email is the only place the order
    // number reaches the customer.
    if (!form.email.trim()) ne.email = "Email is required";
    else if (!isDeliverableEmail(form.email))
      ne.email = "That email address will not receive your order confirmation — please check it";
    // Counts DIGITS, via the same helper the server now uses. It counted
    // CHARACTERS (`form.phone.length < 10`), so "----------" passed — and a
    // stored phone that cannot be compared is an order the customer can never
    // reach, because /track and /account both check it.
    if (!form.phone.trim()) ne.phone = "Phone is required";
    else if (!isUsablePhone(form.phone))
      ne.phone = "That number looks too short — it is also how you find your order later";
    if (!form.firstName.trim()) ne.firstName = "Required";
    if (!form.lastName.trim()) ne.lastName = "Required";
    if (deliveryMethod === "delivery") {
      if (!form.address.trim()) ne.address = "Required";
      if (!form.building.trim()) ne.building = "Required";
    }
    if (!form.termsAccepted) ne.terms = "Accept terms";
    return ne;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ne = validate();
    if (Object.keys(ne).length > 0) { setErrors(ne); return; }
    setSubmitting(true);
    
    try {
      // Create Stripe Checkout session
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: items.map((item) => ({
            name: item.product.name,
            price: item.product.price,
            quantity: item.quantity,
            image: item.product.imageUrl,
            slug: item.product.slug,
            personalisation: item.personalisation || undefined,
          })),
          subtotal: subtotal,
          shipping: shipping,
          deliveryMethod: deliveryMethod,
          emirate: form.emirate,
          // The customer's own details were never sent. Stripe therefore asked
          // for the email a second time on its own page, and phone was never
          // captured at all: customer_details.phone is only populated when
          // phone_number_collection is enabled, so every order stored an empty
          // phone. Track Order and My Account both look orders up BY phone, so
          // neither could ever have matched a real order.
          customer: {
            email: form.email.trim(),
            phone: form.phone.trim(),
            name: `${form.firstName.trim()} ${form.lastName.trim()}`.trim(),
          },
        }),
      });
      
      const data = await res.json();
      
      if (data.url) {
        // Redirect to Stripe Checkout. The cart is NOT cleared here — the
        // customer has not paid yet, and clearing it now would lose the order
        // if they abandon Stripe's page or press Back.
        // assign(), not `location.href = `: the React Compiler lint rejects
        // writing to a value defined outside the component.
        window.location.assign(data.url);
        return;
      }

      // No URL means Stripe never issued a session.
      failCheckout(data.error);
    } catch {
      // Network failure, timeout, the app being offline.
      failCheckout();
    }
  };

  /**
   * A checkout that did not start.
   *
   * This used to `clearCart()` and `setOrderPlaced(true)` — on BOTH failure
   * paths. So when /api/checkout returned an error, or the network dropped, the
   * customer was shown "Order Confirmed — Your piece is now in the making
   * queue" with a Track Your Order link, their cart was emptied, and they had
   * not paid. No order existed. They would have waited for a puzzle nobody was
   * ever going to make, and could not even retry because the cart was gone.
   *
   * A failure now says so, keeps the cart, and re-enables the button so the
   * customer can try again — which is the whole of the protocol's "no silent
   * failures; user gets a clear error and a retry path".
   */
  function failCheckout(reason?: string) {
    console.error("Checkout could not be started:", reason ?? "network error");
    setErrors({
      submit:
        "We could not start the payment just now. Nothing has been charged and your basket is safe — please try again, or contact us if it keeps happening.",
    });
    setSubmitting(false);
  }

  if (items.length === 0 && !orderPlaced) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="font-heading text-2xl font-semibold">Nothing to Checkout</h1>
        <p className="mt-3 text-warm-gray text-sm">Your cart is empty.</p>
        <Link href="/shop" className="mt-6 inline-flex items-center px-6 py-3 bg-sand text-ink text-sm tracking-wider uppercase font-medium rounded-sm hover:bg-sand-dark transition-colors">Shop Now</Link>
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
          Thank you for your order. You will receive a confirmation email shortly. Your piece is now in the making queue. We cut, sand and finish it in 2 to 3 working days and will let you know the moment it is ready.
        </p>
        <div className="mt-8 flex gap-3 justify-center">
          <Link href="/track" className="inline-flex items-center px-6 py-3 bg-sand text-ink text-sm tracking-wider uppercase font-medium rounded-sm hover:bg-sand-dark transition-colors">Track Your Order</Link>
          <Link href="/shop" className="inline-flex items-center px-6 py-3 border border-sand text-sand text-sm tracking-wider uppercase font-medium rounded-sm hover:bg-sand/5 transition-colors">Continue Shopping</Link>
        </div>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <h1 className="font-heading text-3xl lg:text-4xl font-semibold tracking-tight mb-8">Checkout</h1>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        <form onSubmit={handleSubmit} className="lg:col-span-2 space-y-6">
          {/* First and last name live here, not in the delivery block.
              validate() requires them unconditionally, but they used to render
              only when deliveryMethod === "delivery". Pickup is the DEFAULT, so
              on the default path the customer filled everything visible, hit
              Pay, and validation failed on two fields that were not on screen
              with error messages inside the hidden block. The button did nothing
              and said nothing. No pickup order could ever be placed.
              We also need a name for pickup: it is who we hand the piece to. */}
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
            </div>
          </div>

          {deliveryMethod === "delivery" && (
          <div>
            <h2 className="text-lg font-semibold tracking-tight mb-4">Delivery Address</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
          )}

          <div>
            {/* There was a "Cash on Delivery" radio here, described as "Paid in
                full", which is a contradiction on its face. Worse, it did
                nothing: paymentMethod is never read by /api/checkout and the
                client does not branch on it either, so choosing Cash on
                Delivery still created a Stripe session and sent the customer to
                a card payment page. Card is the only method, so the choice is
                gone rather than left there as a lie. */}
            <h2 className="text-lg font-semibold tracking-tight mb-4">Payment</h2>
            <div className="p-4 bg-bone border border-rule">
              <p className="text-sm font-medium text-charcoal">Credit or debit card</p>
              <p className="text-xs text-warm-gray mt-0.5">
                You will pay {`${formatPrice(depositNow)} on Stripe's secure page.`} We never see your card details.
              </p>
            </div>
          </div>

          <div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" name="termsAccepted" checked={form.termsAccepted} onChange={handleChange} className="mt-0.5 accent-[#C9A96E]" />
              <span className="text-xs text-warm-gray leading-relaxed">
                {/* This used to end "All orders are final — no cancellations or
                    refunds", which contradicts Terms section 6: we refund in
                    full if cutting has not started, and replace faulty pieces
                    free within 7 days. Consent text that overstates the
                    restriction is not enforceable and reads as a trap. */}
                I agree to the <Link href="/terms" className="text-sand hover:text-sand-dark underline">Terms of Service</Link> and <Link href="/privacy" className="text-sand hover:text-sand-dark underline">Privacy Policy</Link>. I understand each piece is made to order, that the full total is charged now, and that I cannot return it simply because I change my mind. If you have not started cutting, you will cancel and refund me in full. If it arrives faulty or damaged, you will replace it free within 7 days.
              </span>
            </label>
            {errors.terms && <p className="mt-1 text-red-500 text-xs">{errors.terms}</p>}
          </div>

          {/* A failed checkout has to be visible. It previously rendered the
              "Order Confirmed" screen instead — see failCheckout(). */}
          {errors.submit && (
            <div
              data-testid="checkout-error"
              role="alert"
              className="border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
            >
              {errors.submit}
            </div>
          )}

          <button data-testid="place-order" type="submit" disabled={submitting} className="w-full py-4 bg-ink text-paper text-sm tracking-wider uppercase hover:bg-sand-dark transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {submitting ? "Processing..." : "Pay " + formatPrice(depositNow) + " & Place Order"}
          </button>
        </form>

        <div className="lg:col-span-1">
          {/* Bone panel with no border, matching the cart's summary. A white
              card outlined on a paper ground was the only thing on either page
              still drawing a box around itself. */}
          <div className="bg-bone p-6 sticky top-24">
            <h2 className="font-heading text-lg font-semibold tracking-tight mb-4">Order Summary</h2>
            <div className="space-y-3 mb-4">
              {items.map((item) => (
                <div key={item.product.slug} className="flex items-center gap-3">
                  <div className="relative w-12 h-12 rounded-sm overflow-hidden bg-surface flex-shrink-0">
                    <ProductImage src={item.product.imageUrl} alt={item.product.name} sizes="48px" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-dark truncate">{item.product.name}</p>
                    <p className="text-xs text-warm-gray">Qty: {item.quantity}</p>
                    {item.personalisation && (
                      <p data-testid="checkout-engraving" className="text-xs text-warm-gray">
                        Engraving: <span className="text-dark font-medium">{item.personalisation}</span>
                      </p>
                    )}
                  </div>
                  <span className="text-xs font-medium text-dark">{formatPrice(item.product.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-border pt-3 space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-warm-gray">Subtotal</span><span>{formatPrice(subtotal)}</span></div>
              <div className="flex justify-between"><span className="text-warm-gray">{deliveryMethod === "pickup" ? "Pickup (Free)" : "Shipping"}</span><span className={shipping === 0 ? "text-[#5F7355] font-medium" : ""}>{shipping === 0 ? "Free" : formatPrice(shipping)}</span></div>
              <div className="flex justify-between font-medium border-t border-border pt-2"><span>Total</span><span>{formatPrice(total)}</span></div>
            </div>
            <div className="mt-4 p-3 bg-offwhite rounded-sm">
              <p className="text-xs text-charcoal font-medium mb-1">Payment Split</p>
              <p className="text-xs text-warm-gray">Now (card): {formatPrice(depositNow)} | On delivery: {formatPrice(payOnDelivery)}</p>
              {deliveryMethod === "pickup" && (
                <p className="text-xs text-[#5F7355] mt-1">Free pickup, no shipping fee.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
