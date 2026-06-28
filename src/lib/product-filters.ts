/**
 * Product enrichment and filtering utilities.
 * Adds brand, color, size fields to products at runtime
 * based on keyword extraction from product names.
 */

import { products, type Product } from "./products";

// --- Color extraction ---
const COLOR_KEYWORDS: Record<string, string[]> = {
  Gold: ["gold", "golden"],
  Silver: ["silver"],
  Black: ["black"],
  White: ["white"],
  Red: ["red"],
  Blue: ["blue"],
  Green: ["green"],
  Pink: ["pink"],
  Purple: ["purple"],
  Brown: ["brown"],
  Grey: ["grey", "gray"],
  Beige: ["beige"],
  Navy: ["navy"],
  Rose: ["rose gold", "rose"],
  Orange: ["orange"],
  Yellow: ["yellow"],
  Cream: ["cream"],
  Ivory: ["ivory"],
  Bronze: ["bronze"],
  Copper: ["copper"],
  Champagne: ["champagne"],
  Wine: ["wine"],
  Burgundy: ["burgundy"],
  Teal: ["teal"],
  Mint: ["mint"],
  Coral: ["coral"],
  Peach: ["peach"],
  Lavender: ["lavender"],
  Turquoise: ["turquoise"],
  Leopard: ["leopard"],
  Rainbow: ["rainbow", "multicolor", "mixed color"],
  Transparent: ["transparent", "clear"],
};

function extractColor(name: string): string {
  const lower = name.toLowerCase();
  for (const [color, keywords] of Object.entries(COLOR_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return color;
    }
  }
  return "";
}

// --- Size extraction ---
const SIZE_KEYWORDS: Record<string, string[]> = {
  Mini: ["mini"],
  Small: ["small"],
  Medium: ["medium"],
  Large: ["large"],
  XL: ["xl", "extra large"],
  Oversized: ["oversized"],
};

function extractSize(name: string): string {
  const lower = name.toLowerCase();
  for (const [size, keywords] of Object.entries(SIZE_KEYWORDS)) {
    for (const kw of keywords) {
      // Match whole word to avoid false positives
      const regex = new RegExp(`\\b${kw}\\b`, "i");
      if (regex.test(lower)) return size;
    }
  }
  return "";
}

// --- Material extraction ---
const MATERIAL_KEYWORDS: Record<string, string[]> = {
  StainlessSteel: ["stainless steel"],
  Leather: ["leather", "cowhide", "genuine leather"],
  Wood: ["wooden", "wood", "bamboo"],
  Crystal: ["crystal"],
  PVC: ["pvc"],
  Silicone: ["silicone"],
  Cotton: ["cotton"],
  Polyester: ["polyester", "poly"],
  Velvet: ["velvet"],
  Ceramic: ["ceramic"],
  Glass: ["glass"],
  Metal: ["metal", "aluminum", "alloy"],
  Plastic: ["plastic"],
  Rubber: ["rubber"],
  Paper: ["paper", "kraft"],
  Resin: ["resin"],
  Acrylic: ["acrylic"],
};

function extractMaterial(name: string): string {
  const lower = name.toLowerCase();
  for (const [material, keywords] of Object.entries(MATERIAL_KEYWORDS)) {
    for (const kw of keywords) {
      if (lower.includes(kw)) return material.replace(/([A-Z])/g, " $1").trim();
    }
  }
  return "";
}

// --- Enriched product type ---
export interface EnrichedProduct extends Product {
  color: string;
  size: string;
  material: string;
  brand: string;
}

// --- Enrich all products at runtime ---
const enrichedProducts: EnrichedProduct[] = products.map((p) => ({
  ...p,
  color: extractColor(p.name),
  size: extractSize(p.name),
  material: extractMaterial(p.name) || p.details?.material || "",
  brand: "Lebon Grace", // All products are unbranded / white-label
}));

export { enrichedProducts as products };

// --- Filter options (derived from data) ---
export const COLORS = Array.from(new Set(enrichedProducts.map((p) => p.color).filter(Boolean))).sort();
export const SIZES = Array.from(new Set(enrichedProducts.map((p) => p.size).filter(Boolean))).sort();
export const MATERIALS = Array.from(new Set(enrichedProducts.map((p) => p.material).filter(Boolean))).sort();
export const BRANDS = Array.from(new Set(enrichedProducts.map((p) => p.brand).filter(Boolean))).sort();
export const PRICE_TIERS = [
  { label: "Under AED 10", min: 0, max: 10 },
  { label: "AED 10 – 20", min: 10, max: 20 },
  { label: "AED 20 – 35", min: 20, max: 35 },
  { label: "AED 35+", min: 35, max: Infinity },
];

// --- Filter state type ---
export interface FilterState {
  category: string;
  colors: string[];
  sizes: string[];
  materials: string[];
  priceMin: number;
  priceMax: number;
  search: string;
  sortBy: string;
}

export const DEFAULT_FILTERS: FilterState = {
  category: "All",
  colors: [],
  sizes: [],
  materials: [],
  priceMin: 0,
  priceMax: Infinity,
  search: "",
  sortBy: "featured",
};

// --- Apply filters ---
export function applyFilters(products: EnrichedProduct[], filters: FilterState): EnrichedProduct[] {
  let result = [...products];

  // Category
  if (filters.category && filters.category !== "All") {
    result = result.filter((p) => p.category === filters.category);
  }

  // Colors
  if (filters.colors.length > 0) {
    result = result.filter((p) => filters.colors.includes(p.color));
  }

  // Sizes
  if (filters.sizes.length > 0) {
    result = result.filter((p) => filters.sizes.includes(p.size));
  }

  // Materials
  if (filters.materials.length > 0) {
    result = result.filter((p) => filters.materials.includes(p.material));
  }

  // Price range
  result = result.filter((p) => p.price >= filters.priceMin && p.price <= filters.priceMax);

  // Search
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.category.toLowerCase().includes(q) ||
        p.color.toLowerCase().includes(q) ||
        p.material.toLowerCase().includes(q)
    );
  }

  // Sort
  switch (filters.sortBy) {
    case "price-low":
      result.sort((a, b) => a.price - b.price);
      break;
    case "price-high":
      result.sort((a, b) => b.price - a.price);
      break;
    case "name-az":
      result.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case "name-za":
      result.sort((a, b) => b.name.localeCompare(a.name));
      break;
    default:
      break; // "featured" = original order
  }

  return result;
}

// --- Count products per filter value ---
export function getFilterCounts(products: EnrichedProduct[], activeCategory: string) {
  const filtered = activeCategory === "All" ? products : products.filter((p) => p.category === activeCategory);

  const colorCounts: Record<string, number> = {};
  const sizeCounts: Record<string, number> = {};
  const materialCounts: Record<string, number> = {};

  filtered.forEach((p) => {
    if (p.color) colorCounts[p.color] = (colorCounts[p.color] || 0) + 1;
    if (p.size) sizeCounts[p.size] = (sizeCounts[p.size] || 0) + 1;
    if (p.material) materialCounts[p.material] = (materialCounts[p.material] || 0) + 1;
  });

  return { colorCounts, sizeCounts, materialCounts };
}
