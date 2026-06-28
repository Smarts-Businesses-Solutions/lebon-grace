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

interface Product {
  slug: string;
  name: string;
  price: number;
  category: string;
  stock: number;
  imageUrl: string;
  cjPid?: string;
  cjPrice?: string;
  description?: string;
}

interface Order {
  id: string;
  customer: string;
  phone: string;
  items: number;
  total: number;
  status: string;
  date: string;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders] = useState<Order[]>([
    { id: "ORD-001", customer: "Ahmed M.", phone: "+971501234567", items: 3, total: 450, status: "deposit_paid", date: "2026-06-28" },
    { id: "ORD-002", customer: "Sara K.", phone: "+971509876543", items: 1, total: 189, status: "shipped", date: "2026-06-27" },
    { id: "ORD-003", customer: "Omar H.", phone: "+971505551234", items: 5, total: 720, status: "delivered", date: "2026-06-26" },
  ]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState({ text: "", type: "info" });
  const [activeTab, setActiveTab] = useState<"products" | "orders" | "analytics">("products");
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState(0);

  const showMessage = (text: string, type = "info") => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: "", type: "info" }), 3000);
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "lebongrace2026") {
      setAuthenticated(true);
      loadProducts();
    } else {
      showMessage("Incorrect password", "error");
    }
  };

  const loadProducts = async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(data);
    } catch {
      showMessage("Failed to load products", "error");
    }
  };

  const saveProduct = async (slug: string, updates: Partial<Product>) => {
    setSaving(true);
    try {
      const res = await fetch("/api/products", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, ...updates }),
      });
      if (res.ok) {
        showMessage(`Updated: ${updates.name || slug}`, "success");
        loadProducts();
        setEditSlug(null);
      } else {
        showMessage("Save failed", "error");
      }
    } catch {
      showMessage("Save failed", "error");
    }
    setSaving(false);
  };

  const deleteProduct = async (slug: string) => {
    if (!confirm("Delete this product permanently?")) return;
    try {
      await fetch("/api/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      showMessage("Product deleted", "success");
      loadProducts();
    } catch {
      showMessage("Delete failed", "error");
    }
  };

  const filtered = products.filter((p) => {
    const matchCat = filter === "All" || p.category === filter;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const catCounts: Record<string, number> = {};
  products.forEach((p) => { catCounts[p.category] = (catCounts[p.category] || 0) + 1; });

  const totalRevenue = orders.reduce((s, o) => s + o.total, 0);
  const avgPrice = products.length ? Math.round(products.reduce((s, p) => s + p.price, 0) / products.length) : 0;

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 flex items-center justify-center px-4">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-2xl shadow-2xl w-full max-w-sm">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Lebon Grace</h1>
            <p className="text-gray-400 text-sm mt-1">Admin Dashboard</p>
          </div>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter admin password"
            className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm mb-4 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 outline-none transition-all"
            autoFocus
          />
          {message.text && <p className="text-red-500 text-sm mb-3">{message.text}</p>}
          <button type="submit" className="w-full py-3 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-gray-800 transition-colors">
            Sign In
          </button>
          <p className="text-center text-gray-400 text-xs mt-4">
            <Link href="/" className="text-[#16A34A] hover:underline">← Back to store</Link>
          </p>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-lg font-bold text-gray-900">Lebon Grace</h1>
            <span className="px-2 py-0.5 bg-gray-100 rounded text-[10px] font-medium text-gray-500 uppercase tracking-wider">Admin</span>
          </div>
          <div className="flex items-center gap-4">
            {message.text && (
              <span className={`text-sm font-medium ${message.type === "error" ? "text-red-500" : "text-[#16A34A]"}`}>
                {message.text}
              </span>
            )}
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700 transition-colors">← Store</Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-3xl font-bold text-gray-900">{products.length}</p>
            <p className="text-xs text-gray-400 mt-1">Total Products</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-3xl font-bold text-gray-900">{Object.keys(catCounts).length}</p>
            <p className="text-xs text-gray-400 mt-1">Categories</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-3xl font-bold text-[#16A34A]">AED {avgPrice}</p>
            <p className="text-xs text-gray-400 mt-1">Average Price</p>
          </div>
          <div className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm">
            <p className="text-3xl font-bold text-gray-900">{orders.length}</p>
            <p className="text-xs text-gray-400 mt-1">Orders</p>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-white rounded-xl p-1 border border-gray-100 w-fit">
          {(["products", "orders", "analytics"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-700"
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* PRODUCTS TAB */}
        {activeTab === "products" && (
          <>
            {/* Filters */}
            <div className="flex flex-col sm:flex-row gap-4 mb-4">
              <div className="flex flex-wrap gap-2 flex-1">
                <button onClick={() => setFilter("All")} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filter === "All" ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"}`}>
                  All ({products.length})
                </button>
                {CATEGORIES.filter(c => catCounts[c]).map((cat) => (
                  <button key={cat} onClick={() => setFilter(cat)} className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${filter === cat ? "bg-gray-900 text-white" : "bg-white text-gray-600 border border-gray-200 hover:border-gray-300"}`}>
                    {cat} ({catCounts[cat] || 0})
                  </button>
                ))}
              </div>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search products..."
                className="px-4 py-2 border border-gray-200 rounded-xl text-sm w-full sm:w-64 focus:border-[#16A34A] focus:ring-2 focus:ring-[#16A34A]/20 outline-none"
              />
            </div>

            {/* Products Table */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Product</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Category</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Price</th>
                      <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Stock</th>
                      <th className="text-right px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((p) => (
                      <tr key={p.slug} className="border-b border-gray-50 hover:bg-gray-50/50 transition-colors">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded-lg object-cover bg-gray-100 flex-shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                            {editSlug === p.slug ? (
                              <input value={editName} onChange={(e) => setEditName(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-full focus:border-[#16A34A] outline-none" />
                            ) : (
                              <span className="text-gray-800 font-medium text-sm">{p.name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          {editSlug === p.slug ? (
                            <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:border-[#16A34A] outline-none">
                              {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                            </select>
                          ) : (
                            <span className="inline-block px-2.5 py-1 bg-gray-100 rounded-lg text-xs font-medium text-gray-600">{p.category}</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          {editSlug === p.slug ? (
                            <input type="number" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm w-20 focus:border-[#16A34A] outline-none" />
                          ) : (
                            <span className="text-gray-800 font-semibold">AED {p.price}</span>
                          )}
                        </td>
                        <td className="px-5 py-3">
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${p.stock > 20 ? 'bg-green-50 text-green-700' : p.stock > 5 ? 'bg-yellow-50 text-yellow-700' : 'bg-red-50 text-red-700'}`}>
                            {p.stock}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          {editSlug === p.slug ? (
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => saveProduct(p.slug, { category: editCategory, name: editName, price: editPrice })} className="px-4 py-1.5 bg-[#16A34A] text-white text-xs font-semibold rounded-lg hover:bg-[#15803D] transition-colors" disabled={saving}>
                                {saving ? "..." : "Save"}
                              </button>
                              <button onClick={() => setEditSlug(null)} className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors">Cancel</button>
                            </div>
                          ) : (
                            <div className="flex gap-2 justify-end">
                              <button onClick={() => { setEditSlug(p.slug); setEditCategory(p.category); setEditName(p.name); setEditPrice(p.price); }} className="px-4 py-1.5 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors">Edit</button>
                              <button onClick={() => deleteProduct(p.slug)} className="px-4 py-1.5 bg-red-50 text-red-600 text-xs font-medium rounded-lg hover:bg-red-100 transition-colors">Delete</button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <p className="text-gray-400 text-xs mt-3">Showing {filtered.length} of {products.length} products</p>
          </>
        )}

        {/* ORDERS TAB */}
        {activeTab === "orders" && (
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-100">
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Order</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Customer</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Items</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Total</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Status</th>
                    <th className="text-left px-5 py-3 font-semibold text-gray-600 text-xs uppercase tracking-wider">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((o) => (
                    <tr key={o.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                      <td className="px-5 py-3 font-semibold text-gray-900">{o.id}</td>
                      <td className="px-5 py-3">
                        <p className="text-gray-800 font-medium">{o.customer}</p>
                        <p className="text-gray-400 text-xs">{o.phone}</p>
                      </td>
                      <td className="px-5 py-3 text-gray-600">{o.items} items</td>
                      <td className="px-5 py-3 font-semibold text-gray-900">AED {o.total}</td>
                      <td className="px-5 py-3">
                        <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                          o.status === 'delivered' ? 'bg-green-50 text-green-700' :
                          o.status === 'shipped' ? 'bg-blue-50 text-blue-700' :
                          'bg-yellow-50 text-yellow-700'
                        }`}>
                          {o.status.replace('_', ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-gray-500 text-xs">{o.date}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === "analytics" && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Products by Category</h3>
              {Object.entries(catCounts).sort((a, b) => b[1] - a[1]).map(([cat, count]) => (
                <div key={cat} className="flex items-center gap-3 mb-3">
                  <span className="text-sm text-gray-600 w-40 truncate">{cat}</span>
                  <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                    <div className="bg-[#16A34A] h-2.5 rounded-full" style={{ width: `${(count / products.length) * 100}%` }}></div>
                  </div>
                  <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
              <h3 className="font-semibold text-gray-900 mb-4">Price Distribution</h3>
              {[
                { label: "AED 0–25", min: 0, max: 25 },
                { label: "AED 25–50", min: 25, max: 50 },
                { label: "AED 50–100", min: 50, max: 100 },
                { label: "AED 100–200", min: 100, max: 200 },
                { label: "AED 200+", min: 200, max: 9999 },
              ].map((range) => {
                const count = products.filter(p => p.price >= range.min && p.price < range.max).length;
                return (
                  <div key={range.label} className="flex items-center gap-3 mb-3">
                    <span className="text-sm text-gray-600 w-28">{range.label}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2.5">
                      <div className="bg-[#C9A96E] h-2.5 rounded-full" style={{ width: `${(count / products.length) * 100}%` }}></div>
                    </div>
                    <span className="text-sm font-medium text-gray-900 w-8 text-right">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
