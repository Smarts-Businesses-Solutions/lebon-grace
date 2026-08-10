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
        /*
         * The credential is deliberately NOT persisted (RC-02).
         *
         * This wrote `{email, phone}` to localStorage "for faster login next
         * time" — and nothing ever read it back. There is no `getItem` for this
         * key anywhere in the codebase, so the promised convenience did not
         * exist: it stored the exact pair that unlocks a customer's whole order
         * history, permanently, on whatever machine they happened to use, and
         * bought nothing at all.
         *
         * If a remember-me is ever wanted, it should be opt-in and should store
         * the e-mail only — the address is the tedious half to type, and the
         * phone is the half that makes it a credential.
         */
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
        <div className="bg-paper border-b border-rule py-16 px-4">
          <div className="max-w-md mx-auto text-center">
            <h1 className="font-heading text-4xl text-ink mb-3">My account</h1>
            <p className="text-ink-soft text-sm">Sign in with your email and phone to view your orders.</p>
          </div>
        </div>

        <div className="max-w-md mx-auto px-4 -mt-8">
          <form onSubmit={handleLogin} className="bg-bone p-6">
            <div className="space-y-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  data-testid="account-email"
                  className="w-full px-4 py-3 border border-rule text-sm focus:border-[#C9A96E] focus:ring-2 focus:ring-[#C9A96E]/20 outline-none transition-all"
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink-soft mb-1">Phone Number</label>
                {/*
                  The placeholder read "WhatsApp us" — copy from the contact
                  widget that had leaked into the one field where the format
                  actually matters. This lookup has no account behind it: the
                  number must be the one used at checkout, and it is matched on
                  the last eight digits, so an example is the useful thing to
                  show. Mirrors "you@example.com" above.
                */}
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="050 123 4567"
                  data-testid="account-phone"
                  className="w-full px-4 py-3 border border-rule text-sm focus:border-[#C9A96E] focus:ring-2 focus:ring-[#C9A96E]/20 outline-none transition-all"
                />
              </div>
            </div>

            {error && (
              <div
                data-testid="account-error"
                className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 text-sm mb-4"
              >
                {error}
              </div>
            )}

            {/*
              Test ids, matching TrackClient. /account had none, and no e2e test
              touched it — the page that returns the LARGEST payload on the site
              (every order for an email and phone, with addresses) had no
              end-to-end coverage at all, while /track next door had five ids and
              a suite. Targeting it by input type is not viable: the header
              search box is also a text input and the WhatsApp float is another
              tel input, so a type selector matches the wrong element.
            */}
            <button
              type="submit"
              data-testid="account-submit"
              disabled={loading}
              className="w-full py-3.5 bg-ink text-paper text-sm tracking-wide hover:bg-sand-dark transition-colors disabled:opacity-50"
            >
              {loading ? "Searching..." : "View My Orders"}
            </button>

            <p className="text-center text-ink-soft text-xs mt-4">
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
      <div className="bg-paper border-b border-rule py-12 px-4">
        <div className="max-w-4xl mx-auto">
          <h1 className="font-heading text-3xl text-ink">Welcome back, {customerName}</h1>
          <p className="text-ink-soft text-sm mt-1">{email}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 -mt-6">
        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-bone shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-ink">{orders.length}</p>
            <p className="text-xs text-ink-muted/80 uppercase tracking-wider mt-1">Orders</p>
          </div>
          <div className="bg-bone shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-[#A8874D]">{formatPrice(orders.reduce((s, o) => s + o.total, 0))}</p>
            <p className="text-xs text-ink-muted/80 uppercase tracking-wider mt-1">Total Spent</p>
          </div>
          <div className="bg-bone shadow-sm p-4 text-center">
            <p className="text-2xl font-bold text-[#C9A96E]">{orders.filter(o => ["deposit_paid", "processing", "shipped", "out_for_delivery"].includes(o.status)).length}</p>
            <p className="text-xs text-ink-muted/80 uppercase tracking-wider mt-1">Active</p>
          </div>
        </div>

        {/* Orders List */}
        <div className="bg-bone overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-rule">
            <h2 className="font-semibold text-ink">Order History</h2>
          </div>

          {orders.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="text-ink-soft text-sm">No orders yet.</p>
              <Link href="/shop" className="mt-4 inline-block px-6 py-3 bg-ink text-paper text-sm tracking-wide hover:bg-sand-dark transition-colors">
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
                        <span className="font-mono text-xs text-ink-muted">#{String(order.id).slice(0, 8)}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium capitalize ${sc}`}>
                          {order.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <span className="text-xs text-ink-muted/80">{formatDate(order.created_at)}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      {/* Orders are paid in full at checkout, so cod_amount is
                          always 0. This used to render "Paid: AED 15.00 + COD:
                          AED 0.00" on every row, left over from the 50/50
                          deposit model that was removed. The balance is only
                          worth showing on old orders that actually have one. */}
                      <div className="text-sm">
                        <span className="text-ink-muted">Total: </span>
                        <span className="font-semibold text-ink">{formatPrice(order.total)}</span>
                        {order.cod_amount > 0 && (
                          <>
                            <span className="text-ink-muted/80 mx-2">|</span>
                            <span className="text-[#C9A96E]">
                              Balance due: {formatPrice(order.cod_amount)}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-xs ${order.delivery_method === "pickup" ? "bg-blue-50 text-blue-700" : "bg-paper-deep text-ink-soft/85"}`}>
                          {order.delivery_method === "pickup" ? "Pickup" : "Delivery"}
                        </span>
                        {order.tracking_number && (
                          <span className="text-xs text-ink-muted/80 font-mono">{order.tracking_number}</span>
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
          <Link href="/track" className="px-5 py-2.5 bg-paper-deep text-ink-soft text-sm font-medium hover:bg-paper-deep transition-colors">
            Track an Order
          </Link>
          <Link href="/shop" className="px-5 py-2.5 bg-[#23201C] text-white text-sm font-medium hover:bg-[#A8874D] transition-colors">
            Continue Shopping
          </Link>
          <button
            onClick={() => { setLoggedIn(false); setOrders([]); }}
            className="px-5 py-2.5 border border-rule text-ink-muted text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Sign Out
          </button>
        </div>
      </div>
      <div className="h-8" />
    </div>
  );
}
