"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState, useEffect, useMemo, useRef } from "react";
import { useCart } from "@/lib/cart-context";
import { getProductBySlug, formatPrice, products } from "@/lib/products";
import { getVariantGroup, getSimilarProducts, extractColor, extractSize } from "@/lib/variants";

// Extract enriched fields from product name
function enrichProduct(p: ReturnType<typeof getProductBySlug>) {
  if (!p) return null;
  const name = p.name.toLowerCase();
  const color = extractColor(p.name);
  const size = extractSize(p.name);

  const MAT_MAP: Record<string, string[]> = {
    "Stainless Steel": ["stainless steel"], Leather: ["leather", "cowhide"], Wood: ["wooden", "wood", "bamboo"],
    Crystal: ["crystal"], PVC: ["pvc"], Silicone: ["silicone"], Cotton: ["cotton"], Polyester: ["polyester"],
    Velvet: ["velvet"], Ceramic: ["ceramic"], Glass: ["glass"], Metal: ["metal", "aluminum", "alloy"],
    Plastic: ["plastic"], Rubber: ["rubber"], Paper: ["paper", "kraft"], Resin: ["resin"], Acrylic: ["acrylic"],
  };
  let material = "";
  for (const [m, kws] of Object.entries(MAT_MAP)) {
    if (kws.some((kw) => name.includes(kw))) { material = m; break; }
  }
  return { ...p, color, size, material, enrichedMaterial: material || p.details?.material || "Mixed materials" };
}

// ARIA-compliant Tab component
function TabButton({ active, onClick, children, id, controls }: { active: boolean; onClick: () => void; children: React.ReactNode; id: string; controls: string }) {
  return (
    <button
      onClick={onClick}
      role="tab"
      id={id}
      aria-controls={controls}
      aria-selected={active}
      className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${active ? "border-[#16A34A] text-[#16A34A]" : "border-transparent text-gray-500 hover:text-gray-700"}`}
    >
      {children}
    </button>
  );
}

interface CjVariant {
  sku: string;
  name: string;
  image: string;
  price: number;
  color?: string;
  size?: string;
}

export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const slug = params.slug as string;
  const rawProduct = getProductBySlug(slug);
  const product = useMemo(() => enrichProduct(rawProduct), [rawProduct]);
  const variantGroup = useMemo(() => (rawProduct ? getVariantGroup(slug) : null), [rawProduct, slug]);
  const similarProducts = useMemo(() => (rawProduct ? getSimilarProducts(rawProduct, 6) : []), [rawProduct]);
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "specifications" | "shipping">("description");
  const [selectedImage, setSelectedImage] = useState(0);
  const [cjVariants, setCjVariants] = useState<CjVariant[]>([]);
  const [cjImages, setCjImages] = useState<string[]>([]);
  const [loadingVariants, setLoadingVariants] = useState(false);
  const [selectedVariantSku, setSelectedVariantSku] = useState<string | null>(null);
  const [showVariantError, setShowVariantError] = useState(false);
  const ctaRef = useRef<HTMLDivElement>(null);

  // Fetch variants
  useEffect(() => {
    if (!rawProduct) return;
    setLoadingVariants(true);
    setCjVariants([]);
    setCjImages([]);
    setSelectedVariantSku(null);

    fetch(`/api/variants?slug=${encodeURIComponent(slug)}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.variants && data.variants.length > 0) {
          setCjVariants(data.variants);
          if (data.images) setCjImages(data.images);
        } else if (rawProduct.cjPid) {
          return fetch(`/api/variants?pid=${rawProduct.cjPid}`)
            .then((r) => r.json())
            .then((cjData) => {
              if (cjData.variants && cjData.variants.length > 0) setCjVariants(cjData.variants);
              if (cjData.images && cjData.images.length > 0) setCjImages(cjData.images);
            });
        }
      })
      .catch(() => {})
      .finally(() => setLoadingVariants(false));
  }, [slug, rawProduct]);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="text-2xl font-semibold">Product Not Found</h1>
        <p className="mt-4 text-gray-400 text-sm">The product you are looking for does not exist.</p>
        <Link href="/shop" className="mt-6 inline-block text-[#16A34A] text-sm font-medium hover:underline">Back to Shop</Link>
      </div>
    );
  }

  // The selected CJ variant (if any)
  const selectedCjVariant = cjVariants.find((v) => v.sku === selectedVariantSku) || null;

  // Determine if variant selection is required
  const hasVariants = cjVariants.length > 1 || (variantGroup && variantGroup.variants.length > 1);
  const variantRequired = hasVariants && !selectedCjVariant;

  // Display price (updates with selected variant)
  const displayPrice = selectedCjVariant?.price || product.price;

  const handleAddToCart = () => {
    // Require variant selection if variants exist
    if (variantRequired) {
      setShowVariantError(true);
      ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setShowVariantError(false);

    // Build cart item with variant info
    const cartItem = {
      ...rawProduct!,
      ...(selectedCjVariant
        ? {
            name: `${rawProduct!.name} — ${selectedCjVariant.name}`,
            imageUrl: selectedCjVariant.image || product.imageUrl,
            price: selectedCjVariant.price || product.price,
          }
        : {}),
    };

    addItem(cartItem, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  const handleBuyNow = () => {
    if (variantRequired) {
      setShowVariantError(true);
      ctaRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    setShowVariantError(false);

    const cartItem = {
      ...rawProduct!,
      ...(selectedCjVariant
        ? {
            name: `${rawProduct!.name} — ${selectedCjVariant.name}`,
            imageUrl: selectedCjVariant.image || product.imageUrl,
            price: selectedCjVariant.price || product.price,
          }
        : {}),
    };
    addItem(cartItem, quantity);
    router.push("/checkout");
  };

  // Gallery images
  const images = cjImages.length > 0 ? cjImages : [product.imageUrl];

  // Related products (use scored similar, fall back to same category)
  const related = similarProducts.length > 0
    ? similarProducts
    : products.filter((p) => p.category === product.category && p.slug !== product.slug).slice(0, 6);

  // Stock display
  const isLowStock = product.stock <= 10;
  const stockLabel = product.stock === 0 ? "Out of Stock" : isLowStock ? `Only ${product.stock} left — order soon!` : "In Stock";

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-2 text-sm text-gray-400">
        <Link href="/" className="hover:text-[#16A34A] transition-colors">Home</Link>
        <span>/</span>
        <Link href="/shop" className="hover:text-[#16A34A] transition-colors">Shop</Link>
        <span>/</span>
        <Link href={"/shop?category=" + encodeURIComponent(product.category)} className="hover:text-[#16A34A] transition-colors">{product.category}</Link>
        <span>/</span>
        <span className="text-gray-600 truncate max-w-[200px]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* ─── Image Gallery ─── */}
        <div className="lg:col-span-5">
          <div className="aspect-square rounded-2xl overflow-hidden bg-gray-50 border border-gray-100 relative group">
            <img
              src={images[selectedImage]}
              alt={`${product.name}${selectedCjVariant ? ` — ${selectedCjVariant.name}` : ""}`}
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
          {images.length > 1 && (
            <div className="flex gap-2 mt-3 overflow-x-auto snap-x">
              {images.map((img, i) => (
                <button
                  key={i}
                  onClick={() => setSelectedImage(i)}
                  className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors snap-start ${selectedImage === i ? "border-[#16A34A]" : "border-gray-200 hover:border-gray-300"}`}
                  aria-label={`View image ${i + 1}`}
                >
                  <img src={img} alt={`${product.name} — image ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── Product Info ─── */}
        <div className="lg:col-span-4 flex flex-col">
          {/* Badges */}
          <div className="flex items-center gap-2 mb-2">
            <span className={`px-2 py-0.5 text-[11px] font-medium rounded-full ${product.stock === 0 ? "bg-red-50 text-red-600" : isLowStock ? "bg-yellow-50 text-yellow-700" : "bg-[#16A34A]/10 text-[#16A34A]"}`}>{stockLabel}</span>
            <span className="px-2 py-0.5 bg-gray-100 text-gray-500 text-[11px] rounded-full">{product.category}</span>
          </div>

          <h1 className="text-xl lg:text-2xl font-bold tracking-tight text-gray-900">{product.name}</h1>

          {/* Price */}
          <div className="mt-3">
            <span className="text-3xl font-bold text-gray-900">{formatPrice(displayPrice)}</span>
          </div>

          {/* 50/50 Payment — inline */}
          <p className="mt-1 text-sm text-gray-500">
            Pay <strong className="text-[#16A34A]">{formatPrice(Math.round(displayPrice / 2))}</strong> now + <strong className="text-[#C9A96E]">{formatPrice(Math.ceil(displayPrice / 2))}</strong> on delivery
          </p>

          {/* CJ Variant Selector */}
          {cjVariants.length > 1 && (
            <div className="mt-5">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                {cjVariants.some((v) => v.color) ? "Color" : "Style"}: <span className="font-normal text-gray-500">{selectedCjVariant?.name || "Select an option"}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {cjVariants.map((v) => {
                  const isActive = v.sku === selectedVariantSku;
                  return (
                    <button
                      key={v.sku}
                      onClick={() => { setSelectedVariantSku(v.sku); setShowVariantError(false); const imgIdx = images.indexOf(v.image); if (imgIdx >= 0) setSelectedImage(imgIdx); }}
                      aria-label={`${v.name} variant`}
                      aria-pressed={isActive}
                      className={`group relative flex flex-col items-center gap-1.5 p-1.5 rounded-xl border-2 transition-all ${isActive ? "border-[#16A34A] bg-[#16A34A]/5" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-50">
                        <img src={v.image} alt={v.name} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </div>
                      <span className={`text-[10px] font-medium text-center leading-tight max-w-[60px] truncate ${isActive ? "text-[#16A34A]" : "text-gray-500"}`} title={v.name}>{v.color || v.name}</span>
                      {isActive && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#16A34A] rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Local Variant Selector (grouped products) */}
          {!cjVariants.length && variantGroup && variantGroup.variants.length > 1 && (
            <div className="mt-5">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                {variantGroup.colors.length > 0 ? "Color" : "Style"}: <span className="font-normal text-gray-500">{product.color || variantGroup.variants.find((v) => v.slug === slug)?.name?.split(",").pop()?.trim() || "Default"}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {variantGroup.variants.map((v) => {
                  const vColor = extractColor(v.name);
                  const vLabel = vColor || v.name.split(",").pop()?.trim() || v.name.split(" ").slice(-2).join(" ");
                  const isActive = v.slug === slug;
                  return (
                    <Link
                      key={v.slug}
                      href={`/shop/${v.slug}`}
                      className={`group relative flex flex-col items-center gap-1.5 p-1.5 rounded-xl border-2 transition-all ${isActive ? "border-[#16A34A] bg-[#16A34A]/5" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <div className="w-14 h-14 rounded-lg overflow-hidden bg-gray-50">
                        <img src={v.image} alt={`${product.name} — ${vLabel}`} className="w-full h-full object-cover" loading="lazy" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      </div>
                      <span className={`text-[10px] font-medium text-center leading-tight max-w-[60px] truncate ${isActive ? "text-[#16A34A]" : "text-gray-500"}`} title={vLabel}>{vLabel}</span>
                      {isActive && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#16A34A] rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
              <p className="text-[11px] text-gray-400 mt-2">{variantGroup.variants.length} styles available</p>
            </div>
          )}

          {/* Variant required error */}
          {showVariantError && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              Please select a {cjVariants.some((v) => v.color) ? "color" : "style"} first
            </p>
          )}

          {/* Quantity + Add to Cart */}
          <div className="mt-6 flex flex-col gap-3" ref={ctaRef}>
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600" htmlFor="qty">Qty</label>
              <div className="flex items-center border border-gray-200 rounded-lg">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3.5 py-2.5 text-gray-500 hover:text-gray-700 transition-colors" aria-label="Decrease quantity">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>
                </button>
                <input id="qty" type="number" min={1} max={product.stock} value={quantity} onChange={(e) => setQuantity(Math.min(product.stock, Math.max(1, parseInt(e.target.value) || 1)))} className="w-12 text-center text-sm font-medium border-0 outline-none bg-transparent" aria-label="Quantity" />
                <button onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="px-3.5 py-2.5 text-gray-500 hover:text-gray-700 transition-colors" aria-label="Increase quantity">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </button>
              </div>
            </div>

            <button
              onClick={handleAddToCart}
              disabled={product.stock === 0}
              className={`w-full py-3.5 text-sm font-semibold tracking-wide rounded-xl transition-all disabled:opacity-50 disabled:cursor-not-allowed ${added ? "bg-[#16A34A] text-white scale-[1.02]" : "bg-[#16A34A] text-white hover:bg-[#15803D] active:scale-[0.98]"}`}
            >
              {added ? "✓ Added to Cart" : product.stock === 0 ? "Out of Stock" : "Add to Cart"}
            </button>

            <button
              onClick={handleBuyNow}
              disabled={product.stock === 0}
              className="w-full py-3 text-sm font-medium text-center border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
            >
              Buy Now
            </button>
          </div>

          {/* Key Reasons to Buy */}
          <div className="mt-5 space-y-2.5">
            {[
              { icon: "🚚", text: "Ships in 2-3 days · Delivered in 10-14 days" },
              { icon: "📍", text: "Free pickup in Dubai, or AED 25 delivery" },
              { icon: "🔒", text: "Secure payment via Stripe" },
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
                <span className="text-sm">🚚</span>
                <div><p className="text-xs font-medium text-gray-700">Delivery: 10-14 days</p><p className="text-[11px] text-gray-400">International shipping to UAE</p></div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="text-sm">📍</span>
                <div><p className="text-xs font-medium text-gray-700">Pickup: Free</p><p className="text-[11px] text-gray-400">Dubai, UAE</p></div>
              </div>
              <hr className="border-gray-100" />
              <div className="flex items-start gap-2.5">
                <span className="text-sm">📦</span>
                <div><p className="text-xs font-medium text-gray-700">All sales final</p><p className="text-[11px] text-gray-400">Damaged items: contact within 48h with photos</p></div>
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

      {/* ─── Tabs ─── */}
      <div className="mt-12 border-t border-gray-100 pt-8">
        <div className="flex gap-0 border-b border-gray-100 mb-6" role="tablist">
          <TabButton active={activeTab === "description"} onClick={() => setActiveTab("description")} id="tab-desc" controls="panel-desc">Description</TabButton>
          <TabButton active={activeTab === "specifications"} onClick={() => setActiveTab("specifications")} id="tab-specs" controls="panel-specs">Specifications</TabButton>
          <TabButton active={activeTab === "shipping"} onClick={() => setActiveTab("shipping")} id="tab-ship" controls="panel-ship">Shipping & Returns</TabButton>
        </div>

        {activeTab === "description" && (
          <div role="tabpanel" id="panel-desc" aria-labelledby="tab-desc" className="max-w-3xl">
            <p className="text-sm text-gray-600 leading-relaxed">{product.description}</p>
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl"><h4 className="text-sm font-semibold text-gray-800 mb-2">Material</h4><p className="text-xs text-gray-500">{product.enrichedMaterial}</p></div>
              {product.details?.weight && <div className="p-4 bg-gray-50 rounded-xl"><h4 className="text-sm font-semibold text-gray-800 mb-2">Weight</h4><p className="text-xs text-gray-500">{product.details.weight}</p></div>}
              {product.color && <div className="p-4 bg-gray-50 rounded-xl"><h4 className="text-sm font-semibold text-gray-800 mb-2">Color</h4><p className="text-xs text-gray-500">{product.color}</p></div>}
              {product.size && <div className="p-4 bg-gray-50 rounded-xl"><h4 className="text-sm font-semibold text-gray-800 mb-2">Size</h4><p className="text-xs text-gray-500">{product.size}</p></div>}
            </div>
          </div>
        )}

        {activeTab === "specifications" && (
          <div role="tabpanel" id="panel-specs" aria-labelledby="tab-specs" className="max-w-2xl">
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
                <div key={label} className="flex py-3"><dt className="w-40 text-sm text-gray-400 flex-shrink-0">{label}</dt><dd className="text-sm text-gray-700">{value}</dd></div>
              ))}
            </dl>
          </div>
        )}

        {activeTab === "shipping" && (
          <div role="tabpanel" id="panel-ship" aria-labelledby="tab-ship" className="max-w-2xl space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Delivery Options</h4>
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <div className="flex items-center gap-3"><span className="text-lg">🚚</span><div><p className="text-sm font-medium text-gray-700">Standard Delivery</p><p className="text-xs text-gray-400">Ships in 2-3 days · Arrives in 10-14 days</p></div></div>
                  <span className="text-sm font-bold text-gray-900">AED 25</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#16A34A]/5 rounded-xl border border-[#16A34A]/10">
                  <div className="flex items-center gap-3"><span className="text-lg">📍</span><div><p className="text-sm font-medium text-gray-700">Pickup (Dubai)</p><p className="text-xs text-gray-400">Ready in 10-14 days</p></div></div>
                  <span className="text-sm font-bold text-[#16A34A]">FREE</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Return Policy</h4>
              <p className="text-sm text-gray-600 leading-relaxed">As a small company sourcing products from international suppliers, <strong>all sales are final</strong>. We do not offer returns or refunds.</p>
              <p className="text-sm text-gray-600 leading-relaxed mt-2">If you receive a <strong>damaged or incorrect item</strong>, contact us within 48 hours of delivery with photos for a replacement or store credit.</p>
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

      {/* ─── Sticky Mobile Add-to-Cart Bar ─── */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 px-4 py-3 flex items-center gap-3 shadow-lg">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-gray-400 truncate">{product.name}</p>
          <p className="text-sm font-bold text-gray-900">{formatPrice(displayPrice)}</p>
        </div>
        <button
          onClick={handleAddToCart}
          disabled={product.stock === 0}
          className="px-6 py-2.5 bg-[#16A34A] text-white text-sm font-semibold rounded-lg hover:bg-[#15803D] transition-colors disabled:opacity-50"
        >
          {added ? "✓ Added" : "Add to Cart"}
        </button>
      </div>
    </section>
  );
}