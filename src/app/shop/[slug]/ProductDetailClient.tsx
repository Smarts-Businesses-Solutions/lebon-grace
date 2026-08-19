"use client";

import Link from "next/link";
import ProductImage from "@/components/ProductImage";
import SafetyNotice from "@/components/SafetyNotice";
import ProductReviews from "@/components/ProductReviews";
import WhatsAppLink from "@/components/WhatsAppLink";
import { useParams } from "next/navigation";
import { useState, useEffect, useMemo } from "react";
import { useCart } from "@/lib/cart-context";
import { getProductBySlug, formatPrice, products } from "@/lib/products";
import { getVariantGroup, extractColor, extractSize } from "@/lib/variants";

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
    <button onClick={onClick} className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 ${active ? "border-[#A8874D] text-[#A8874D]" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
      {children}
    </button>
  );
}

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const rawProduct = getProductBySlug(slug);
  const product = useMemo(() => enrichProduct(rawProduct), [rawProduct]);
  const isMDF = rawProduct?.cjPid?.startsWith("MDF") ?? false;
  const variantGroup = useMemo(() => rawProduct ? getVariantGroup(slug) : null, [rawProduct, slug]);
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const [activeTab, setActiveTab] = useState<"description" | "specifications" | "shipping" | "how-its-made" | "customization" | "care-guide">("description");
  const [selectedImage, setSelectedImage] = useState(0);
  // Personalisation is free and opt-in. Engraving makes the piece unreturnable,
  // so it must be a deliberate choice, never a default.
  const [wantsName, setWantsName] = useState(false);
  const [engraveName, setEngraveName] = useState("");
  const [cjVariants, setCjVariants] = useState<{ sku: string; name: string; image: string; price: number; color?: string; size?: string }[]>([]);
  const [cjImages, setCjImages] = useState<string[]>([]);
  // Only the setter is used — the flag itself is never rendered.
  const [, setLoadingVariants] = useState(false);
  const [selectedVariantSku, setSelectedVariantSku] = useState<string | null>(null);
  const [recentlyViewed, setRecentlyViewed] = useState<typeof products>([]);

  const selectedCjVariant = cjVariants.find((v) => v.sku === selectedVariantSku) || null;

  // Track recently viewed
  useEffect(() => {
    try {
      const key = "lebon-grace-recently-viewed";
      const viewed: string[] = JSON.parse(localStorage.getItem(key) || "[]");
      const filtered = viewed.filter((s) => s !== slug);
      filtered.unshift(slug);
      localStorage.setItem(key, JSON.stringify(filtered.slice(0, 8)));
      // Recently-viewed lives in localStorage, which does not exist during SSR.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setRecentlyViewed(filtered.filter(s => s !== slug).slice(0, 6).map(s => products.find(p => p.slug === s)).filter(Boolean) as typeof products);
    } catch {}
  }, [slug]);

  // Fetch variants: first from local variant groups, then from CJ API
  useEffect(() => {
    if (!rawProduct) return;
    // Marks the fetch as in-flight; there is no render-time equivalent.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingVariants(true);

    fetch(`/api/variants?slug=${slug}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.variants && data.variants.length > 0) {
          setCjVariants(data.variants);
          // Show the hero (side-by-side) as the main image, with variant overlays as follow-on views.
          if (data.images && data.images.length > 0) setCjImages([rawProduct!.imageUrl, ...data.images]);
          else setCjImages([rawProduct!.imageUrl]);
        }
        // The `?pid=` fallback is gone with the endpoint's CJ passthrough. It
        // made this shop issue an authenticated, billable request to the CJ
        // Dropshipping API on our key for any anonymous caller, unlimited — and
        // it served nothing: no product in the generated catalogue carries a
        // cjPid, so this branch was never reached by a visitor. Only an
        // attacker could reach it, which is the whole shape of the defect.
      })
      .catch(() => {})
      .finally(() => setLoadingVariants(false));
  }, [slug, rawProduct]);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="text-2xl font-semibold">Product Not Found</h1>
        <p className="mt-4 text-ink-muted text-sm">The product you are looking for does not exist.</p>
        <Link href="/shop" className="mt-6 inline-block text-[#A8874D] text-sm font-medium hover:underline">Back to Shop</Link>
      </div>
    );
  }

  const displayPrice = selectedCjVariant?.price || product.price;

  /**
   * Everything the customer configured on this page, in one place.
   *
   * "Add to cart" built this inline and "Buy now" called
   * `addItem(rawProduct, quantity)` — with no engraving and no variant. So the
   * faster-looking path silently discarded the engraved name and any variant
   * choice: the customer paid for a personalised piece and would have received a
   * blank one, with nothing on screen to say so (SH-01).
   *
   * Shared rather than duplicated, because two call sites that must agree are
   * exactly how they came to disagree.
   */
  const addConfiguredToCart = () => {
    const cartItem = {
      ...rawProduct!,
      ...(selectedCjVariant ? {
        name: rawProduct!.name + ", " + selectedCjVariant.name,
        imageUrl: selectedCjVariant.image || product.imageUrl,
        price: selectedCjVariant.price || product.price,
      } : {}),
    };
    addItem(cartItem, quantity, wantsName ? engraveName.trim() : undefined);
  };

  const handleAddToCart = () => {
    addConfiguredToCart();
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  // Generate variant images (main + CJ images + color variations)
  // The elephant uses a clean side-by-side hero; skip the legacy -dim.png (watermarked) for it.
  const dimImage = (isMDF && slug !== "mdf-elephant-cutout") ? `/images/mdf/${slug}-dim.png` : null;
  // Made-to-order products carry their own gallery in details.images (three
  // photographs each). Check that first: cjImages only ever populates for the
  // retired dropship range, so without this the page showed a single image.
  const ownGallery = (product.details as { images?: string[] })?.images;
  const images = ownGallery && ownGallery.length > 0
    ? ownGallery
    : cjImages.length > 0 ? cjImages : (dimImage ? [product.imageUrl, dimImage] : [product.imageUrl]);

  // Related products (use scored similar, fall back to same category)
  const related = products.filter((p) => p.category === product.category && p.slug !== product.slug).slice(0, 6);

  return (
    /*
     * `pb-32 lg:pb-0` reserves room for the fixed mobile purchase bar (SH-02).
     *
     * That bar is `fixed bottom-0 … z-40`, so it is outside the flow and sits on
     * top of whatever the page ends with. Measured on a real mobile viewport, it
     * covered the engraving input: field x61–379/y801–839 against bar
     * x275–396/y783–827. The customer could not read the name about to be cut
     * irreversibly into the piece — and the control they could not see is the
     * one the workshop reads.
     *
     * Padding rather than a margin on the bar: the content has to be able to
     * scroll clear of it, which only bottom space in the scrolling container
     * achieves. `lg:pb-0` because the bar is `lg:hidden`.
     */
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-10 pb-32 lg:pb-10">
      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-ink-muted">
        <Link href="/shop" className="hover:text-[#A8874D] transition-colors">Shop</Link>
        <span>/</span>
        <Link href={"/shop?category=" + encodeURIComponent(product.category)} className="hover:text-[#A8874D] transition-colors">{product.category}</Link>
        <span>/</span>
        <span className="text-gray-600 truncate max-w-[200px]">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">
        {/* ─── Image Gallery ───
            Seven columns of twelve, up from five. The photograph is the whole
            reason this page exists and it was rendering about 510px wide on a
            1280px container while a sidebar repeated the tabs below it.

            The frame stays square with object-contain deliberately: the
            photographs are not one shape (39 square, 20 at 5:4, 12 at 4:3, some
            portrait), so any fixed non-square frame crops or letterboxes a
            different part of the range. Square never crops. The mat is bone
            rather than the sand placeholder colour, so the inevitable bands on
            a non-square photo read as a mount rather than a dark stripe. */}
        <div className="lg:col-span-7">
          {/* Main image */}
          {/* Placeholder initials sit beneath the image rather than being
              appended to the DOM by an onError handler. */}
          <div className="relative aspect-square overflow-hidden bg-bone flex items-center justify-center">
            <span className="font-heading text-7xl text-ink/15">
              {product.imagePlaceholder.initials}
            </span>
            <ProductImage
              src={images[selectedImage]}
              alt={product.name}
              sizes="(min-width: 1024px) 740px, 100vw"
              className="object-contain"
              priority
            />
          </div>
          {/* Thumbnail strip */}
          {images.length > 1 && (
            <div className="flex gap-2 mt-3">
              {images.map((img, i) => (
                <button key={i} onClick={() => setSelectedImage(i)} className={`relative w-20 h-20 overflow-hidden bg-bone transition-colors ${selectedImage === i ? "ring-2 ring-sand-dark" : "ring-1 ring-rule hover:ring-sand"}`}>
                  <ProductImage src={img} alt={`View ${i + 1}`} sizes="80px" className="object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* ─── Product Info ─── */}
        <div className="lg:col-span-5 flex flex-col">
          {/* Badge. Set as an eyebrow rather than two coloured pills — the grey
              and green capsules were marketplace furniture, and "In Stock" on a
              made-to-order shop is a statement about the workshop, not a
              warehouse. */}
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow text-sage">Made to order</span>
            <span className="text-ink-muted/40" aria-hidden="true">·</span>
            <span className="eyebrow text-ink-muted">{product.category}</span>
          </div>

          {/* Title */}
          <h1 className="font-heading text-3xl lg:text-4xl text-ink leading-tight">{product.name}</h1>

          {/* Price */}
          <div className="mt-4">
            {/* No struck-through "was" price. The old markup invented one at 1.4x
                and advertised the difference as a saving; the product was never
                sold at that price, which is a false reference price. */}
            <span className="font-heading text-4xl text-ink tabular-nums">{formatPrice(displayPrice)}</span>
            <span className="ml-3 text-sm text-ink-muted">Name engraved free</span>
          </div>

          {/* CJ Variant Selector */}
          {cjVariants.length > 1 && (
            <div className="mt-5">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Style: <span className="font-normal text-gray-500">{selectedCjVariant?.name || "Select an option"}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {cjVariants.map((v, i) => {
                  const isActive = v.sku === selectedVariantSku;
                  return (
                    <button
                      key={v.sku || i}
                      onClick={() => {
                        setSelectedVariantSku(v.sku);
                        const imgIdx = images.indexOf(v.image);
                        if (imgIdx >= 0) setSelectedImage(imgIdx);
                      }}
                      aria-label={v.name}
                      aria-pressed={isActive}
                      className={`group relative flex flex-col items-center gap-1.5 p-1.5 rounded-xl border-2 transition-all ${isActive ? "border-[#A8874D] bg-[#23201C]/5" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-50">
                        <ProductImage src={v.image} alt={v.name} sizes="64px" className="object-contain" />
                      </div>
                      <span className={`text-[10px] font-medium truncate max-w-[60px] ${isActive ? "text-[#A8874D]" : "text-gray-500"}`} title={v.name}>{v.color || v.name}</span>
                      {isActive && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#23201C] rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Local Variant Selector (grouped products) — shows whenever there are 2+ variants */}
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
                      className={`group relative flex flex-col items-center gap-1.5 p-1.5 rounded-xl border-2 transition-all ${isActive ? "border-[#A8874D] bg-[#23201C]/5" : "border-gray-200 hover:border-gray-300"}`}
                    >
                      <div className="relative w-14 h-14 rounded-lg overflow-hidden bg-gray-50">
                        <ProductImage src={v.image} alt={v.name} sizes="64px" className="object-contain" />
                      </div>
                      <span className={`text-[10px] font-medium text-center leading-tight max-w-[60px] truncate ${isActive ? "text-[#A8874D]" : "text-gray-500"}`}>{vLabel}</span>
                      {isActive && (
                        <div className="absolute -top-1 -right-1 w-4 h-4 bg-[#23201C] rounded-full flex items-center justify-center">
                          <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                        </div>
                      )}
                    </Link>
                  );
                })}
              </div>
              <p className="text-[11px] text-ink-muted mt-2">{variantGroup.variants.length} styles available</p>
            </div>
          )}

          {/* Variant Selector — Size */}
          {variantGroup && variantGroup.sizes.length > 0 && (
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">
                Size: <span className="font-normal text-gray-500">{product.size || "One Size"}</span>
              </label>
              <div className="flex flex-wrap gap-2">
                {variantGroup.variants.map((v) => {
                  const vSize = extractSize(v.name);
                  if (!vSize) return null;
                  const isActive = v.slug === slug;
                  return (
                    <Link
                      key={v.slug}
                      href={`/shop/${v.slug}`}
                      className={`px-4 py-2 text-sm font-medium rounded-lg border-2 transition-all ${isActive ? "border-[#A8874D] text-[#A8874D] bg-[#23201C]/5" : "border-gray-200 text-gray-600 hover:border-gray-300"}`}
                    >
                      {vSize}
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* No variant group — show enriched color/size */}
          {!variantGroup && product.color && (
            <div className="mt-5">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Color: <span className="font-normal text-gray-500">{product.color}</span></label>
              <div className="flex gap-2">
                <button className="w-9 h-9 rounded-full border-2 border-[#A8874D] bg-gray-800 flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" /></svg>
                </button>
              </div>
            </div>
          )}
          {!variantGroup && product.size && (
            <div className="mt-4">
              <label className="text-sm font-medium text-gray-700 mb-2 block">Size: <span className="font-normal text-gray-500">{product.size}</span></label>
              <div className="flex gap-2">
                <button className="px-4 py-2 border-2 border-[#A8874D] text-[#A8874D] text-sm font-medium rounded-lg">{product.size}</button>
              </div>
            </div>
          )}

          {/* Personalisation: free, opt-in, and clear about the consequence */}
          <div className="mb-5 p-4 border border-gray-200 rounded-xl bg-[#FAF8F5]">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={wantsName}
                onChange={(e) => { setWantsName(e.target.checked); if (!e.target.checked) setEngraveName(""); }}
                className="mt-0.5 w-4 h-4 accent-[#C9A96E]"
              />
              <span className="text-sm text-gray-800">
                Engrave a name on it
                <span className="ml-2 text-[11px] font-semibold uppercase tracking-wider text-[#5F7355]">Free</span>
                <span className="block text-xs text-gray-500 mt-0.5">
                  Adds nothing to the price or the making time.
                </span>
              </span>
            </label>
            {wantsName && (
              <div className="mt-3 pl-7">
                <input
                  type="text"
                  value={engraveName}
                  onChange={(e) => setEngraveName(e.target.value.slice(0, 20))}
                  placeholder="e.g. Amira"
                  maxLength={20}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:border-[#C9A96E] focus:ring-2 focus:ring-[#C9A96E]/20 outline-none scroll-mb-40"
                />
                <p className="text-xs text-gray-500 mt-1.5">
                  We engrave exactly what you type, so please check the spelling. Personalised pieces cannot be returned unless faulty.
                </p>
              </div>
            )}
          </div>

          {/* Quantity + Add to Cart */}
          <div className="mt-6 flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Qty</label>
              <div className="flex items-center border border-gray-200 rounded-lg">
                <button aria-label="Decrease quantity" onClick={() => setQuantity(Math.max(1, quantity - 1))} className="px-3 py-2 text-gray-500 hover:text-gray-700 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>
                </button>
                <span className="px-4 py-2 text-sm font-medium min-w-[40px] text-center">{quantity}</span>
                <button aria-label="Increase quantity" onClick={() => setQuantity(Math.min(product.stock, quantity + 1))} className="px-3 py-2 text-gray-500 hover:text-gray-700 transition-colors">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </button>
              </div>
              <span className="text-ink-muted text-xs">Made to order</span>
            </div>

            {/* Squared, matching the homepage’s "Browse the range". The rounded
                pills read as a different site once the rest went editorial. */}
            <button
              data-testid="add-to-cart"
              onClick={handleAddToCart}
              className={`w-full py-4 text-sm tracking-wide transition-all ${added ? "bg-sage text-paper" : "bg-ink text-paper hover:bg-sand-dark active:scale-[0.99]"}`}
            >
              {added ? "Added to cart" : "Add to cart"}
            </button>

            {/* Same configuration as "Add to cart" — see addConfiguredToCart.
                This called addItem(rawProduct, quantity) directly and dropped
                the engraving and the selected variant (SH-01). */}
            <Link
              href="/checkout"
              onClick={addConfiguredToCart}
              className="w-full py-3.5 text-sm text-center text-ink border-b border-ink/25 hover:border-ink transition-colors"
            >
              Buy now
            </Link>

            {/* MDF-specific action buttons */}
            {isMDF && (
              <div className="mt-3 space-y-2">
                <p className="text-[11px] text-ink-muted uppercase tracking-wider font-medium">Locally Made in Dubai, UAE</p>
                <Link
                  href={"/contact?subject=Custom+MDF+Design&product=" + encodeURIComponent(slug)}
                  className="flex items-center gap-3 w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-[#A8874D] hover:text-[#A8874D] transition-colors"
                >
                  <span className="text-lg">🎨</span>
                  <div className="text-left">
                    <p className="font-medium">Request Custom Design</p>
                    <p className="text-[11px] text-ink-muted font-normal">We laser-cut any shape you want</p>
                  </div>
                </Link>
                <WhatsAppLink
                  message={"Hi, I’m interested in " + product.name + ". Can you help?"}
                  className="flex items-center gap-3 w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-[#25D366] hover:text-[#25D366] transition-colors"
                >
                  <span className="text-lg">💬</span>
                  <div className="text-left">
                    <p className="font-medium">WhatsApp Us</p>
                    <p className="text-[11px] text-ink-muted font-normal">Chat directly with our team</p>
                  </div>
                </WhatsAppLink>
                <Link
                  href={"/contact?subject=Bulk+MDF+Order&product=" + encodeURIComponent(slug)}
                  className="flex items-center gap-3 w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:border-[#A8874D] hover:text-[#A8874D] transition-colors"
                >
                  <span className="text-lg">📦</span>
                  <div className="text-left">
                    <p className="font-medium">Bulk Order Inquiry</p>
                    <p className="text-[11px] text-ink-muted font-normal">Volume discounts for 50+ pieces</p>
                  </div>
                </Link>
              </div>
            )}
          </div>

          {/* What you get. Emoji removed: 🚚🔒⚡💬 rendered as four different
              vendors' artwork at four different weights, which is the one thing
              a page set in a single serif cannot absorb. A hairline rule per
              line carries the same list without the noise. */}
          <div className="mt-6 border-t border-rule">
            {[
              "Free collection, or AED 20 UAE delivery (free over AED 150)",
              "Secure payment via Stripe",
              "Ships within 2-3 business days",
              "WhatsApp support, number shown on the contact page",
            ].map((text) => (
              <p key={text} className="text-xs text-ink-soft/85 leading-relaxed py-2.5 border-b border-rule">
                {text}
              </p>
            ))}
          </div>

          {/* Age and the small-parts warning. Lives in the buying column
              rather than a sidebar: it is the one thing here that the tabs
              below do not repeat, and a parent judging suitability should
              meet it beside the price, not off to one side. */}
          <SafetyNotice age={product.details?.age} />

          {/* Renders nothing until a delivered order leaves a real review (A-18). */}
          <ProductReviews slug={product.slug} />
        </div>

      </div>

      {/* ─── Tabs: Description / Reviews ─── */}
      <div className="mt-12 border-t border-gray-100 pt-8">
        <div className="flex gap-0 border-b border-gray-100 mb-6 overflow-x-auto">
          <TabButton active={activeTab === "description"} onClick={() => setActiveTab("description")}>Description</TabButton>
          <TabButton active={activeTab === "specifications"} onClick={() => setActiveTab("specifications")}>Specifications</TabButton>
          <TabButton active={activeTab === "shipping"} onClick={() => setActiveTab("shipping")}>Shipping & Returns</TabButton>
          {isMDF && <TabButton active={activeTab === "how-its-made"} onClick={() => setActiveTab("how-its-made")}>How It&apos;s Made</TabButton>}
          {isMDF && <TabButton active={activeTab === "customization"} onClick={() => setActiveTab("customization")}>Customization</TabButton>}
          {isMDF && <TabButton active={activeTab === "care-guide"} onClick={() => setActiveTab("care-guide")}>Care Guide</TabButton>}
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
                  <dt className="w-40 text-sm text-ink-muted flex-shrink-0">{label}</dt>
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
                    <div><p className="text-sm font-medium text-gray-700">UAE Delivery</p><p className="text-xs text-ink-muted">AED 20, free over AED 150</p></div>
                  </div>
                  <span className="text-sm font-bold text-gray-900">AED 20</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[#23201C]/5 rounded-xl border border-[#A8874D]/10">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">📍</span>
                    <div><p className="text-sm font-medium text-gray-700">Free Collection</p><p className="text-xs text-ink-muted">Ready in 2 to 3 working days</p></div>
                  </div>
                  <span className="text-sm font-bold text-[#A8874D]">FREE</span>
                </div>
              </div>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-gray-800 mb-2">Return Policy</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                Every piece is cut and finished only after you order it, so <strong>made-to-order items cannot be returned if you change your mind</strong>. A piece engraved with a name can never be returned, because it cannot go to anyone else. Clearance stock is different and can be returned within 7 days, unused.</p>
              <p className="text-sm text-gray-600 leading-relaxed mt-2">
                <strong>If anything arrives faulty, damaged or wrong, we replace it free.</strong> Send us a photo within 7 days and we will make a new one and get it to you at no cost. There is nothing to send back.
              </p>
            </div>
          </div>
        )}

        {/* ─── MDF Tab: How It’s Made ─── */}
        {isMDF && activeTab === "how-its-made" && (
          <div className="max-w-3xl space-y-8">
            <div>
              <h4 className="text-base font-semibold text-gray-800 mb-3">From Design to Your Door, Made in Dubai</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                Every MDF product is designed and laser-cut right here in our Dubai workshop. We use precision laser technology to transform raw MDF sheets into the beautiful shapes and structures you see in our catalog.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { step: "1", icon: "✏️", title: "Design", desc: "Each shape is carefully designed in CAD software with precise measurements and clean lines." },
                { step: "2", icon: "🔥", title: "Laser Cut", desc: "Our CO2 laser cutter traces the design on 3mm MDF sheet with pinpoint accuracy, 0.1mm tolerance." },
                { step: "3", icon: "🪵", title: "Sand & Prep", desc: "Every piece is hand-sanded to remove any rough edges and ensure a smooth, splinter-free finish." },
                { step: "4", icon: "🎨", title: "Paint & Finish", desc: "Select items are painted or sealed. Raw MDF pieces are ready for you to customize at home." },
                { step: "5", icon: "✅", title: "Quality Check", desc: "Each piece is inspected for precision, smoothness, and consistency before packaging." },
                { step: "6", icon: "📦", title: "Pack & Ship", desc: "Carefully wrapped and shipped from Dubai. Pickup available for local customers." },
              ].map((item) => (
                <div key={item.step} className="flex gap-3 p-4 bg-gray-50 rounded-xl">
                  <div className="w-10 h-10 rounded-full bg-[#23201C]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-sm font-bold text-[#A8874D]">{item.step}</span>
                  </div>
                  <div>
                    <h5 className="text-sm font-semibold text-gray-800">{item.icon} {item.title}</h5>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-[#23201C]/5 rounded-xl border border-[#A8874D]/10">
              <h5 className="text-sm font-semibold text-[#A8874D] mb-1">🌿 Our Material</h5>
              <p className="text-xs text-gray-600 leading-relaxed">
                We use premium 3mm MDF (Medium-Density Fiberboard), a wood-based panel made from wood fibre. MDF is chosen for its consistent density, smooth surface, and excellent laser-cutting properties.
              </p>
            </div>
          </div>
        )}

        {/* ─── MDF Tab: Customization ─── */}
        {isMDF && activeTab === "customization" && (
          <div className="max-w-3xl space-y-8">
            <div>
              <h4 className="text-base font-semibold text-gray-800 mb-3">Make It Yours: Custom MDF Options</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                Every piece we sell can be customized, or we can create entirely new designs from scratch. Our laser cutter can handle virtually any 2D shape you can imagine.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { icon: "📐", title: "Custom Size", desc: "Need a specific dimension? We can cut any shape to your exact size requirements, from 3cm to 60cm." },
                { icon: "🎨", title: "Paint & Color", desc: "Choose from our range of acrylic paints or request a specific RAL/Pantone color. We can also do gradient finishes." },
                { icon: "✍️", title: "Engraving & Text", desc: "Add names, dates, logos, or any text via laser engraving. Perfect for personalized gifts and business branding." },
                { icon: "🧩", title: "Custom Shapes", desc: "Send us a design (DXF, SVG, or even a sketch) and we’ll laser cut it. Logos, silhouettes, patterns, you name it." },
                { icon: "🏠", title: "Wall Art Sets", desc: "Multi-piece wall art arrangements designed to fit your specific wall dimensions and color scheme." },
                { icon: "🎁", title: "Gift Sets & Bundles", desc: "Curated sets of MDF cutouts, puzzles, or decor pieces, gift-wrapped and ready to give." },
              ].map((item, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-xl">
                  <h5 className="text-sm font-semibold text-gray-800">{item.icon} {item.title}</h5>
                  <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="p-4 bg-gray-50 rounded-xl">
              <h5 className="text-sm font-semibold text-gray-800 mb-2">📋 How to Request</h5>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <span className="text-sm font-bold text-[#A8874D]">1.</span>
                  <p className="text-xs text-gray-600">Click <strong>“Request Custom Design”</strong> above or <strong>WhatsApp us</strong> with your idea.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-sm font-bold text-[#A8874D]">2.</span>
                  <p className="text-xs text-gray-600">We&apos;ll send you a quote and mockup within 24 hours.</p>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-sm font-bold text-[#A8874D]">3.</span>
                  <p className="text-xs text-gray-600">Once approved, your custom piece is cut, finished, and shipped in <strong>3-5 business days</strong>.</p>
                </div>
              </div>
              <div className="mt-3 p-3 bg-white rounded-lg border border-gray-100">
                <p className="text-xs text-gray-500">
                  <strong>Bulk pricing:</strong> Custom orders of 50+ pieces receive volume discounts. Contact us for a tailored quote.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ─── MDF Tab: Care Guide ─── */}
        {isMDF && activeTab === "care-guide" && (
          <div className="max-w-3xl space-y-8">
            <div>
              <h4 className="text-base font-semibold text-gray-800 mb-3">Keep It Beautiful: MDF Care Guide</h4>
              <p className="text-sm text-gray-600 leading-relaxed">
                MDF is a durable and versatile material, but it does require a little care to keep it looking its best, especially in the UAE climate.
              </p>
            </div>

            <div className="space-y-4">
              {[
                { icon: "☀️", title: "Avoid Direct Sunlight", desc: "Prolonged UV exposure can cause MDF to dry out and crack. Display away from direct sun or use UV-filtering window treatments." },
                { icon: "💧", title: "Keep It Dry", desc: "MDF absorbs moisture. Keep pieces away from water, humid bathrooms, and outdoor use unless sealed. Wipe spills immediately." },
                { icon: "🎨", title: "Painting & Sealing", desc: "For unpainted MDF: apply 2 coats of acrylic primer, then 2 coats of acrylic paint. Seal with clear matte or gloss varnish for durability." },
                { icon: "🧹", title: "Cleaning", desc: "Dust with a soft dry cloth or microfiber duster. For deeper cleaning, use a slightly damp cloth, never soaking wet. Avoid chemical cleaners." },
                { icon: "🔧", title: "Touch-Ups", desc: "Small scratches can be filled with wood filler and repainted. Keep leftover paint for touch-ups. We can also send matching paint on request." },
                { icon: "🏠", title: "Best Placement", desc: "MDF performs best in climate-controlled indoor spaces. Bedrooms, living rooms, offices, and covered patios are ideal locations." },
              ].map((item, i) => (
                <div key={i} className="flex gap-3 p-4 bg-gray-50 rounded-xl">
                  <span className="text-xl flex-shrink-0">{item.icon}</span>
                  <div>
                    <h5 className="text-sm font-semibold text-gray-800">{item.title}</h5>
                    <p className="text-xs text-gray-500 mt-1 leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-4 bg-amber-50 rounded-xl border border-amber-200">
              <h5 className="text-sm font-semibold text-amber-700 mb-1">⚠️ Important for UAE Climate</h5>
              <p className="text-xs text-amber-600 leading-relaxed">
                The UAE&apos;s high humidity (especially in summer) and air conditioning can affect MDF. We recommend displaying MDF products away from AC vents and using a room humidifier if your indoor humidity drops below 30%. For outdoor use in covered areas, apply a weatherproof sealant.
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
                {/* relative is mandatory: <Image fill> positions against the
                    nearest positioned ancestor, so without it the image escapes
                    this card and blankets the page, covering Add to Cart. */}
                <div className="relative aspect-square overflow-hidden bg-gray-50">
                  <ProductImage src={p.imageUrl} alt={p.name} sizes="(min-width: 1024px) 300px, 45vw" className="object-cover group-hover:scale-105 transition-transform duration-500" />
                </div>
                <div className="p-3">
                  <h3 className="text-xs font-medium text-gray-800 line-clamp-2 group-hover:text-[#A8874D] transition-colors">{p.name}</h3>
                  <p className="text-sm font-bold text-gray-900 mt-1">{formatPrice(p.price)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recently Viewed */}
      {recentlyViewed.length > 0 && (
        <div className="mt-12 border-t border-gray-100 pt-10">
          <h2 className="text-lg font-bold tracking-tight mb-6">Recently Viewed</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {recentlyViewed.map((p) => (
              <Link key={p.slug} href={"/shop/" + p.slug} className="group bg-white rounded-xl border border-gray-100 overflow-hidden hover:shadow-lg transition-all duration-200">
                <div className="relative aspect-square overflow-hidden bg-gray-50"><ProductImage src={p.imageUrl} alt={p.name} sizes="(min-width: 1024px) 300px, 45vw" /></div>
                <div className="p-3"><h3 className="text-xs font-medium text-gray-800 line-clamp-2">{p.name}</h3><p className="text-sm font-bold text-gray-900 mt-1">{formatPrice(p.price)}</p></div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Sticky Mobile Add-to-Cart Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-bone border-t border-rule px-4 py-3 flex items-center gap-3 shadow-lg">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-ink-muted truncate">{product.name}</p>
          <p className="font-heading text-base text-ink tabular-nums">{formatPrice(product.price)}</p>
        </div>
        {isMDF && (
          <WhatsAppLink
            message={"Hi, I’m interested in " + product.name + ". Can you help?"}
            className="p-2.5 bg-[#25D366] text-white rounded-lg hover:bg-[#1da855] transition-colors flex-shrink-0"
            aria-label="WhatsApp"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </WhatsAppLink>
        )}
        <button data-testid="add-to-cart-mobile" onClick={handleAddToCart} disabled={product.stock === 0} className={`px-6 py-3 text-sm tracking-wide transition-colors disabled:opacity-50 ${added ? "bg-sage text-paper" : "bg-ink text-paper hover:bg-sand-dark"}`}>
          {added ? "Added" : "Add to cart"}
        </button>
      </div>
    </section>
  );
}
