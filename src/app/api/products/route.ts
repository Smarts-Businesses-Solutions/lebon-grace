import { NextRequest, NextResponse } from "next/server";
import { products as defaultProducts } from "@/lib/products";
import fs from "fs";
import path from "path";

const DATA_FILE = path.join(process.cwd(), "data", "products.json");

function loadProducts() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const data = fs.readFileSync(DATA_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch {}
  // Fallback to default products
  return defaultProducts.map((p) => ({
    slug: p.slug,
    name: p.name,
    variant: p.variant,
    price: p.price,
    category: p.category,
    stock: p.stock,
    description: p.description,
    details: p.details,
    imagePlaceholder: p.imagePlaceholder,
    imageUrl: p.imageUrl,
    cjPid: p.cjPid,
    cjPrice: p.cjPrice,
  }));
}

function saveProducts(products: unknown[]) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(products, null, 2));
}

export async function GET() {
  const products = loadProducts();
  return NextResponse.json(products);
}

export async function PUT(request: NextRequest) {
  const body = await request.json();
  const { slug, ...updates } = body;

  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const products = loadProducts();
  const index = products.findIndex((p: { slug: string }) => p.slug === slug);

  if (index === -1) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  products[index] = { ...products[index], ...updates };
  saveProducts(products);

  return NextResponse.json({ success: true, product: products[index] });
}

export async function DELETE(request: NextRequest) {
  const body = await request.json();
  const { slug } = body;

  if (!slug) {
    return NextResponse.json({ error: "slug required" }, { status: 400 });
  }

  const products = loadProducts();
  const filtered = products.filter((p: { slug: string }) => p.slug !== slug);

  if (filtered.length === products.length) {
    return NextResponse.json({ error: "Product not found" }, { status: 404 });
  }

  saveProducts(filtered);
  return NextResponse.json({ success: true, count: filtered.length });
}
