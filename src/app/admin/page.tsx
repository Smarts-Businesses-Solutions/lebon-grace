"use client";

import { useState, useEffect } from "react";
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
  imageUrl: string;
  cjPid?: string;
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [filter, setFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [editSlug, setEditSlug] = useState<string | null>(null);
  const [editCategory, setEditCategory] = useState("");
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState(0);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === "lebongrace2026") {
      setAuthenticated(true);
      loadProducts();
    } else {
      setMessage("Incorrect password");
    }
  };

  const loadProducts = async () => {
    try {
      const res = await fetch("/api/products");
      const data = await res.json();
      setProducts(data);
    } catch {
      setMessage("Failed to load products");
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
        setMessage(`Updated: ${updates.name || slug}`);
        loadProducts();
        setEditSlug(null);
      } else {
        setMessage("Save failed");
      }
    } catch {
      setMessage("Save failed");
    }
    setSaving(false);
    setTimeout(() => setMessage(""), 3000);
  };

  const deleteProduct = async (slug: string) => {
    if (!confirm("Delete this product?")) return;
    try {
      await fetch("/api/products", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      setMessage("Deleted");
      loadProducts();
    } catch {
      setMessage("Delete failed");
    }
  };

  const filtered = products.filter((p) => {
    const matchCat = filter === "All" || p.category === filter;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  const catCounts: Record<string, number> = {};
  products.forEach((p) => { catCounts[p.category] = (catCounts[p.category] || 0) + 1; });

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <form onSubmit={handleLogin} className="bg-white p-8 rounded-xl shadow-sm border border-gray-200 w-full max-w-sm">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Lebon Grace Admin</h1>
          <p className="text-gray-400 text-sm mb-6">Enter admin password to continue</p>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Admin password"
            className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm mb-4 focus:border-[#16A34A] focus:ring-1 focus:ring-[#16A34A] outline-none"
          />
          {message && <p className="text-red-500 text-sm mb-3">{message}</p>}
          <button type="submit" className="w-full py-3 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 transition-colors">
            Login
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Lebon Grace Admin</h1>
            <p className="text-gray-400 text-xs">{products.length} products &bull; {Object.keys(catCounts).length} categories</p>
          </div>
          <div className="flex items-center gap-3">
            {message && <span className="text-sm text-[#16A34A] font-medium">{message}</span>}
            <Link href="/" className="text-sm text-gray-500 hover:text-gray-700">View Site</Link>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white p-4 rounded-lg border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">{products.length}</p>
            <p className="text-xs text-gray-400">Total Products</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">{Object.keys(catCounts).length}</p>
            <p className="text-xs text-gray-400">Categories</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">AED {Math.round(products.reduce((s, p) => s + p.price, 0) / products.length)}</p>
            <p className="text-xs text-gray-400">Avg Price</p>
          </div>
          <div className="bg-white p-4 rounded-lg border border-gray-100">
            <p className="text-2xl font-bold text-gray-900">AED {Math.min(...products.map(p => p.price))}–{Math.max(...products.map(p => p.price))}</p>
            <p className="text-xs text-gray-400">Price Range</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <button onClick={() => setFilter("All")} className={`px-3 py-1.5 text-xs font-medium rounded-full ${filter === "All" ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
            All ({products.length})
          </button>
          {CATEGORIES.filter(c => catCounts[c]).map((cat) => (
            <button key={cat} onClick={() => setFilter(cat)} className={`px-3 py-1.5 text-xs font-medium rounded-full ${filter === cat ? "bg-gray-900 text-white" : "bg-gray-100 text-gray-600"}`}>
              {cat} ({catCounts[cat] || 0})
            </button>
          ))}
        </div>

        <div className="mb-4">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search products..."
            className="w-full sm:w-80 px-4 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#16A34A] outline-none"
          />
        </div>

        {/* Products Table */}
        <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Product</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Category</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Price</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 text-xs">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.slug} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <img src={p.imageUrl} alt={p.name} className="w-10 h-10 rounded object-cover bg-gray-100" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                        {editSlug === p.slug ? (
                          <input value={editName} onChange={(e) => setEditName(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm w-full" />
                        ) : (
                          <span className="text-gray-800 font-medium">{p.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {editSlug === p.slug ? (
                        <select value={editCategory} onChange={(e) => setEditCategory(e.target.value)} className="border border-gray-200 rounded px-2 py-1 text-sm">
                          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                        </select>
                      ) : (
                        <span className="inline-block px-2 py-0.5 bg-gray-100 rounded text-xs font-medium text-gray-600">{p.category}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {editSlug === p.slug ? (
                        <input type="number" value={editPrice} onChange={(e) => setEditPrice(Number(e.target.value))} className="border border-gray-200 rounded px-2 py-1 text-sm w-20" />
                      ) : (
                        `AED ${p.price}`
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {editSlug === p.slug ? (
                        <div className="flex gap-2">
                          <button onClick={() => saveProduct(p.slug, { category: editCategory, name: editName, price: editPrice })} className="px-3 py-1 bg-[#16A34A] text-white text-xs rounded font-medium" disabled={saving}>
                            {saving ? "..." : "Save"}
                          </button>
                          <button onClick={() => setEditSlug(null)} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded">Cancel</button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button onClick={() => { setEditSlug(p.slug); setEditCategory(p.category); setEditName(p.name); setEditPrice(p.price); }} className="px-3 py-1 bg-gray-100 text-gray-600 text-xs rounded hover:bg-gray-200">Edit</button>
                          <button onClick={() => deleteProduct(p.slug)} className="px-3 py-1 bg-red-50 text-red-600 text-xs rounded hover:bg-red-100">Delete</button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="text-gray-400 text-xs mt-4">Showing {filtered.length} of {products.length} products</p>
      </div>
    </div>
  );
}
