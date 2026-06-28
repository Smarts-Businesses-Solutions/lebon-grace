"use client";

import { useState, useEffect, useMemo } from "react";
import Link from "next/link";

const CATEGORIES = [
  "Jewelry", "Home Decor", "Fashion & Accessories", "Pet Supplies",
  "Kitchen & Dining", "Beauty & Grooming", "Home Storage", "Bags & Travel",
  "Stationery & Gifts", "Desk & Office", "Garden & Outdoor", "Phone & Tech",
  "Fitness & Wellness", "Candles & Aroma", "Seasonal & Gifts",
  "Keychains & Tags", "Kids & Baby",
];

const ORDER_STATUSES = [
  "deposit_paid", "processing", "shipped", "out_for_delivery",
  "delivered", "completed", "failed", "refunded",
];

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  deposit_paid: { bg: "bg-yellow-50", text: "text-yellow-700" },
  processing: { bg: "bg-blue-50", text: "text-blue-700" },
  shipped: { bg: "bg-indigo-50", text: "text-indigo-700" },
  out_for_delivery: { bg: "bg-purple-50", text: "text-purple-700" },
  delivered: { bg: "bg-green-50", text: "text-green-700" },
  completed: { bg: "bg-emerald-50", text: "text-emerald-700" },
  failed: { bg: "bg-red-50", text: "text-red-700" },
  refunded: { bg: "bg-gray-50", text: "text-gray-700" },
};

const STATUS_BAR_COLORS: Record<string, string> = {
  deposit_paid: "bg-yellow-400", processing: "bg-blue-400",
  shipped: "bg-indigo-400", out_for_delivery: "bg-purple-400",
  delivered: "bg-green-400", completed: "bg-emerald-400",
  failed: "bg-red-400", refunded: "bg-gray-400",
};

interface Product { slug: string; name: string; price: number; category: string; stock: number; imageUrl: string; cjPid?: string; cjPrice?: string; description?: string; }
interface Order { id: string; stripe_session_id?: string; customer_name: string; customer_email?: string; customer_phone: string; total: number; deposit_amount: number; cod_amount: number; status: string; delivery_method?: string; tracking_number?: string; created_at: string; }
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

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "lebongrace2026") { setAuthenticated(true); }
    else { showMessage("Incorrect password", "error"); }
  };

  const loadProducts = async () => {
    try { setLoading(true); const res = await fetch("/api/products"); const d = await res.json(); setProducts(Array.isArray(d) ? d : []); }
    catch { showMessage("Failed to load products", "error"); }
    finally { setLoading(false); }
  };

  const loadOrders = async () => {
    try { const res = await fetch("/api/orders"); const d = await res.json(); setOrders(Array.isArray(d) ? d : []); }
    catch { /* no orders yet */ }
  };

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
  const totalRevenue = useMemo(() => orders.reduce((s, o) => s + (o.total || 0), 0), [orders]);
  const totalDeposits = useMemo(() => orders.reduce((s, o) => s + (o.deposit_amount || 0), 0), [orders]);
  const totalCOD = useMemo(() => orders.reduce((s, o) => s + (o.cod_amount || 0), 0), [orders]);
  const avgPrice = useMemo(() => products.length ? Math.round(products.reduce((s, p) => s + p.price, 0) / products.length) : 0, [products]);
  const avgOrderValue = useMemo(() => orders.length ? Math.round(totalRevenue / orders.length) : 0, [orders, totalRevenue]);
  const statusCounts: Record<string, number> = useMemo(() => {
    const c: Record<string, number> = {}; ORDER_STATUSES.forEach((s) => { c[s] = 0; }); orders.forEach((o) => { if (o.status && c[o.status] !== undefined) c[o.status]++; }); return c;
  }, [orders]);
  const lowStockProducts = useMemo(() => products.filter((p) => p.stock <= 10).sort((a, b) => a.stock - b.stock), [products]);
  const recentOrders = useMemo(() => [...orders].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 5), [orders]);
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
  const maxStatusCount = useMemo(() => Math.max(...Object.values(statusCounts), 1), [statusCounts]);
  const priceRanges = useMemo(() => {
    const r = [{ l: "AED 0-25", m: 0, M: 25 }, { l: "AED 25-50", m: 25, M: 50 }, { l: "AED 50-100", m: 50, M: 100 }, { l: "AED 100-200", m: 100, M: 200 }, { l: "AED 200+", m: 200, M: 9999 }];
    return r.map((x) => ({ ...x, count: products.filter((p) => p.price >= x.m && p.price < x.M).length }));
  }, [products]);

  // LOGIN
  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-[#C9A96E] to-[#B89A5E] rounded-2xl mx-auto mb-4 flex items-center justify-center">
              <span className="text-white text-2xl font-bold">LG</span>
            </div>
            <h1 className="text-2xl font-bold text-gray-900">Lebon Grace</h1>
            <p className="text-gray-400 text-sm mt-1">Admin Dashboard</p>
          </div>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter admin password"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm mb-4 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 outline-none transition-all" autoFocus />
          {message.text && <p className="text-red-500 text-sm mb-3">{message.text}</p>}
          <button type="submit" className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors">Sign In</button>
          <p className="text-center text-gray-400 text-xs mt-6"><Link href="/" className="text-[#16A34A] hover:underline">← Back to store</Link></p>
        </form>
      </div>
    );
  }

  // MAIN DASHBOARD
  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-[#C9A96E] to-[#B89A5E] rounded-lg flex items-center justify-center"><span className="text-white text-sm font-bold">LG</span></div>
            <h1 className="text-lg font-bold text-white">Lebon Grace</h1>
            <span className="px-2 py-0.5 bg-[#16A34A]/20 text-[#16A34A] rounded text-[10px] font-semibold uppercase tracking-wider">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            {message.text && <span className={`text-sm font-medium ${message.type === "error" ? "text-red-400" : "text-[#16A34A]"}`}>{message.text}</span>}
            <Link href="/" className="text-sm text-gray-400 hover:text-white transition-colors">Store</Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-gray-200 w-fit shadow-sm">
          {(["dashboard", "products", "orders", "analytics"] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === tab ? "bg-gray-900 text-white shadow-sm" : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"}`}>
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* DASHBOARD */}
        {activeTab === "dashboard" && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Products</p><p className="text-3xl font-bold text-gray-900 mt-1">{products.length}</p></div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Orders</p><p className="text-3xl font-bold text-gray-900 mt-1">{orders.length}</p></div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Total Revenue</p><p className="text-3xl font-bold text-[#16A34A] mt-1">AED {totalRevenue.toLocaleString()}</p></div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Avg Price</p><p className="text-3xl font-bold text-gray-900 mt-1">AED {avgPrice}</p></div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs text-gray-400 uppercase tracking-wider font-medium">Categories</p><p className="text-3xl font-bold text-gray-900 mt-1">{Object.keys(catCounts).length}</p></div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Revenue Split (50/50 Model)</h3>
                <div className="space-y-4">
                  <div>
                    <div className="flex justify-between text-sm mb-1.5"><span className="text-gray-600">Card Deposits (50%)</span><span className="font-semibold text-gray-900">AED {totalDeposits.toLocaleString()}</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-3"><div className="bg-[#16A34A] h-3 rounded-full" style={{ width: "50%" }}></div></div>
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1.5"><span className="text-gray-600">COD Balance (50%)</span><span className="font-semibold text-gray-900">AED {totalCOD.toLocaleString()}</span></div>
                    <div className="w-full bg-gray-100 rounded-full h-3"><div className="bg-[#C9A96E] h-3 rounded-full" style={{ width: "50%" }}></div></div>
                  </div>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Order Status</h3>
                <div className="space-y-3">
                  {ORDER_STATUSES.map((s) => {
                    const count = statusCounts[s] || 0; const sc = STATUS_COLORS[s];
                    return (<div key={s} className="flex items-center gap-3">
                      <span className={`text-xs w-28 capitalize ${sc.text}`}>{s.replace(/_/g, " ")}</span>
                      <div className="flex-1 bg-gray-100 rounded-full h-2.5"><div className={`h-2.5 rounded-full ${STATUS_BAR_COLORS[s]}`} style={{ width: `${(count / maxStatusCount) * 100}%`, minWidth: count > 0 ? "8px" : "0" }}></div></div>
                      <span className={`text-xs font-semibold w-6 text-right ${sc.text}`}>{count}</span>
                    </div>);
                  })}
                </div>
              </div>
            </div>

            {lowStockProducts.length > 0 && (
              <div className="bg-red-50 border border-red-100 rounded-xl p-5">
                <h3 className="font-semibold text-red-800 mb-3">⚠️ Low Stock ({lowStockProducts.length} products)</h3>
                <div className="flex flex-wrap gap-2">
                  {lowStockProducts.slice(0, 9).map((p) => (
                    <div key={p.slug} className="flex items-center gap-2 bg-white rounded-lg p-2">
                      <span className={`px-2 py-0.5 rounded text-xs font-bold ${p.stock === 0 ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'}`}>{p.stock}</span>
                      <span className="text-xs text-gray-700 truncate">{p.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100"><h3 className="font-semibold text-gray-900">Recent Orders</h3></div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Order</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Customer</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Total</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Status</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Date</th>
                  </tr></thead>
                  <tbody>
                    {recentOrders.length === 0 ? (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400 text-sm">No orders yet</td></tr>
                    ) : recentOrders.map((o) => {
                      const sc = STATUS_COLORS[o.status] || STATUS_COLORS.deposit_paid;
                      return (<tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-5 py-3 font-semibold text-gray-900 text-xs">{o.id}</td>
                        <td className="px-5 py-3"><p className="text-gray-800 font-medium">{o.customer_name}</p><p className="text-gray-400 text-xs">{o.customer_phone}</p></td>
                        <td className="px-5 py-3 font-semibold text-gray-900">AED {o.total}</td>
                        <td className="px-5 py-3"><span className={`px-2.5 py-1 rounded-full text-xs font-medium ${sc.bg} ${sc.text}`}>{(o.status || 'unknown').replace(/_/g, " ")}</span></td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{o.created_at ? new Date(o.created_at).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" }) : "-"}</td>
                      </tr>);
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PRODUCTS */}
        {activeTab === "products" && (
          <>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex flex-wrap gap-2 flex-1">
                <button onClick={() => setProductFilter("All")} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${productFilter === "All" ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>All ({products.length})</button>
                {CATEGORIES.filter(c => catCounts[c]).map((cat) => (
                  <button key={cat} onClick={() => setProductFilter(cat)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${productFilter === cat ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>{cat} ({catCounts[cat] || 0})</button>
                ))}
              </div>
              <input type="text" value={productSearch} onChange={(e) => setProductSearch(e.target.value)} placeholder="Search products..." className="px-4 py-2 border border-gray-200 rounded-xl text-sm w-full sm:w-64 focus:border-[#16A34A] outline-none" />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Product</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Category</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Price</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Stock</th>
                    <th className="text-right px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Actions</th>
                  </tr></thead>
                  <tbody>
                    {filteredProducts.length === 0 ? (
                      <tr><td colSpan={5} className="px-5 py-8 text-center text-gray-400">{loading ? "Loading..." : "No products found"}</td></tr>
                    ) : filteredProducts.map((p) => (
                      <tr key={p.slug} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3"><div className="flex items-center gap-3">
                          <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                          {editSlug === p.slug ? <input value={editName} onChange={(e) => setEditName(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-full focus:border-[#16A34A] outline-none" /> : <span className="text-gray-800 font-medium text-sm">{p.name}</span>}
                        </div></td>
                        <td className="px-5 py-3">{editSlug === p.slug ? (
                          <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm outline-none">{CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
                        ) : <span className="inline-block px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-600">{p.category}</span>}</td>
                        <td className="px-5 py-3">{editSlug === p.slug ? <input type="number" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-20 outline-none" /> : <span className="text-gray-800 font-semibold">AED {p.price}</span>}</td>
                        <td className="px-5 py-3">{editSlug === p.slug ? <input type="number" value={editStock} onChange={(e) => setEditStock(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-16 outline-none" /> : (
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.stock > 20 ? 'bg-green-50 text-green-700' : p.stock > 5 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-600'}`}>{p.stock}</span>
                        )}</td>
                        <td className="px-5 py-3 text-right">{editSlug === p.slug ? (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => saveProduct(p.slug, { name: editName, category: editCategory, price: editPrice, stock: editStock })} className="px-4 py-1.5 bg-[#16A34A] text-white text-xs font-semibold rounded-lg hover:bg-[#15803D] transition-colors" disabled={saving}>{saving ? "..." : "Save"}</button>
                            <button onClick={() => setEditSlug(null)} className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200">Cancel</button>
                          </div>
                        ) : (
                          <div className="flex gap-2 justify-end">
                            <button onClick={() => { setEditSlug(p.slug); setEditName(p.name); setEditCategory(p.category); setEditPrice(p.price); setEditStock(p.stock); }} className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200">Edit</button>
                            <button onClick={() => deleteProduct(p.slug)} className="px-4 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100">Delete</button>
                          </div>
                        )}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-gray-400 text-xs mt-3">Showing {filteredProducts.length} of {products.length} products</p>
          </>
        )}

        {/* ORDERS */}
        {activeTab === "orders" && (
          <>
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex flex-wrap gap-2 flex-1">
                <button onClick={() => setOrderStatusFilter("All")} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${orderStatusFilter === "All" ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200"}`}>All ({orders.length})</button>
                {ORDER_STATUSES.filter(s => orderStatusCounts[s] > 0).map((s) => {
                  const sc = STATUS_COLORS[s];
                  return (<button key={s} onClick={() => setOrderStatusFilter(s)} className={`px-3 py-1.5 text-xs font-medium rounded-full capitalize ${orderStatusFilter === s ? "bg-gray-900 text-white" : `${sc.bg} ${sc.text} border border-gray-200`}`}>{s.replace(/_/g, " ")} ({orderStatusCounts[s]})</button>);
                })}
              </div>
              <input type="text" value={orderSearch} onChange={(e) => setOrderSearch(e.target.value)} placeholder="Search by name or phone..." className="px-4 py-2 border border-gray-200 rounded-xl text-sm w-full sm:w-64 focus:border-[#16A34A] outline-none" />
            </div>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Order</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Customer</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Total</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Deposit</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">COD</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Method</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Status</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase">Date</th>
                  </tr></thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr><td colSpan={8} className="px-5 py-8 text-center text-gray-400">No orders found</td></tr>
                    ) : filteredOrders.map((o) => {
                      const sc = STATUS_COLORS[o.status] || STATUS_COLORS.deposit_paid;
                      return (<tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-5 py-3 font-mono text-xs text-gray-600">{String(o.id).slice(0, 8)}</td>
                        <td className="px-5 py-3"><p className="font-medium text-gray-900">{o.customer_name}</p><p className="text-gray-400 text-xs">{o.customer_phone}</p></td>
                        <td className="px-5 py-3 font-semibold text-gray-900">AED {o.total}</td>
                        <td className="px-5 py-3 text-[#16A34A] font-medium">AED {o.deposit_amount}</td>
                        <td className="px-5 py-3 text-[#C9A96E] font-medium">AED {o.cod_amount}</td>
                        <td className="px-5 py-3"><span className={`px-2 py-0.5 rounded text-xs font-medium ${o.delivery_method === 'pickup' ? 'bg-blue-50 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>{o.delivery_method === 'pickup' ? 'Pickup' : 'Delivery'}</span></td>
                        <td className="px-5 py-3"><select value={o.status} onChange={(e) => updateOrderStatus(o.id, e.target.value)} disabled={updatingOrderId === o.id}
                          className={`px-2 py-1 rounded-lg text-xs font-medium border border-gray-200 outline-none ${sc.bg} ${sc.text}`}>
                          {ORDER_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
                        </select></td>
                        <td className="px-5 py-3 text-gray-500 text-xs">{o.created_at ? new Date(o.created_at).toLocaleDateString("en-AE", { year: "numeric", month: "short", day: "numeric" }) : "-"}</td>
                      </tr>);
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-gray-400 text-xs mt-3">Showing {filteredOrders.length} of {orders.length} orders</p>
          </>
        )}

        {/* ANALYTICS */}
        {activeTab === "analytics" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Products by Category</h3>
                {Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                  <div key={cat} className="flex items-center gap-3 mb-3">
                    <span className="text-sm text-gray-600 w-40 truncate">{cat}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5"><div className="bg-[#16A34A] h-2.5 rounded-full" style={{ width: `${(count / products.length) * 100}%` }}></div></div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                  </div>
                ))}
              </div>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                <h3 className="font-semibold text-gray-900 mb-4">Price Distribution</h3>
                {priceRanges.map((r) => (
                  <div key={r.l} className="flex items-center gap-3 mb-3">
                    <span className="text-sm text-gray-600 w-28">{r.l}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5"><div className="bg-[#C9A96E] h-2.5 rounded-full" style={{ width: `${(r.count / products.length) * 100}%`, minWidth: r.count > 0 ? "8px" : "0" }}></div></div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">{r.count}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs text-gray-400 uppercase">Total Revenue</p><p className="text-2xl font-bold text-gray-900 mt-1">AED {totalRevenue.toLocaleString()}</p></div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs text-gray-400 uppercase">Deposits</p><p className="text-2xl font-bold text-[#16A34A] mt-1">AED {totalDeposits.toLocaleString()}</p></div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs text-gray-400 uppercase">COD Balance</p><p className="text-2xl font-bold text-[#C9A96E] mt-1">AED {totalCOD.toLocaleString()}</p></div>
              <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm"><p className="text-xs text-gray-400 uppercase">Avg Order</p><p className="text-2xl font-bold text-gray-900 mt-1">AED {avgOrderValue.toLocaleString()}</p></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
