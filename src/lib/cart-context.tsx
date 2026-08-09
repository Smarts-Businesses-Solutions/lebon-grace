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
  /** Name to engrave. Free and optional; empty means no personalisation. */
  personalisation?: string;
}

/**
 * Cart lines are keyed by this, not by slug alone: the same puzzle ordered
 * twice with two different names is two different products to make, and must
 * not collapse into one line with quantity 2.
 */
export function lineId(item: CartItem): string {
  return item.personalisation ? `${item.product.slug}::${item.personalisation}` : item.product.slug;
}

interface CartContextType {
  items: CartItem[];
  deliveryMethod: DeliveryMethod;
  setDeliveryMethod: (method: DeliveryMethod) => void;
  addItem: (product: Product, quantity?: number, personalisation?: string) => void;
  removeItem: (id: string) => void;
  updateQuantity: (id: string, quantity: number) => void;
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
/**
 * Delivery choice, persisted alongside the cart.
 *
 * It used to live only in React state. The cart itself survived a reload but
 * this did not, so a customer who chose "Deliver to me" and then refreshed —
 * or opened /checkout directly, or came back with the browser's Back button —
 * was silently switched to pickup. /checkout has no toggle of its own
 * (checkout/page.tsx:172 only READS deliveryMethod), so the address fields
 * simply vanished and the order was quoted with free collection.
 *
 * Found by the Module C browser suite; regression test in
 * tests/e2e/money-path/checkout.spec.ts.
 */
const CART_DELIVERY_KEY = "lebon-grace-cart-delivery";

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

function loadDeliveryMethod(): DeliveryMethod {
  if (typeof window === "undefined") return "pickup";
  try {
    const stored = localStorage.getItem(CART_DELIVERY_KEY);
    if (stored === "delivery" || stored === "pickup") return stored;
  } catch {
    // ignore corrupted data
  }
  return "pickup";
}

function saveDeliveryMethod(method: DeliveryMethod): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(CART_DELIVERY_KEY, method);
  } catch {
    // ignore storage errors
  }
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

  // localStorage does not exist during SSR, so the cart CANNOT be read while
  // rendering — reading it in an effect after mount is the correct pattern, not
  // a workaround. Moving this into render would hydrate a server-empty cart
  // over a client-full one and throw a hydration mismatch.
  useEffect(() => {
    // The cart CANNOT be read while rendering: localStorage does not exist during
        // SSR, and hydrating a server-empty cart over a client-full one mismatches.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setItems(loadCart());
    // Restored here too, for the same reason and in the same breath: the cart
    // surviving a reload while the delivery choice did not is what silently
    // reverted customers to pickup.
    setDeliveryMethod(loadDeliveryMethod());
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted) saveDeliveryMethod(deliveryMethod);
  }, [deliveryMethod, mounted]);

  useEffect(() => {
    if (mounted) {
      saveCart(items);
    }
  }, [items, mounted]);

  const addItem = useCallback((product: Product, quantity = 1, personalisation?: string) => {
    const incoming: CartItem = { product, quantity, personalisation: personalisation || undefined };
    const id = lineId(incoming);
    setItems((prev) => {
      const existing = prev.find((item) => lineId(item) === id);
      if (existing) {
        return prev.map((item) =>
          lineId(item) === id
            ? { ...item, quantity: Math.min(item.quantity + quantity, product.stock) }
            : item
        );
      }
      return [...prev, { ...incoming, quantity: Math.min(quantity, product.stock) }];
    });
  }, []);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((item) => lineId(item) !== id));
  }, []);

  const updateQuantity = useCallback((id: string, quantity: number) => {
    if (quantity <= 0) {
      setItems((prev) => prev.filter((item) => lineId(item) !== id));
      return;
    }
    setItems((prev) =>
      prev.map((item) =>
        lineId(item) === id
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
