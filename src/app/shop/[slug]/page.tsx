"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { useCart } from "@/lib/cart-context";
import { getProductBySlug, formatPrice, products } from "@/lib/products";

export default function ProductDetailPage() {
  const params = useParams();
  const slug = params.slug as string;
  const product = getProductBySlug(slug);
  const { addItem } = useCart();
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
        <h1 className="font-heading text-2xl font-semibold">Product Not Found</h1>
        <p className="mt-4 text-warm-gray text-sm">The product you are looking for does not exist.</p>
        <Link href="/shop" className="mt-6 inline-block text-sand text-sm font-medium hover:text-sand-dark transition-colors">
          Back to Shop
        </Link>
      </div>
    );
  }

  const handleAddToCart = () => {
    addItem(product, quantity);
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 lg:py-12">
      {/* Breadcrumb */}
      <nav className="mb-8 flex items-center gap-2 text-sm text-warm-gray">
        <Link href="/shop" className="hover:text-sand transition-colors">Shop</Link>
        <span>/</span>
        <Link href={"/shop?category=" + product.category} className="hover:text-sand transition-colors">{product.category}</Link>
        <span>/</span>
        <span className="text-dark">{product.name}</span>
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
        {/* Product Image */}
        <div className="aspect-square rounded-sm overflow-hidden bg-surface">
          <img
            src={product.imageUrl}
            alt={product.name}
            className="w-full h-full object-cover"
            loading="lazy"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.style.display = 'none';
              const parent = target.parentElement;
              if (parent) {
                parent.style.backgroundColor = product.imagePlaceholder.bg;
                parent.style.display = 'flex';
                parent.style.alignItems = 'center';
                parent.style.justifyContent = 'center';
                const span = document.createElement('span');
                span.className = 'font-heading text-7xl lg:text-8xl font-semibold opacity-80';
                span.style.color = (product.imagePlaceholder.bg === "#C9A96E" || product.imagePlaceholder.bg === "#D4BA85") ? "#2D2D2D" : "#FAF8F5";
                span.textContent = product.imagePlaceholder.initials;
                parent.appendChild(span);
              }
            }}
          />
        </div>

        {/* Product Info */}
        <div className="flex flex-col">
          <p className="text-sand text-xs tracking-[0.2em] uppercase mb-3">{product.category}</p>
          <h1 className="font-heading text-2xl lg:text-3xl font-semibold tracking-tight">{product.name}</h1>
          <p className="mt-1 text-warm-gray text-sm tracking-wide">{product.variant}</p>
          <p className="mt-4 font-heading text-2xl font-semibold text-dark">{formatPrice(product.price)}</p>

          <div className="mt-6">
            <p className="text-charcoal text-sm leading-relaxed">{product.description}</p>
          </div>

          {/* Quantity + Add to Cart */}
          <div className="mt-8 flex flex-col gap-4">
            <div className="flex items-center gap-3">
              <label className="text-sm text-charcoal tracking-wide">Quantity</label>
              <div className="flex items-center border border-border rounded-sm">
                <button
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  className="px-3 py-2 text-charcoal hover:text-sand transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12h-15" /></svg>
                </button>
                <span className="px-4 py-2 text-sm font-medium min-w-[40px] text-center">{quantity}</span>
                <button
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  className="px-3 py-2 text-charcoal hover:text-sand transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" /></svg>
                </button>
              </div>
              <span className="text-warm-gray text-xs">{product.stock} in stock</span>
            </div>

            <button
              onClick={handleAddToCart}
              className={`w-full py-3.5 text-sm tracking-wider uppercase font-medium rounded-lg transition-colors ${
                added
                  ? "bg-[#16A34A] text-white"
                  : "bg-[#16A34A] text-white hover:bg-[#15803D]"
              }`}
            >
              {added ? "Added to Cart" : "Add to Cart"}
            </button>
          </div>

          {/* 50/50 Payment */}
          <div className="mt-6 p-4 bg-offwhite rounded-sm border border-border">
            <h3 className="text-sm font-medium text-charcoal tracking-wide">50/50 Payment</h3>
            <p className="mt-1 text-warm-gray text-xs leading-relaxed">
              Pay 50% now ({formatPrice(Math.round(product.price / 2))}) via credit card, and the remaining 50% ({formatPrice(Math.ceil(product.price / 2))}) as cash on delivery when your order arrives.
            </p>
          </div>

          {/* Product Details */}
          <div className="mt-6 border-t border-border pt-6">
            <h3 className="text-sm font-medium text-charcoal tracking-wide mb-3">Product Details</h3>
            <dl className="space-y-2">
              {product.details.dimensions && (
                <div className="flex gap-3">
                  <dt className="text-warm-gray text-xs w-24 flex-shrink-0">Dimensions</dt>
                  <dd className="text-charcoal text-xs">{product.details.dimensions}</dd>
                </div>
              )}
              <div className="flex gap-3">
                <dt className="text-warm-gray text-xs w-24 flex-shrink-0">Material</dt>
                <dd className="text-charcoal text-xs">{product.details.material}</dd>
              </div>
              {product.details.care && (
                <div className="flex gap-3">
                  <dt className="text-warm-gray text-xs w-24 flex-shrink-0">Care</dt>
                  <dd className="text-charcoal text-xs">{product.details.care}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      </div>

      {/* Related Products */}
      <div className="mt-16 lg:mt-24 border-t border-border pt-12">
        <h2 className="font-heading text-2xl font-semibold tracking-tight mb-8">You May Also Like</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {products.filter((p) => p.slug !== product.slug).slice(0, 3).map((p) => (
            <Link key={p.slug} href={"/shop/" + p.slug} className="group bg-offwhite rounded-sm border border-border overflow-hidden hover:border-sand/40 transition-all duration-300">
              <div className="aspect-square overflow-hidden bg-surface">
                <img
                  src={p.imageUrl}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  loading="lazy"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.style.display = 'none';
                    const parent = target.parentElement;
                    if (parent) {
                      parent.style.backgroundColor = p.imagePlaceholder.bg;
                      parent.style.display = 'flex';
                      parent.style.alignItems = 'center';
                      parent.style.justifyContent = 'center';
                      const span = document.createElement('span');
                      span.className = 'font-heading text-4xl font-semibold opacity-80';
                      span.style.color = (p.imagePlaceholder.bg === "#C9A96E" || p.imagePlaceholder.bg === "#D4BA85") ? "#2D2D2D" : "#FAF8F5";
                      span.textContent = p.imagePlaceholder.initials;
                      parent.appendChild(span);
                    }
                  }}
                />
              </div>
              <div className="p-4">
                <h3 className="font-heading text-sm font-medium tracking-tight group-hover:text-sand transition-colors">{p.name}</h3>
                <p className="text-warm-gray text-xs mt-1">{formatPrice(p.price)}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
