"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState, useMemo } from "react";
import { useCart } from "@/lib/cart-context";
import { getProductBySlug, formatPrice, products } from "@/lib/products";

// Extract enriched fields from product name
function enrichProduct(p: ReturnType<typeof getProductBySlug>) {
  if (!p) return null;
  const name = p.name.toLowerCase();
  const COLOR_MAP: Record<string, string> = { gold: "Gold", golden: "Gold", silver: "Silver", black: "Black", white: "White", red: "Red", blue: "Blue", green: "Green", pink: "Pink", purple: "Purple", brown: "Brown", grey: "Grey", gray: "Grey", beige: "Beige", navy: "Navy", rose: "Rose", orange: "Orange", yellow: "Yellow", cream: "Cream", bronze: "Bronze", copper: "Copper", champagne: "Champagne", wine: "Wine", teal: "Teal", mint: "Mint", coral: "Coral", peach: "Peach", lavender: "Lavender", turquoise: "Turquoise", leopard: "Leopard", rainbow: "Rainbow", multicolor: "Multicolor", transparent: "Transparent", clear: "Clear" };
  const SIZE_MAP: Record<string, string> = { mini: "Mini", small: "Small", medium: "Medium", large: "Large", xl: "XL", oversized: "Oversized" };
  const MAT_MAP: Record<string, string[]> = { "Stainless Steel": ["stainless steel"], Leather: ["leather", "cowhide"], Wood: ["wooden", "wood", "bamboo"], Crystal: ["crystal"], PVC: ["pvc"], Silicone: ["silicone"], Cotton: ["cotton"], Polyester: ["polyester"], Velvet: ["velvet"], Ceramic: ["ceramic"], Glass: ["glass"], Metal: ["metal", "aluminum", "alloy"], Plastic: ["plastic"], Rubber: ["rubber"], Paper: ["paper", "kraft"], Resin: ["resin"], Acrylic: ["acrylic"] };

  const color = Object.entries(COLOR_MAP).find(([k]) => name.includes(k))?.[1] || "";
  const size = Object.entries(SIZE_MAP).find(([k]) => new RegExp(`\\b${k}\\b`, "i").test(name))?.[1] || "";
  let material = "";
  for (const [m, kws] of Object.entries(MAT_MAP)) {
    if (kws.some((kw) => name.includes(kw))) { material = m; break; }
  }
  return { ...p, color, size, material, enrichedMaterial: material || p.details?.material || "Mixed materials" };
}

// Tab component
function TabButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${active ? "border-[#16A34A] text-[#16A34A]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
      {children}
    </button>
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const rawProduct = getProductBySlug(slug);
  const product = useMemo(() => enrichProduct(rawProduct), [rawProduct]);
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "specifications" | "shipping">("description");
  const [selectedImage, setSelectedImage] = useState(0);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="text-2xl font-semibold">Product Not Found</h1>
        <p className="mt-4 text-gray-400 text-sm">The product you are looking for does not exist.</p>
        <Link href="/shop" className="mt-6 inline-block text-[#16A34A] text-sm font-medium hover:underline">Back to Shop</Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    addItem(rawProduct!, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  // Generate variant images (main + color variations)
  const images = [product.imageUrl];

  // Related products from same category
  const related = products.filter((p) => p.category === product.category && p.slug !== product.slug).slice(0, 6);

  // Rating
  const rating = 4.0 + (slug.length % 10) * 0.1;
  const reviewCount = (slug.length * 7 + 23) % 80 + 10;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/shop" className="hover:text-[#16A34A] transition-colors">Shop</Link>
        <span>/</span>
        <Link href={"/shop?category=" + encodeURIComponent(product.category)} className="hover:text-[#16A34A] transition-colors">{product.category}</Link>
        <span>/</span>
        <span className="text-gray-600 truncate max-w-[200px]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* ─── Image Gallery ─── */}
        <div className="lg:col-span-5">
          {/* Main image */}
          <div className="aspect-square rounded-2xl overflow-hidden bg-gray-50 border border-gray-100">
            <img
              src={images[selectedImage]}
              alt={product.name}
              className="w-full h-full object-cover"
              loading="eager"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
                const parent = target.parentElement;
                if (parent) {
                  parent.style.backgroundColor = product.imagePlaceholder.bg;
                  parent.style.display = "flex";
                  parent.style.alignItems = "center";
                  parent.style.justifyContent = "center";
                  const span = document.createElement("span");
                  span.className = "text-7xl font-bold opacity-60";
                  span.style.color = ["#C9A96E", "#D4BA85"].includes(product.imagePlaceholder.bg) ? "#2D2D2D" : "#FAF8F5";
                  span.textContent = product.imagePlaceholder.initials;
                  parent.appendChild(span);
                }
              }}
            />
          </div>
          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-2 mt-3">
              {images.map((img, i) => (
                <button key={i} onClick={() => setSelectedImage(i)} className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${selectedImage === i ? "border-[#16A34A]" : "border-gray-200 hover:border-gray-300"}`}>
                  <img src={img} alt={`View ${i + 1}`} className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── Product Info ─── */}
        <div className="lg:col-span-4 flex flex-col">
          {/* Badge */}
          <div className="flex items-center gap-2 mb-2">
            <span className="px-2 py-0.5 bg-[#16A34A]/10 text-[#16A34A] text-[11px] font-medium rounded-full">In Stock</span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[11px] rounded-full">{product.category}</span>
          </div>

          {/* Title */}
          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-gray-900">{product.name}</h1>

          {/* Rating */}
          <div className="flex items-center gap-2 mt-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((i) => (
                <svg key={i} className={`w-4 h-4 ${i <= Math.floor(rating) ? "text-yellow-400" : "text-gray-200"}`} fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
            </div>
            <span className="text-sm text-gray-500">{rating.toFixed(1)} ({reviewCount} reviews)</span>
          </div>

          {/* Price */}
          <div className="mt-4">
            <span className="text-3xl font-bold text-gray-900">{formatPrice(product.price)}</span>
            <span className="ml-2 text-sm text-gray-400 line-through">{formatPrice(Math.round(product.price * 1.4))}</span>
            <span className="ml-2 text-sm font-medium text-[#16A34A]">Save {formatPrice(Math.round(product.price * 0.4))}</span>
          </div>

          {/* Color selector */}
          {product.color && (
            <div className="mt-5">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Color: <span className="font-normal text-gray-500">{product.color}</span></label>
              <div className="flex gap-2">
                <button className="w-9 h-9 rounded-full border-2 border-[#16A34A] bg-gray-800 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                </button>
              </div>
            </div>
          )}

          {/* Size selector */}
          {product.size && (
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Size: <span className="font-normal text-gray-500">{product.size}</span></label>
              <div className="flex gap-2">
                <button className="px-4 py-2 border-2 border-[#16A34A] text-[#16A34A] text-sm font-medium rounded-lg">{product.size}</button>
              </div>
            </div>
          )}

          {/* Quantity + Add to Cart */}
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Qty</label>
              <div className="flex items-center border border-gray-200 rounded-lg">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2 text-gray-500 hover:text-gray-700 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>
                </button>
                <span className="px-4 py-2 text-sm font-medium min-w-[40px] text-center">{quantity}</span>
                <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="px-3 py-2 text-gray-500 hover:text-gray-700 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </button>
              </div>
              <span className="text-gray-400 text-xs">{product.stock} in stock</span>
            </div>

            <button
              onClick={handleAddToCart}
              className={`w-full py-3.5 text-sm font-semibold tracking-wide rounded-xl transition-all ${added ? "bg-[#16A34A] text-white scale-[1.02]" : "bg-[#16A34A] text-white hover:bg-[#15803D] active:scale-[0.98]"}`}
            >
              {added ? "✓ Added to Cart" : "Add to Cart"}
            </button>

            <Link href="/checkout" onClick={() => addItem(rawProduct!, quantity)} className="w-full py-3 text-sm font-medium text-center border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors">
              Buy Now
            </Link>
          </div>

          {/* 50/50 Payment */}
          <div className="mt-4 p-4 bg-[#16A34A]/5 rounded-xl border border-[#16A34A]/10">
            <div className="flex items-center gap-2 mb-1">
              <svg className="w-4 h-4 text-[#16A34A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" /></svg>
              <span className="text-sm font-semibold text-[#16A34A]">50/50 Payment</span>
            </div>
            <p className="text-xs text-gray-500 leading-relaxed">
              Pay <strong>{formatPrice(Math.round(product.price / 2))}</strong> now via card + <strong>{formatPrice(Math.ceil(product.price / 2))}</strong> cash on delivery.
            </p>
          </div>

          {/* Key Reasons to Buy */}
          <div className="mt-5 space-y-2.5">
            {[
              { icon: "🚚", text: "Free pickup available — or AED 25 delivery" },
              { icon: "🔒", text: "Secure payment via Stripe" },
              { icon: "⚡", text: "Ships within 2-3 business days" },
              { icon: "💬", text: "WhatsApp support: +971 58 828 6630" },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-2.5">
                <span className="text-sm mt-0.5">{item.icon}</span>
                <span className="text-xs text-gray-600">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ─── Product Details Sidebar ─── */}
        <div className="lg:col-span-3">
          {/* Specifications Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Specifications</h3>
            <dl className="space-y-2.5">
              <div className="flex justify-between"><dt className="text-xs text-gray-400">Material</dt><dd className="text-xs font-medium text-gray-700">{product.enrichedMaterial}</dd></div>
              {product.color && <div className="flex justify-between"><dt className="text-xs text-gray-400">Color</dt><dd className="text-xs font-medium text-gray-700">{product.color}</dd></div>}
              {product.size && <div className="flex justify-between"><dt className="text-xs text-gray-400">Size</dt><dd className="text-xs font-medium text-gray-700">{product.size}</dd></div>}
              {product.details?.weight && <div className="flex justify-between"><dt className="text-xs text-gray-400">Weight</dt><dd className="text-xs font-medium text-gray-700">{product.details.weight}</dd></div>}
              {product.details?.dimensions && <div className="flex justify-between"><dt className="text-xs text-gray-400">Dimensions</dt><dd className="text-xs font-medium text-gray-700">{product.details.dimensions}</dd></div>}
              <div className="flex justify-between"><dt className="text-xs text-gray-400">SKU</dt><dd className="text-xs font-mono text-gray-500">{product.cjPid?.slice(-8) || slug.slice(0, 8)}</dd></div>
            </dl>
          </div>

          {/* Shipping & Returns Card */}
          <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">Shipping & Returns</h3>
            <div className="space-y-3">
              <div className="flex items-start gap-2.5">
                <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M8.25 18.75a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h6m-9 0H3.375a1.125 1.125 0 01-1.125-1.125V14.25m17.25 4.5a1.5 1.5 0 01-3 0m3 0a1.5 1.5 0 00-3 0m3 0h1.125c.621 0 1.129-.504 1.09-1.124a17.902 17.902 0 00-3.213-9.193 2.056 2.056 0 00-1.58-.86H14.25M16.5 18.75h-2.25m0-11.177v-.958c0-.568-.422-1.048-.987-1.106a48.554 48.554 0 00-10.026 0 1.106 1.106 0 00-.987 1.106v7.635m12-6.677v6.677m0 4.5v-4.5m0 0h-12" /></svg>
                <div><p className="text-xs font-medium text-gray-700">Delivery: 10-14 days</p><p className="text-[11px] text-gray-400">International shipping</p></div>
              </div>
              <div className="flex items-start gap-2.5">
                <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" /></svg>
                <div><p className="text-xs font-medium text-gray-700">Pickup: Free</p><p className="text-[11px] text-gray-400">Dubai, UAE</p></div>
              </div>
              <hr className="border-gray-100" />
              <div className="flex items-start gap-2.5">
                <svg className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>
                <div><p className="text-xs font-medium text-gray-700">All sales final</p><p className="text-[11px] text-gray-400">No returns or refunds. Damaged items: contact within 48h.</p></div>
              </div>
            </div>
          </div>

          {/* Trust Badges */}
          <div className="bg-gray-50 rounded-2xl p-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { icon: "🛡️", label: "Secure Payment" },
                { icon: "✅", label: "Quality Checked" },
                { icon: "📦", label: "Tracked Shipping" },
                { icon: "💬", label: "24/7 Support" },
              ].map((badge, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="text-sm">{badge.icon}</span>
                  <span className="text-[11px] text-gray-600 font-medium">{badge.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Tabs: Description / Reviews ─── */}
      <div className="mt-12 border-t border-gray-100 pt-8">
        <div className="flex gap-0 border-b border-gray-100 mb-6">
          <TabButton active={activeTab === "description"} onClick={() => setActiveTab("description")}>Description</TabButton>
          <TabButton active={activeTab === "specifications"} onClick={() => setActiveTab("specifications")}>Specifications</TabButton>
          <TabButton active={activeTab === "shipping"} onClick={() => setActiveTab("shipping")}>Shipping & Returns</TabButton>
        </div>

        {activeTab === "description" && (
          <div className="max-w-3xl">
            <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl">
                <h4 className="text-sm font-semibold text-gray-800 mb-2">Material</h4>
                <p className="text-xs text-gray-500">{product.enrichedMaterial}</p>
              </div>
              {product.details?.weight && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Weight</h4>
                  <p className="text-xs text-gray-500">{product.details.weight}</p>
                </div>
              )}
              {product.color && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Color</h4>
                  <p className="text-xs text-gray-500">{product.color}</p>
                </div>
              )}
              {product.size && (
                <div className="p-4 bg-gray-50 rounded-xl">
                  <h4 className="text-sm font-semibold text-gray-800 mb-2">Size</h4>
                  <p className="text-xs text-gray-500">{product.size}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === "specifications" && (
          <div className="max-w-2xl">
            <dl className="divide-y divide-gray-100">
              {[
                ["Material", product.enrichedMaterial],
                ["Color", product.color || "N/A"],
                ["Size", product.size || "One Size"],
                ["Weight", product.details?.weight || "N/A"],
                ["Dimensions", product.details?.dimensions || "N/A"],
                ["Category", product.category],
                ["SKU", product.cjPid || slug],
                ["Stock", `${product.stock} units`],
              ].map(([label, value]) => (
                <div key={label} className="flex py-3">
                  <dt className="w-40 text-sm text-gray-400 flex-shrink-0">{label}</dt>
                  <dd className="text-sm text-gray-700">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        {activeTab === "shipping" && (
          <div className="max-w-2xl space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Delivery Options</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">🚚</span>
                    <div><p className="text-sm font-medium text-gray-700">Standard Delivery</p><p className="text-xs text-gray-400">10-14 business days</p></div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">AED 25</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#16A34A]/5 rounded-xl border border-[#16A34A]/10">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📍</span>
                    <div><p className="text-sm font-medium text-gray-700">Pickup (Dubai)</p><p className="text-xs text-gray-400">Ready in 10-14 days</p></div>
                  </div>
                  <span className="text-sm font-bold text-[#16A34A]">FREE</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Return Policy</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                As a small company sourcing affordable products directly from international suppliers, <strong>all sales are final</strong>. We do not offer returns or refunds. This helps us keep our prices as low as possible.
              </p>
              <p className="text-sm text-gray-600 leading-relaxed mt-2">
                If you receive a <strong>damaged or incorrect item</strong>, please contact us within 48 hours of delivery with photos, and we will arrange a replacement or store credit.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* ─── Related Products ─── */}
      {related.length > 0 && (
        <div className="mt-16 border-t border-gray-100 pt-10">
          <h2 className="text-xl font-bold tracking-tight mb-6">You May Also Like</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {related.map((p) => (
              <Link key={p.slug} href={"/shop/" + p.slug} className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200">
                <div className="aspect-square overflow-hidden bg-gray-50">
                  <img src={p.imageUrl} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                </div>
                <div className="p-3">
                  <h3 className="text-xs font-medium text-gray-800 line-clamp-2 group-hover:text-[#16A34A] transition-colors">{p.name}</h3>
                  <p className="text-sm font-bold text-gray-900 mt-1">{formatPrice(p.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </section>
  );
}
