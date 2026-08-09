"use client";

import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import { useCart, lineId, UAE_DELIVERY, FREE_DELIVERY_OVER} from "@/lib/cart-context";
import { formatPrice } from "@/lib/products";
import CartRecoveryBanner from "@/components/CartRecoveryBanner";
import { countOf } from "@/lib/plural";

export default function CartPage() {
  const { items, removeItem, updateQuantity, deliveryMethod, setDeliveryMethod, subtotal, shipping, total, depositNow } = useCart();

  if (items.length === 0) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Your Cart is Empty</h1>
        <p className="mt-3 text-ink-muted text-sm">Browse our collection of affordable essentials.</p>
        <Link href="/shop" className="mt-6 inline-flex items-center px-7 py-3.5 bg-ink text-paper text-sm tracking-wide hover:bg-sand-dark transition-colors">
          Shop Now
        </Link>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight mb-8">Shopping Cart</h1>

      <CartRecoveryBanner />

      {/* Free delivery progress. Every 300 in this block was hardcoded while the
          basket charged on FREE_DELIVERY_OVER, so the bar asked for twice the
          spend that actually earns free delivery. */}
      {deliveryMethod === "delivery" && subtotal < FREE_DELIVERY_OVER && subtotal > 0 && (
        <div className="mb-6 p-4 bg-[#23201C]/5 border border-[#A8874D]/10 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm text-gray-600">
              Add <strong className="text-sage">{formatPrice(FREE_DELIVERY_OVER - subtotal)}</strong> more for <strong>free delivery</strong>
            </p>
            <span className="text-xs text-ink-muted">{Math.round((subtotal / FREE_DELIVERY_OVER) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div className="bg-[#23201C] h-2 rounded-full transition-all" style={{ width: `${Math.min((subtotal / FREE_DELIVERY_OVER) * 100, 100)}%` }} />
          </div>
        </div>
      )}
      {deliveryMethod === "delivery" && subtotal >= FREE_DELIVERY_OVER && (
        <div className="mb-6 p-3 bg-[#23201C]/10 border border-[#A8874D]/20 rounded-xl text-center">
          <p className="text-sm font-medium text-sage">Your delivery is free.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={lineId(item)} className="flex gap-4 sm:gap-6 py-6 border-b border-rule">
              <Link href={"/shop/" + item.product.slug} className="flex-shrink-0">
                <div className="relative w-24 h-24 sm:w-28 sm:h-28 overflow-hidden bg-paper-deep">
                  <ProductImage src={item.product.imageUrl} alt={item.product.name} sizes="96px" />
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={"/shop/" + item.product.slug}>
                  <h3 className="text-sm font-medium tracking-tight hover:text-[#A8874D] transition-colors truncate">{item.product.name}</h3>
                </Link>
                <p className="text-ink-muted text-xs mt-0.5">{item.product.variant}</p>
                <p className="text-gray-900 text-sm font-semibold mt-2">{formatPrice(item.product.price)}</p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center border border-rule">
                    <button aria-label="Decrease quantity" onClick={() => updateQuantity(lineId(item), item.quantity - 1)} className="min-w-11 min-h-11 inline-flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors text-sm">−</button>
                    <span className="px-3 py-1.5 text-sm font-medium">{item.quantity}</span>
                    <button data-testid="cart-qty-inc" aria-label="Increase quantity" onClick={() => updateQuantity(lineId(item), item.quantity + 1)} className="min-w-11 min-h-11 inline-flex items-center justify-center text-gray-500 hover:text-gray-700 transition-colors text-sm">+</button>
                  </div>
                  <button onClick={() => removeItem(lineId(item))} className="text-ink-muted text-xs hover:text-red-500 transition-colors">Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-bone p-6 sticky top-24">
            <h2 className="text-lg font-semibold tracking-tight mb-4">Order Summary</h2>

            {/* Delivery Method Toggle */}
            <div className="mb-5">
              <p className="text-sm font-medium text-gray-700 mb-3">How do you want to receive your order?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDeliveryMethod("delivery")}
                  className={`p-4 border text-center transition-all ${
                    deliveryMethod === "delivery"
                      ? "border-ink bg-paper-deep text-ink"
                      : "border-rule text-ink-muted hover:border-sand"
                  }`}
                >
                  <div className="font-heading text-sm">Deliver to me</div>
                  <div className="text-[10px] mt-0.5">{subtotal >= FREE_DELIVERY_OVER ? "Free" : `AED ${UAE_DELIVERY}`}</div>
                </button>
                <button
                  onClick={() => setDeliveryMethod("pickup")}
                  className={`p-4 border text-center transition-all ${
                    deliveryMethod === "pickup"
                      ? "border-ink bg-paper-deep text-ink"
                      : "border-rule text-ink-muted hover:border-sand"
                  }`}
                >
                  <div className="font-heading text-sm">Pick up</div>
                  <div className="text-[10px] mt-0.5">Free</div>
                </button>
              </div>
              {/* Hardcoded 300 here while the line above charges on
                  FREE_DELIVERY_OVER, so a basket of AED 200 already had free
                  delivery and was still being told it needed AED 300. */}
              {deliveryMethod === "delivery" && subtotal < FREE_DELIVERY_OVER && (
                <p className="text-ink-muted text-xs mt-2">
                  Free delivery on orders over {formatPrice(FREE_DELIVERY_OVER)}
                </p>
              )}
              {deliveryMethod === "pickup" && (
                <p className="text-sage text-xs mt-2">Free pickup, no shipping fee.</p>
              )}
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-ink-muted">Subtotal ({countOf(items.length, "item")})</span>
                <span data-testid="cart-subtotal" className="text-gray-900">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-ink-muted">{deliveryMethod === "pickup" ? "Pickup" : "Shipping"}</span>
                <span className={shipping === 0 ? "text-[#A8874D] font-medium" : "text-gray-900"}>
                  <span data-testid="cart-shipping">{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
                </span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between font-semibold">
                <span className="text-gray-900">Total</span>
                <span data-testid="cart-total" className="text-gray-900">{formatPrice(total)}</span>
              </div>
            </div>

            {/* This was a two-line split, "Pay now (card)" over "Pay on
                delivery", left from the 50/50 deposit model. payOnDelivery is
                hardcoded to 0 in cart-context, so every basket showed a
                meaningless "Pay on delivery AED 0" row. Same remnant as the one
                removed from the account page. */}
            <div className="mt-5 pt-4 border-t border-rule">
              <p className="text-xs text-gray-700 font-semibold mb-2">Made to Order</p>
              <p className="text-xs text-gray-500 leading-relaxed">
                You pay the full {formatPrice(depositNow)} now by card. We start cutting your
                piece once payment clears, and it is ready in 2 to 3 working days.
              </p>
            </div>

            <Link
              href="/checkout"
              className="mt-6 block w-full py-3.5 bg-[#23201C] text-white text-sm font-semibold text-center rounded-xl hover:bg-[#A8874D] transition-colors"
            >
              Proceed to Checkout
            </Link>

            <p className="text-center text-ink-muted text-xs mt-4">
              Secure payment via Stripe
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
