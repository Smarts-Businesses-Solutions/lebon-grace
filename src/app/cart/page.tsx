"use client";

import Link from "next/link";
import { useCart } from "@/lib/cart-context";
import { formatPrice } from "@/lib/products";
import CartRecoveryBanner from "@/components/CartRecoveryBanner";

export default function CartPage() {
  const { items, removeItem, updateQuantity, deliveryMethod, setDeliveryMethod, subtotal, shipping, total, depositNow, payOnDelivery } = useCart();

  if (items.length === 0) {
    return (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <svg className="w-16 h-16 mx-auto text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
        </svg>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Your Cart is Empty</h1>
        <p className="mt-3 text-gray-400 text-sm">Browse our collection of affordable essentials.</p>
        <Link href="/shop" className="mt-6 inline-flex items-center px-6 py-3 bg-[#16A34A] text-white text-sm font-semibold rounded-lg hover:bg-[#15803D] transition-colors">
          Shop Now
        </Link>
      </section>
    );
  }

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      <h1 className="text-3xl lg:text-4xl font-semibold tracking-tight mb-8">Shopping Cart</h1>

      <CartRecoveryBanner />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 lg:gap-12">
        {/* Cart Items */}
        <div className="lg:col-span-2 space-y-4">
          {items.map((item) => (
            <div key={item.product.slug} className="flex gap-4 sm:gap-6 p-4 bg-white border border-gray-100 rounded-xl">
              <Link href={"/shop/" + item.product.slug} className="flex-shrink-0">
                <div className="w-20 h-20 sm:w-24 sm:h-24 rounded-lg overflow-hidden bg-gray-100">
                  <img src={item.product.imageUrl} alt={item.product.name} className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.style.display = "none"; }}
                  />
                </div>
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={"/shop/" + item.product.slug}>
                  <h3 className="text-sm font-medium tracking-tight hover:text-[#16A34A] transition-colors truncate">{item.product.name}</h3>
                </Link>
                <p className="text-gray-400 text-xs mt-0.5">{item.product.variant}</p>
                <p className="text-gray-900 text-sm font-semibold mt-2">{formatPrice(item.product.price)}</p>
                <div className="mt-2 flex items-center justify-between">
                  <div className="flex items-center border border-gray-200 rounded-lg">
                    <button onClick={() => updateQuantity(item.product.slug, item.quantity - 1)} className="px-2.5 py-1.5 text-gray-500 hover:text-gray-700 transition-colors text-sm">−</button>
                    <span className="px-3 py-1.5 text-sm font-medium">{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.product.slug, item.quantity + 1)} className="px-2.5 py-1.5 text-gray-500 hover:text-gray-700 transition-colors text-sm">+</button>
                  </div>
                  <button onClick={() => removeItem(item.product.slug)} className="text-gray-400 text-xs hover:text-red-500 transition-colors">Remove</button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Order Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white border border-gray-100 rounded-xl p-6 sticky top-24">
            <h2 className="text-lg font-semibold tracking-tight mb-4">Order Summary</h2>

            {/* Delivery Method Toggle */}
            <div className="mb-5">
              <p className="text-sm font-medium text-gray-700 mb-3">How do you want to receive your order?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setDeliveryMethod("delivery")}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    deliveryMethod === "delivery"
                      ? "border-[#16A34A] bg-[#16A34A]/5 text-[#16A34A]"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <div className="text-lg mb-1">🚚</div>
                  <div className="text-xs font-semibold">Deliver to me</div>
                  <div className="text-[10px] mt-0.5">{subtotal >= 300 ? "Free" : "AED 25"}</div>
                </button>
                <button
                  onClick={() => setDeliveryMethod("pickup")}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${
                    deliveryMethod === "pickup"
                      ? "border-[#16A34A] bg-[#16A34A]/5 text-[#16A34A]"
                      : "border-gray-200 text-gray-500 hover:border-gray-300"
                  }`}
                >
                  <div className="text-lg mb-1">📍</div>
                  <div className="text-xs font-semibold">Pick up</div>
                  <div className="text-[10px] mt-0.5">Free</div>
                </button>
              </div>
              {deliveryMethod === "delivery" && subtotal < 300 && (
                <p className="text-gray-400 text-xs mt-2">Free shipping on orders over AED 300</p>
              )}
              {deliveryMethod === "pickup" && (
                <p className="text-[#16A34A] text-xs mt-2">✓ Free pickup — no shipping fee</p>
              )}
            </div>

            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-400">Subtotal ({items.length} items)</span>
                <span className="text-gray-900">{formatPrice(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-400">{deliveryMethod === "pickup" ? "Pickup" : "Shipping"}</span>
                <span className={shipping === 0 ? "text-[#16A34A] font-medium" : "text-gray-900"}>
                  {shipping === 0 ? "Free" : formatPrice(shipping)}
                </span>
              </div>
              <div className="border-t border-gray-100 pt-3 flex justify-between font-semibold">
                <span className="text-gray-900">Total</span>
                <span className="text-gray-900">{formatPrice(total)}</span>
              </div>
            </div>

            {/* Payment Breakdown */}
            <div className="mt-4 p-4 bg-gray-50 rounded-xl">
              <p className="text-xs text-gray-700 font-semibold mb-2">50/50 Payment</p>
              <div className="space-y-1.5 text-xs text-gray-500">
                <div className="flex justify-between">
                  <span>Pay now (card)</span>
                  <span className="text-gray-900 font-medium">{formatPrice(depositNow)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Pay on delivery</span>
                  <span className="text-gray-900 font-medium">{formatPrice(payOnDelivery)}</span>
                </div>
              </div>
            </div>

            <Link
              href="/checkout"
              className="mt-6 block w-full py-3.5 bg-[#16A34A] text-white text-sm font-semibold text-center rounded-xl hover:bg-[#15803D] transition-colors"
            >
              Proceed to Checkout
            </Link>

            <p className="text-center text-gray-400 text-xs mt-4">
              Secure payment via Stripe
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
