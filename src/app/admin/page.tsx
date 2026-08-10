"use client";

import { useState, useEffect, useMemo } from "react";
import ProductImage from "@/components/ProductImage";
import Link from "next/link";
import OperationsDashboard from "@/components/OperationsDashboard";
import { SETTABLE_STATUSES, notifiesCustomer } from "@/lib/order-status";

const CATEGORIES = [
  "Jewelry", "Home Decor", "Fashion & Accessories", "Pet Supplies",
  "Kitchen & Dining", "Beauty & Grooming", "Home Storage", "Bags & Travel",
  "Stationery & Gifts", "Desk & Office", "Garden & Outdoor", "Phone & Tech",
  "Fitness & Wellness", "Candles & Aroma", "Seasonal & Gifts",
  "Keychains & Tags", "Kids & Baby",
];

// Must stay a subset of the CHECK constraint in
// supabase/migrations/0002_add_constraints.sql — anything else the database
// rejects outright. `cancelled` was missing here despite having full email and
// WhatsApp copy and a branch in TrackClient, so the one status a customer most
// needs telling about was the one nobody could set.
// Derived from the single source of truth rather than hand-maintained here.
// This was a verbatim copy: correct, but only by attention — a status added to
// order-status.ts would silently not appear in this dropdown. `paid` is
// excluded deliberately (see SETTABLE_STATUSES): it is not a queue status, so
// an order moved into it vanishes from the cutting queue while still looking
// paid to the customer, which is B-7.
const ORDER_STATUSES: readonly string[] = SETTABLE_STATUSES;

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  deposit_paid: { bg: "bg-yellow-50", text: "text-yellow-700" },
  processing: { bg: "bg-blue-50", text: "text-blue-700" },
  shipped: { bg: "bg-indigo-50", text: "text-indigo-700" },
  out_for_delivery: { bg: "bg-purple-50", text: "text-purple-700" },
  delivered: { bg: "bg-green-50", text: "text-green-700" },
  completed: { bg: "bg-emerald-50", text: "text-emerald-700" },
  failed: { bg: "bg-red-50", text: "text-red-700" },
  refunded: { bg: "bg-paper", text: "text-ink-soft" },
};

interface Product { slug: string; name: string; price: number; category: string; stock: number; imageUrl: string; cjPid?: string; cjPrice?: string; description?: string; }
interface Order { id: string; stripe_session_id?: string; customer_name: string; customer_email?: string; customer_phone: string; total: number; deposit_amount: number; cod_amount: number; status: string; delivery_method?: string; tracking_number?: string; courier_name?: string; created_at: string; }
type TabType = "dashboard" | "products" | "orders" | "analytics";

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "info" });
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");
  const [productFilter, setProductFilter] = useState("All");
  const [productSearch, setProductSearch] = useState("");
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editPrice, setEditPrice] = useState(0);
  const [editStock, setEditStock] = useState(0);
  const [orderStatusFilter, setOrderStatusFilter] = useState("All");
  const [orderSearch, setOrderSearch] = useState("");
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  const showMessage = (text: string, type = "info") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "info" }), 3000);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) { setAuthenticated(true); setPassword(""); }
      else { showMessage("Incorrect password", "error"); }
    } catch { showMessage("Login failed — try again", "error"); }
  };

  const handleLogout = async () => {
    try { await fetch("/api/admin/login", { method: "DELETE" }); } catch { /* ignore */ }
    setAuthenticated(false);
  };

  // Restore an existing admin session (httpOnly cookie) on mount, so a refresh
  // doesn't force re-login.
  useEffect(() => {
    let active = true;
    fetch("/api/admin/login")
      .then((r) => r.json())
      .then((d) => { if (active && d?.authenticated) setAuthenticated(true); })
      .catch(() => { /* not logged in */ });
    return () => { active = false; };
  }, []);

  const loadProducts = async () => {
    try { setLoading(true); const res = await fetch("/api/products"); const d = await res.json(); setProducts(Array.isArray(d) ? d : []); }
    catch { showMessage("Failed to load products", "error"); }
    finally { setLoading(false); }
  };

  const loadOrders = async () => {
    try { const res = await fetch("/api/orders"); const d = await res.json(); setOrders(Array.isArray(d) ? d : []); }
    catch { /* no orders yet */ }
  };

  // Fetch-on-authenticate. The setState the rule objects to is `setLoading(true)`
  // inside loadProducts; there is no render-time equivalent because the request
  // must not fire until the session exists.
  // eslint-disable-next-line react-hooks/set-state-in-effect, react-hooks/exhaustive-deps
  useEffect(() => { if (authenticated) { loadProducts(); loadOrders(); } }, [authenticated]);

  const saveProduct = async (slug: string, updates: Partial<Product>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/products", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug, ...updates }) });
      if (res.ok) { showMessage("Product updated", "success"); await loadProducts(); setEditSlug(null); }
      else showMessage("Save failed", "error");
    } catch { showMessage("Save failed", "error"); }
    setSaving(false);
  };

  const deleteProduct = async (slug: string) => {
    if (!confirm("Delete this product permanently?")) return;
    try { await fetch("/api/products", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ slug }) }); showMessage("Product deleted", "success"); await loadProducts(); }
    catch { showMessage("Delete failed", "error"); }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    /*
     * Confirm anything the customer will hear about (AD-01).
     *
     * This is a `<select>` firing on `onChange`, so a mis-click, a stray scroll
     * over the control, or a keyboard arrow changes an order's status
     * immediately — and six of these statuses e-mail the customer. "Your order
     * has been cancelled" or "Refund issued" cannot be taken back.
     *
     * It was harmless until 2026-08-10 only because nothing was being
     * delivered: every send came back 403 from an unverified domain (B-30). The
     * domain is verified now, so the same mis-click reaches a real inbox.
     *
     * Statuses that send nothing are left immediate — a confirmation on every
     * change trains the operator to dismiss all of them, and then the one that
     * matters is dismissed too (L-5).
     */
    if (notifiesCustomer(newStatus)) {
      const readable = newStatus.replace(/_/g, " ");
      if (!confirm(`Email the customer that their order is "${readable}"?\n\nThis sends immediately and cannot be undone.`)) {
        // The <select> already shows the new value optimistically; put it back.
        setOrders((prev) => [...prev]);
        return;
      }
    }

    setUpdatingOrderId(orderId);
    try {
      const res = await fetch("/api/orders", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: orderId, status: newStatus }) });
      if (res.ok) { setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o))); showMessage(`Order updated to ${newStatus.replace(/_/g, " ")}`, "success"); }
      else showMessage("Failed to update order", "error");
    } catch { showMessage("Failed to update order", "error"); }
    setUpdatingOrderId(null);
  };

  const catCounts: Record<string, number> = useMemo(() => {
    const c: Record<string, number> = {}; products.forEach((p) => { c[p.category] = (c[p.category] || 0) + 1; }); return c;
  }, [products]);
  const filteredProducts = useMemo(() => products.filter((p) => {
    const mc = productFilter === "All" || p.category === productFilter;
    const ms = !productSearch || p.name.toLowerCase().includes(productSearch.toLowerCase());
    return mc && ms;
  }), [products, productFilter, productSearch]);
  const filteredOrders = useMemo(() => orders.filter((o) => {
    const ms = orderStatusFilter === "All" || o.status === orderStatusFilter;
    const msearch = !orderSearch || (o.customer_name || "").toLowerCase().includes(orderSearch.toLowerCase()) || (o.customer_phone || "").includes(orderSearch);
    return ms && msearch;
  }), [orders, orderStatusFilter, orderSearch]);
  const orderStatusCounts: Record<string, number> = useMemo(() => {
    const c: Record<string, number> = { All: orders.length }; ORDER_STATUSES.forEach((s) => { c[s] = 0; }); orders.forEach((o) => { if (o.status && c[o.status] !== undefined) c[o.status]++; }); return c;
  }, [orders]);
  const priceRanges = useMemo(() => {
    const r = [{ l: "AED 0-25", m: 0, M: 25 }, { l: "AED 25-50", m: 25, M: 50 }, { l: "AED 50-100", m: 50, M: 100 }, { l: "AED 100-200", m: 100, M: 200 }, { l: "AED 200+", m: 200, M: 9999 }];
    return r.map((x) => ({ ...x, count: products.filter((p) => p.price >= x.m && p.price < x.M).length }));
  }, [products]);

  // LOGIN
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-ink via-ink-soft to-ink flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="bg-bone p-8 rounded-2xl shadow-2xl w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-sand to-sand-dark rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <span className="text-bone text-2xl font-bold">LG</span>
            </div>
            <h1 className="text-2xl font-bold text-ink">Lebon Grace</h1>
            <p className="text-ink-soft text-sm mt-1">Admin Dashboard</p>
          </div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter admin password"
            className="w-full px-4 py-3 border border-rule rounded-xl text-sm mb-4 focus:border-sand-dark focus:ring-2 focus:ring-sand-dark/20 outline-none transition-all" autoFocus />
          {message.text && <p className="text-red-700 text-sm mb-3">{message.text}</p>}
          <button type="submit" className="w-full py-3 bg-ink text-bone rounded-xl text-sm font-semibold hover:bg-ink-soft transition-colors">Sign In</button>
          <p className="text-center text-ink-soft text-xs mt-6"><Link href="/" className="text-ink underline underline-offset-2 hover:text-sand-dark">← Back to store</Link></p>
        </form>
      </div>
    );
  }

  // MAIN DASHBOARD
  return (
    <div className="min-h-screen bg-paper">
      <header className="bg-ink border-b border-ink-soft sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-sand to-sand-dark rounded-lg flex items-center justify-center"><span className="text-bone text-sm font-bold">LG</span></div>
            <h1 className="text-lg font-bold text-bone">Lebon Grace</h1>
            <span className="px-2 py-0.5 bg-ink/20 text-sand-dark rounded text-[10px] font-semibold uppercase tracking-wider">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            {message.text && <span className={`text-sm font-medium ${message.type === "error" ? "text-red-400" : "text-sand-dark"}`}>{message.text}</span>}
            <Link href="/" className="text-sm text-sand hover:text-bone transition-colors">Store</Link>
            <button onClick={handleLogout} className="text-sm text-sand hover:text-bone transition-colors">Log out</button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-bone rounded-xl p-1 border border-rule w-fit shadow-sm">
          {(["dashboard", "products", "orders", "analytics"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? "bg-ink text-bone shadow-sm" : "text-ink-soft hover:text-ink hover:bg-paper"}`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* DASHBOARD — Operations Metrics */}
        {activeTab === "dashboard" && <OperationsDashboard />}

        {/* PRODUCTS */}
        {activeTab === "products" && (
          <>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex flex-wrap gap-2 flex-1">
                <button onClick={() => setProductFilter("All")} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${productFilter === "All" ? "bg-ink text-bone" : "bg-bone text-ink-soft border border-rule"}`}>All ({products.length})</button>
                {CATEGORIES.filter(c => catCounts[c]).map((cat) => (
                  <button key={cat} onClick={() => setProductFilter(cat)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${productFilter === cat ? "bg-ink text-bone" : "bg-bone text-ink-soft border border-rule"}`}>{cat} ({catCounts[cat] || 0})</button>
                ))}
              </div>
              <input type="text" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search products..." className="px-4 py-2 border border-rule rounded-xl text-sm w-full sm:w-64 focus:border-sand-dark outline-none" />
            </div>
            <div className="bg-bone rounded-xl border border-rule shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-paper border-b border-rule/60">
                    <th className="text-left px-5 py-3 font-semibold text-ink-soft text-xs uppercase">Product</th>
                    <th className="text-left px-5 py-3 font-semibold text-ink-soft text-xs uppercase">Category</th>
                    <th className="text-left px-5 py-3 font-semibold text-ink-soft text-xs uppercase">Price</th>
                    <th className="text-left px-5 py-3 font-semibold text-ink-soft text-xs uppercase">Stock</th>
                    <th className="text-right px-5 py-3 font-semibold text-ink-soft text-xs uppercase">Actions</th>
                  </tr></thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-ink-soft">{loading ? "Loading..." : "No products found"}</td></tr>
                    ) : filteredProducts.map((p) => (
                      <tr key={p.slug} className="border-b border-rule/40 hover:bg-paper/50 transition-colors">
                        <td className="px-5 py-3"><div className="flex items-center gap-3">
                          {/* This table lists the whole catalogue, so it pulled a
                              full-size original per row. At 40px rendered that
                              was the heaviest page on the site. */}
                          <div className="relative w-10 h-10 rounded-lg overflow-hidden bg-paper-deep flex-shrink-0">
                            <ProductImage src={p.imageUrl} alt={p.name} sizes="40px" />
                          </div>
                          {editSlug === p.slug ? <input value={editName} onChange={(e) => setEditName(e.target.value)} className="border border-rule rounded-lg px-3 py-1.5 text-sm w-full focus:border-sand-dark outline-none" /> : <span className="text-ink font-medium text-sm">{p.name}</span>}
                        </div></td>
                        <td className="px-5 py-3">{editSlug === p.slug ? (
                          <select aria-label="Product category" value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="border border-rule rounded-lg px-3 py-1.5 text-sm outline-none">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                        ) : <span className="inline-block px-2.5 py-1 bg-paper-deep rounded-lg text-xs font-medium text-ink-soft">{p.category}</span>}</td>
                        <td className="px-5 py-3">{editSlug === p.slug ? <input type="number" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} className="border border-rule rounded-lg px-3 py-1.5 text-sm w-20 outline-none" /> : <span className="text-ink font-semibold">AED {p.price}</span>}</td>
                        <td className="px-5 py-3">{editSlug === p.slug ? <input type="number" value={editStock} onChange={(e) => setEditStock(Number(e.target.value))} className="border border-rule rounded-lg px-3 py-1.5 text-sm w-16 outline-none" /> : (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.stock > 20 ? 'bg-green-50 text-green-700' : p.stock > 5 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600'}`}>{p.stock}</span>
                        )}</td>
                        <td className="px-5 py-3 text-right">{editSlug === p.slug ? (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => saveProduct(p.slug, { name: editName, category: editCategory, price: editPrice, stock: editStock })} className="px-4 py-1.5 bg-ink text-bone text-xs font-semibold rounded-lg hover:bg-sand-dark hover:text-ink transition-colors" disabled={saving}>{saving ? "..." : "Save"}</button>
                            <button onClick={() => setEditSlug(null)} className="px-4 py-1.5 bg-paper-deep text-ink-soft text-xs font-medium rounded-lg hover:bg-rule">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setEditSlug(p.slug); setEditName(p.name); setEditCategory(p.category); setEditPrice(p.price); setEditStock(p.stock); }} className="px-4 py-1.5 bg-paper-deep text-ink-soft text-xs font-medium rounded-lg hover:bg-rule">Edit</button>
                            <button onClick={() => deleteProduct(p.slug)} className="px-4 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100">Delete</button>
                          </div>
                        )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-ink-soft text-xs mt-3">Showing {filteredProducts.length} of {products.length} products</p>
          </>
        )}

        {/* ORDERS */}
        {activeTab === "orders" && (
          <>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex flex-wrap gap-2 flex-1">
                <button onClick={() => setOrderStatusFilter("All")} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${orderStatusFilter === "All" ? "bg-ink text-bone" : "bg-bone text-ink-soft border border-rule"}`}>All ({orders.length})</button>
                {ORDER_STATUSES.filter(s => orderStatusCounts[s] > 0).map((s) => {
                  const sc = STATUS_COLORS[s];
                  return (<button key={s} onClick={() => setOrderStatusFilter(s)} className={`px-3 py-1.5 text-xs font-medium rounded-full capitalize ${orderStatusFilter === s ? "bg-ink text-bone" : `${sc.bg} ${sc.text} border border-rule`}`}>{s.replace(/_/g, " ")} ({orderStatusCounts[s]})</button>);
                })}
              </div>
              <input type="text" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder="Search by name or phone..." className="px-4 py-2 border border-rule rounded-xl text-sm w-full sm:w-64 focus:border-sand-dark outline-none" />
            </div>
            <div className="bg-bone rounded-xl border border-rule shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-paper border-b border-rule/60">
                    <th className="text-left px-5 py-3 font-semibold text-ink-soft text-xs uppercase">Order</th>
                    <th className="text-left px-5 py-3 font-semibold text-ink-soft text-xs uppercase">Customer</th>
                    <th className="text-left px-5 py-3 font-semibold text-ink-soft text-xs uppercase">Total</th>
                    <th className="text-left px-5 py-3 font-semibold text-ink-soft text-xs uppercase">Deposit</th>
                    <th className="text-left px-5 py-3 font-semibold text-ink-soft text-xs uppercase">COD</th>
                    <th className="text-left px-5 py-3 font-semibold text-ink-soft text-xs uppercase">Method</th>
                    <th className="text-left px-5 py-3 font-semibold text-ink-soft text-xs uppercase">Status</th>
                    <th className="text-left px-5 py-3 font-semibold text-ink-soft text-xs uppercase">Date</th>
                    <th className="text-left px-5 py-3 font-semibold text-ink-soft text-xs uppercase">Contact</th>
                  </tr></thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr><td colSpan={9} className="px-5 py-8 text-center text-ink-soft">No orders found</td></tr>
                    ) : filteredOrders.map((o) => {
                      const sc = STATUS_COLORS[o.status] || STATUS_COLORS.deposit_paid;
                      return (<tr key={o.id} className="border-b border-rule/40 hover:bg-paper/50">
                        <td className="px-5 py-3 font-mono text-xs text-ink-soft">{String(o.id).slice(0, 8)}</td>
                        <td className="px-5 py-3"><p className="font-medium text-ink">{o.customer_name}</p><p className="text-ink-soft text-xs">{o.customer_phone}</p></td>
                        <td className="px-5 py-3 font-semibold text-ink">AED {o.total}</td>
                        <td className="px-5 py-3 text-ink font-medium">AED {o.deposit_amount}</td>
                        <td className="px-5 py-3 text-sand font-medium">AED {o.cod_amount}</td>
                        <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${o.delivery_method === 'pickup' ? 'bg-blue-50 text-blue-700' : 'bg-paper-deep text-ink-soft'}`}>{o.delivery_method === 'pickup' ? 'Pickup' : 'Delivery'}</span></td>
                        <td className="px-5 py-3"><select aria-label="Order status" value={o.status} onChange={(e) => updateOrderStatus(o.id, e.target.value)} disabled={updatingOrderId === o.id}
                          className={`px-2 py-1 rounded-lg text-xs font-medium border border-rule outline-none ${sc.bg} ${sc.text}`}>
                          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                        </select></td>
                        <td className="px-5 py-3 text-ink-soft text-xs">{o.created_at ? new Date(o.created_at).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" }) : "-"}</td>
                        <td className="px-5 py-3">
                          <a href={`https://wa.me/${(o.customer_phone || "").replace(/\D/g, "").replace(/^0/, "971")}?text=${encodeURIComponent(`Hi ${o.customer_name}! Your Lebon Grace order #${String(o.id).slice(0, 8)} — status: ${o.status.replace(/_/g, " ")}. Total: AED ${o.total} (Paid: AED ${o.deposit_amount}, COD: AED ${o.cod_amount}).`)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2 py-1 bg-[#25D366]/10 text-[#25D366] rounded-lg text-xs font-medium hover:bg-[#25D366]/20 transition-colors">
                            <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.941 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.67-.167-.67-.167h-.57c-.197 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.273-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.904-9.884 2.605 0 5.06 1.023 6.9 2.863a9.835 9.835 0 012.863 6.914c-.003 5.45-4.437 9.884-9.89 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.924c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.926 0-.026 0-.055 0-.083A11.942 11.942 0 0021.85 5.737"/></svg>
                            Message
                          </a>
                        </td>
                      </tr>);
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-ink-soft text-xs mt-3">Showing {filteredOrders.length} of {orders.length} orders</p>
          </>
        )}

        {/* ANALYTICS */}

        {/* ANALYTICS — Product Analytics */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="bg-bone rounded-xl border border-rule p-5">
              <h3 className="font-semibold text-ink mb-4">Products by Category</h3>
              <div className="space-y-3">
                {Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-sm text-ink-soft w-40 truncate">{cat}</span>
                    <div className="flex-1 bg-paper-deep rounded-full h-2.5">
                      <div className="bg-ink h-2.5 rounded-full" style={{ width: `${(count / products.length) * 100}%` }} />
                    </div>
                    <span className="text-sm font-medium text-ink w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-bone rounded-xl border border-rule p-5">
              <h3 className="font-semibold text-ink mb-4">Price Distribution</h3>
              <div className="space-y-3">
                {priceRanges.map((r) => (
                  <div key={r.l} className="flex items-center gap-3">
                    <span className="text-sm text-ink-soft w-28">{r.l}</span>
                    <div className="flex-1 bg-paper-deep rounded-full h-2.5">
                      <div className="bg-sand h-2.5 rounded-full" style={{ width: `${(r.count / products.length) * 100}%`, minWidth: r.count > 0 ? "8px" : "0" }} />
                    </div>
                    <span className="text-sm font-medium text-ink w-8 text-right">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
