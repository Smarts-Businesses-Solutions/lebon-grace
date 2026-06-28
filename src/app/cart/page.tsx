"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/products";

export default function CartPage() {
  const { items, removeItem, updateQuantity, subtotal } = useCart();
  const shipping = subtotal >= 300 ? 0 : 25;
  const total = subtotal + shipping;
  const depositNow = Math.round(total / 2);
  const payOnDelivery = total - depositNow;

  if (items.length === 0) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <svg className="w-16 h-16 mx-auto text-border" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        <h1 className="mt-6 font-heading text-2xl font-semibold tracking-tight">Your Cart is Empty</h1>
        <p className="mt-3 text-warm-gray text-sm">Your cart is waiting. Browse our collection of affordable essentials.</p>
        <Link href="/shop" className="mt-6 inline-flex items-center px-6 py-3 bg-sand text-white text-sm tracking-wider uppercase font-medium rounded-sm hover:bg-sand-dark transition-colors">
          Shop Now
        </Link>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <h1 className="font-heading text-3xl lg:text-4xl font-semibold tracking-tight mb-8">Shopping Cart</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.product.slug} className="flex gap-4 sm:gap-6 p-4 bg-white border border-border rounded-sm">
              <Link href={"/shop/" + item.product.slug} className="flex-shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-sm flex items-center justify-center" style={{ backgroundColor: item.product.imagePlaceholder.bg }}>
                  <span className="font-heading text-xl sm:text-2xl font-semibold opacity-80" style={{ color: item.product.imagePlaceholder.bg === "#C9A96E" || item.product.imagePlaceholder.bg === "#D4BA85" ? "#2D2D2D" : "#FAF8F5" }}>
                    {item.product.imagePlaceholder.initials}
                  </span>
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={"/shop/" + item.product.slug}>
                  <h3 className="font-heading text-sm font-medium tracking-tight hover:text-sand transition-colors truncate">{item.product.name}</h3>
                </Link>
                <p className="text-warm-gray text-xs mt-0.5">{item.product.variant}</p>
                <p className="text-dark text-sm font-medium mt-2">{formatPrice(item.product.price)}</p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center border border-border rounded-sm">
                    <button
                      onClick={() => updateQuantity(item.product.slug, item.quantity - 1)}
                      className="px-2 py-1 text-charcoal hover:text-sand transition-colors text-xs"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>
                    </button>
                    <span className="px-3 py-1 text-xs font-medium">{item.quantity}</span>
                    <button
                      onClick={() => updateQuantity(item.product.slug, item.quantity + 1)}
                      className="px-2 py-1 text-charcoal hover:text-sand transition-colors text-xs"
                    >
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                    </button>
                  </div>
                  <button
                    onClick={() => removeItem(item.product.slug)}
                    className="text-warm-gray text-xs hover:text-red-500 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-border rounded-sm p-6 sticky top-24">
            <h2 className="font-heading text-lg font-semibold tracking-tight mb-4">Order Summary</h2>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-warm-gray">Subtotal</span>
                <span className="text-charcoal">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-warm-gray">Shipping</span>
                <span className="text-charcoal">{shipping === 0 ? "Free" : formatPrice(shipping)}</span>
              </div>
              {shipping > 0 && (
                <p className="text-warm-gray text-xs">Free shipping on orders over AED 300</p>
              )}
              <div className="border-t border-border pt-3 flex justify-between font-medium">
                <span className="text-dark">Total</span>
                <span className="text-dark">{formatPrice(total)}</span>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="mt-4 p-3 bg-offwhite rounded-sm">
              <p className="text-xs text-charcoal font-medium mb-1">50/50 Payment</p>
              <div className="space-y-1 text-xs text-warm-gray">
                <div className="flex justify-between">
                  <span>Pay now (50%)</span>
                  <span className="text-charcoal font-medium">{formatPrice(depositNow)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pay on delivery (50%)</span>
                  <span className="text-charcoal font-medium">{formatPrice(payOnDelivery)}</span>
                </div>
              </div>
            </div>

            <Link
              href="/checkout"
              className="mt-6 block w-full py-3.5 bg-sand text-white text-sm tracking-wider uppercase font-medium text-center rounded-sm hover:bg-sand-dark transition-colors"
            >
              Proceed to Checkout
            </Link>
            <Link href="/shop" className="mt-3 block text-center text-sand text-sm font-medium hover:text-sand-dark transition-colors">
              Continue Shopping
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
