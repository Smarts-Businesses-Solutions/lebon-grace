"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Product } from "./products";

export type DeliveryMethod = "pickup" | "delivery";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  deliveryMethod: DeliveryMethod;
  setDeliveryMethod: (method: DeliveryMethod) => void;
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (slug: string) => void;
  updateQuantity: (slug: string, quantity: number) => void;
  clearCart: () => void;
  totalItems: number;
  subtotal: number;
  shipping: number;
  total: number;
  depositNow: number;
  payOnDelivery: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

// Delivery. Pickup is free and is the default: it is the best margin for the
// workshop and avoids a courier fee that would otherwise exceed the price of a
// single AED 15 puzzle.
export const UAE_DELIVERY = 20;
export const FREE_DELIVERY_OVER = 150;

const CART_KEY = "lebon-grace-cart";
const CART_EMAIL_KEY = "lebon-grace-cart-email";
const CART_TS_KEY = "lebon-grace-cart-ts";

function loadCart(): CartItem[] {
  if (typeof window === "undefined") return [];
  try {
    const stored = localStorage.getItem(CART_KEY);
    if (stored) return JSON.parse(stored);
  } catch {
    // ignore corrupted data
  }
  return [];
}

function saveCart(items: CartItem[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
    localStorage.setItem(CART_TS_KEY, String(Date.now()));
  } catch {
    // ignore storage errors
  }
}

/** Save email for abandoned cart recovery */
export function saveCartEmail(email: string): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CART_EMAIL_KEY, email);
  } catch { /* ignore */ }
}

/** Get saved cart email */
export function getCartEmail(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(CART_EMAIL_KEY);
  } catch { return null; }
}

/** Get cart age in minutes (0 if fresh or no timestamp) */
export function getCartAge(): number {
  if (typeof window === "undefined") return 0;
  try {
    const ts = localStorage.getItem(CART_TS_KEY);
    if (!ts) return 0;
    return Math.floor((Date.now() - Number(ts)) / 60000);
  } catch { return 0; }
}

/** Clear cart recovery data after successful order */
export function clearCartRecovery(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(CART_EMAIL_KEY);
    localStorage.removeItem(CART_TS_KEY);
  } catch { /* ignore */ }
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [deliveryMethod, setDeliveryMethod] = useState<DeliveryMethod>("pickup");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setItems(loadCart());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) {
      saveCart(items);
    }
  }, [items, mounted]);

  const addItem = useCallback((product: Product, quantity = 1) => {
    setItems((prev) => {
      const existing = prev.find((item) => item.product.slug === product.slug);
      if (existing) {
        return prev.map((item) =>
          item.product.slug === product.slug
            ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock) }
            : item
        );
      }
      return [...prev, { product, quantity: Math.min(quantity, product.stock) }];
    });
  }, []);

  const removeItem = useCallback((slug: string) => {
    setItems((prev) => prev.filter((item) => item.product.slug !== slug));
  }, []);

  const updateQuantity = useCallback((slug: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((item) => item.product.slug !== slug));
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        item.product.slug === slug
          ? { ...item, quantity: Math.min(quantity, item.product.stock) }
          : item
      )
    );
  }, []);

  const clearCart = useCallback(() => {
    setItems([]);
  }, []);

  const totalItems = useMemo(
    () => items.reduce((sum, item) => sum + item.quantity, 0),
    [items]
  );

  const subtotal = useMemo(
    () => items.reduce((sum, item) => sum + item.product.price * item.quantity, 0),
    [items]
  );

  const shipping = useMemo(() => {
    if (deliveryMethod === "pickup") return 0;
    return subtotal >= FREE_DELIVERY_OVER ? 0 : UAE_DELIVERY;
  }, [subtotal, deliveryMethod]);

  const total = subtotal + shipping;

  // Payment is taken in full at checkout. The old 50/50 deposit plus cash on
  // delivery made sense when goods shipped from China and the customer waited
  // weeks; on made-to-order pieces cut locally in two to three days it only
  // added a courier COD handling fee and meant cutting wood before being paid.
  // These two values are kept so the order records and admin views keep their
  // shape, with the whole amount taken up front.
  const depositNow = total;
  const payOnDelivery = 0;

  const value = useMemo(
    () => ({
      items,
      deliveryMethod,
      setDeliveryMethod,
      addItem,
      removeItem,
      updateQuantity,
      clearCart,
      totalItems,
      subtotal,
      shipping,
      total,
      depositNow,
      payOnDelivery,
    }),
    [items, deliveryMethod, addItem, removeItem, updateQuantity, clearCart, totalItems, subtotal, shipping, total, depositNow, payOnDelivery]
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart(): CartContextType {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
