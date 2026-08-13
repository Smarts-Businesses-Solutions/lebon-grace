"use client";

import { useState } from "react";
import WhatsAppLink from "@/components/WhatsAppLink";
import Link from "next/link";
import { statusLabel, STATUS_PRESENTATION, isOrderStatus } from "@/lib/order-status";

const STATUS_STEPS = [
  { key: "deposit_paid", label: "Payment Confirmed", icon: "💳" },
  { key: "processing", label: "Preparing", icon: "📦" },
  { key: "shipped", label: "Shipped", icon: "🚚" },
  { key: "out_for_delivery", label: "Out for Delivery", icon: "🛵" },
  { key: "delivered", label: "Delivered", icon: "✅" },
];

/**
 * Presentation comes from STATUS_PRESENTATION, which is exhaustive over
 * OrderStatus at compile time. The local map this replaces covered six of the
 * ten statuses the database accepts; the other four fell to `?? -1` and drew a
 * 0% pipeline with no step lit, so a refunded customer saw what reads as an
 * order about to start — in the same blue used for "in progress".
 */

interface OrderData {
  id: string;
  customer_name: string;
  customer_phone: string;
  total: number;
  deposit_amount: number;
  cod_amount: number;
  status: string;
  delivery_method: string;
  tracking_number?: string;
  courier_name?: string;
  created_at: string;
  updated_at: string;
}

export default function TrackClient() {
  const [orderId, setOrderId] = useState("");
  const [phone, setPhone] = useState("");
  const [order, setOrder] = useState<OrderData | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setOrder(null);
    setSearched(true);

    if (!orderId.trim() || !phone.trim()) {
      setError("Please enter both order ID and phone number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/orders?id=${encodeURIComponent(orderId.trim())}&phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else if (data.order) {
        setOrder(data.order);
      } else {
        setError("Order not found. Please check your order ID and phone number.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const formatPrice = (amount: number) =>
    `AED ${amount.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-AE", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const presentation = order && isOrderStatus(order.status) ? STATUS_PRESENTATION[order.status] : null;
  // null step = a terminal state that is NOT on the pipeline. Drawing one as a
  // pipeline at 0% is the defect this replaces.
  const currentStep = presentation?.step ?? -1;
  const isTerminal = presentation !== null && presentation.step === null;

  return (
    <div className="min-h-screen bg-paper">
      {/* Hero */}
      <div className="bg-paper border-b border-rule py-16 px-4">
        <div className="max-w-2xl mx-auto text-center">
          <h1 className="font-heading text-4xl sm:text-5xl text-ink mb-3">Track your order</h1>
          <p className="text-ink-soft/80 text-sm">Enter your order ID and the phone number you ordered with.</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 -mt-8">
        {/* Search Form */}
        <form onSubmit={handleSearch} className="bg-bone p-6 mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1">Order ID</label>
              <input
                data-testid="track-order-id"
                type="text"
                value={orderId}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder="e.g. abc12345"
                className="w-full px-4 py-3 border border-rule text-sm focus:border-[#A8874D] focus:ring-2 focus:ring-[#A8874D]/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-ink-soft mb-1">Phone Number</label>
              <input
                data-testid="track-phone"
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+971 5X XXX XXXX"
                className="w-full px-4 py-3 border border-rule text-sm focus:border-[#A8874D] focus:ring-2 focus:ring-[#A8874D]/20 outline-none transition-all"
              />
            </div>
          </div>
          <button
            data-testid="track-submit"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 bg-ink text-paper text-sm tracking-wide hover:bg-sand-dark transition-colors disabled:opacity-50"
          >
            {loading ? "Searching..." : "Track Order"}
          </button>
        </form>

        {/* Error */}
        {error && (
          <div data-testid="track-error" className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Order Found */}
        {order && (
          <div className="space-y-6">
            {/* Status Progress */}
            <div className="bg-bone p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="font-semibold text-ink">Order Status</h2>
                <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${
                  presentation?.tone === "done"
                    ? "bg-green-50 text-green-700"
                    : presentation?.tone === "negative"
                    ? "bg-red-50 text-red-700"
                    : presentation?.tone === "neutral"
                    ? "bg-paper-deep text-ink-soft"
                    : "bg-blue-50 text-blue-700"
                }`}>
                  {statusLabel(order.status)}
                </span>
              </div>

              {isTerminal ? (
                <div data-testid="track-terminal" className="rounded-xl border border-rule bg-paper p-5">
                  <h3 className="font-heading text-lg font-semibold text-ink">{presentation!.terminalTitle}</h3>
                  <p className="mt-2 text-sm text-ink-soft leading-relaxed">{presentation!.terminalBody}</p>
                  <div className="mt-4"><WhatsAppLink message={`Hi, about order #${String(order.id).slice(0, 8)}`} className="inline-flex items-center px-5 py-2.5 bg-sand text-ink text-sm tracking-wider uppercase font-medium rounded-sm hover:bg-sand-dark transition-colors">
                    Message us on WhatsApp
                  </WhatsAppLink></div>
                </div>
              ) : (
              <>
              {/* Progress Bar */}
              <div className="relative mb-8">
                <div className="absolute top-5 left-0 right-0 h-1 bg-paper-deep rounded">
                  <div
                    className="h-1 bg-[#23201C] rounded transition-all duration-500"
                    style={{ width: `${currentStep >= 0 ? ((currentStep + 1) / STATUS_STEPS.length) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex justify-between relative">
                  {STATUS_STEPS.map((step, i) => {
                    const isActive = i <= currentStep;
                    const isCurrent = i === currentStep;
                    return (
                      <div key={step.key} className="flex flex-col items-center" style={{ width: `${100 / STATUS_STEPS.length}%` }}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${
                          isActive
                            ? isCurrent
                              ? "bg-[#23201C] text-white ring-4 ring-[#A8874D]/20"
                              : "bg-[#23201C] text-white"
                            : "bg-paper-deep text-ink-muted/80"
                        }`}>
                          {step.icon}
                        </div>
                        <span className={`text-[11px] mt-2 text-center font-medium ${isActive ? "text-ink" : "text-ink-muted/80"}`}>
                          {step.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
              </>
              )}

              {/* Tracking Info */}
              {order.tracking_number && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <p className="text-sm font-medium text-blue-900">Tracking Number</p>
                  <p className="text-sm text-blue-700 font-mono mt-1">{order.tracking_number}</p>
                  {order.courier_name && <p className="text-xs text-blue-600 mt-1">Courier: {order.courier_name}</p>}
                </div>
              )}
            </div>

            {/* Order Details */}
            <div className="bg-bone p-6">
              <h2 className="font-semibold text-ink mb-4">Order Details</h2>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between"><span className="text-ink-muted">Order ID</span><span className="font-mono text-ink">#{String(order.id).slice(0, 8)}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">Customer</span><span className="text-ink">{order.customer_name}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">Phone</span><span className="text-ink">{order.customer_phone}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">Delivery</span><span className="text-ink">{order.delivery_method === "pickup" ? "Pickup" : "Delivery"}</span></div>
                <div className="flex justify-between"><span className="text-ink-muted">Ordered</span><span className="text-ink">{formatDate(order.created_at)}</span></div>
                <hr className="border-rule" />
                <div className="flex justify-between"><span className="text-ink-muted">Total</span><span className="font-semibold text-ink">{formatPrice(order.total)}</span></div>
                {/*
                  This said "Paid (card) AED 2.00" and "Pay on delivery AED
                  0.00" — the 50% deposit and cash-on-delivery model, deleted
                  from checkout months ago. A customer reading their own order
                  saw a line implying they might still owe something.
                */}
                <div className="flex justify-between"><span className="text-[#5F7355]">✓ Paid in full</span><span className="font-semibold text-[#5F7355]">{formatPrice(order.total)}</span></div>
              </div>
            </div>

            {/* Help */}
            <div className="bg-bone p-6 text-center">
              <p className="text-sm text-ink-soft/85 mb-3">Need help with your order?</p>
              <div className="flex gap-3 justify-center">
                <Link href="/contact" className="px-4 py-2 bg-paper-deep text-ink-soft text-sm font-medium hover:bg-paper-deep transition-colors">
                  Contact Us
                </Link>
                <WhatsAppLink
                  message={`Hi, I need help with my order #${String(order.id).slice(0, 8)}`}
                  className="px-4 py-2 bg-[#25D366] text-white text-sm font-medium hover:bg-[#1DA851] transition-colors"
                >
                  WhatsApp Us
                </WhatsAppLink>
              </div>
            </div>
          </div>
        )}

        {/* Not Found after search */}
        {searched && !order && !error && !loading && (
          <div className="bg-bone p-8 text-center">
            <p className="text-ink-muted text-sm">Enter your order details above to track your order.</p>
          </div>
        )}
      </div>

      {/* Bottom spacing */}
      <div className="h-16" />
    </div>
  );
}
