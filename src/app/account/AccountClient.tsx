"use client";

import { useState } from "react";
import Link from "next/link";

interface Order {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total: number;
  deposit_amount: number;
  cod_amount: number;
  status: string;
  delivery_method: string;
  tracking_number?: string;
  created_at: string;
}

const STATUS_COLORS: Record<string, string> = {
  deposit_paid: "bg-yellow-50 text-yellow-700",
  processing: "bg-blue-50 text-blue-700",
  shipped: "bg-indigo-50 text-indigo-700",
  out_for_delivery: "bg-purple-50 text-purple-700",
  delivered: "bg-green-50 text-green-700",
  completed: "bg-emerald-50 text-emerald-700",
  cancelled: "bg-red-50 text-red-700",
};

export default function AccountClient() {
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [orders, setOrders] = useState<Order[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [loggedIn, setLoggedIn] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !phone.trim()) {
      setError("Please enter both email and phone number.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/orders?email=${encodeURIComponent(email.trim())}&phone=${encodeURIComponent(phone.trim())}`);
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else if (data.orders && data.orders.length > 0) {
        setOrders(data.orders);
        setCustomerName(data.orders[0].customer_name);
        setLoggedIn(true);
        // Save to localStorage for faster login next time
        try {
          localStorage.setItem("lebon-grace-account", JSON.stringify({ email: email.trim(), phone: phone.trim() }));
        } catch { /* ignore */ }
      } else {
        setError("No orders found with this email and phone number.");
      }
    } catch {
      setError("Something went wrong. Please try again.");
    }
    setLoading(false);
  };

  const formatPrice = (amount: number) =>
    `AED ${amount.toLocaleString("en", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatDate = (date: string) =>
    new Date(date).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" });

  // Login form
  if (!loggedIn) {
    return (
      <div className="min-h-screen bg-gray-50">
        <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 py-16 px-4">
          <div className="max-w-md mx-auto text-center">
            <h1 className="text-3xl font-bold text-white mb-3">My Account</h1>
            <p className="text-gray-400 text-sm">Sign in with your email and phone to view your orders.</p>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 -mt-8">
          <form onSubmit={handleLogin} className="bg-white rounded-2xl shadow-lg border border-gray-200 p-6">
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-[#C9A96E] focus:ring-2 focus:ring-[#C9A96E]/20 outline-none transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+971 58 828 6630"
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:border-[#C9A96E] focus:ring-2 focus:ring-[#C9A96E]/20 outline-none transition-all"
                />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm mb-4">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? "Searching..." : "View My Orders"}
            </button>

            <p className="text-center text-gray-400 text-xs mt-4">
              No account needed — just use the email and phone from your order.
            </p>
          </form>
        </div>
        <div className="h-16" />
      </div>
    );
  }

  // Account dashboard
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-2xl font-bold text-white">Welcome back, {customerName}!</h1>
          <p className="text-gray-400 text-sm mt-1">{email}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">Orders</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-[#16A34A]">{formatPrice(orders.reduce((s, o) => s + o.total, 0))}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">Total Spent</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-[#C9A96E]">{orders.filter(o => ["deposit_paid", "processing", "shipped", "out_for_delivery"].includes(o.status)).length}</p>
            <p className="text-xs text-gray-400 uppercase tracking-wider mt-1">Active</p>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900">Order History</h2>
          </div>

          {orders.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-gray-400 text-sm">No orders yet.</p>
              <Link href="/shop" className="mt-4 inline-block px-6 py-2 bg-[#16A34A] text-white rounded-lg text-sm font-medium hover:bg-[#15803D] transition-colors">
                Start Shopping
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-gray-50">
              {orders.map((order) => {
                const sc = STATUS_COLORS[order.status] || STATUS_COLORS.deposit_paid;
                return (
                  <div key={order.id} className="px-6 py-4 hover:bg-gray-50/50 transition-colors">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs text-gray-500">#{String(order.id).slice(0, 8)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${sc}`}>
                          {order.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className="text-xs text-gray-400">{formatDate(order.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="text-sm">
                        <span className="text-gray-500">Total: </span>
                        <span className="font-semibold text-gray-900">{formatPrice(order.total)}</span>
                        <span className="text-gray-400 mx-2">|</span>
                        <span className="text-[#16A34A]">Paid: {formatPrice(order.deposit_amount)}</span>
                        <span className="text-gray-400 mx-1">+</span>
                        <span className="text-[#C9A96E]">COD: {formatPrice(order.cod_amount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${order.delivery_method === "pickup" ? "bg-blue-50 text-blue-700" : "bg-gray-100 text-gray-600"}`}>
                          {order.delivery_method === "pickup" ? "Pickup" : "Delivery"}
                        </span>
                        {order.tracking_number && (
                          <span className="text-xs text-gray-400 font-mono">{order.tracking_number}</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="flex gap-3 justify-center mb-8">
          <Link href="/track" className="px-5 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors">
            Track an Order
          </Link>
          <Link href="/shop" className="px-5 py-2.5 bg-[#16A34A] text-white rounded-xl text-sm font-medium hover:bg-[#15803D] transition-colors">
            Continue Shopping
          </Link>
          <button
            onClick={() => { setLoggedIn(false); setOrders([]); }}
            className="px-5 py-2.5 border border-gray-200 text-gray-500 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
      <div className="h-8" />
    </div>
  );
}
