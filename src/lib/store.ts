/**
 * Data store — self-hosted Postgres (Supabase) backend.
 *
 * Replaces the previous local JSON-file store. The app was originally built
 * against Supabase-style calls, so this module keeps the SAME public API
 * (orders / orderItems / productVariants / catalog) — the API routes that import
 * it are unchanged. Only the internals moved from a JSON file to Postgres.
 *
 * Server-only: uses the service-role key, so it bypasses RLS. Never import this
 * from client components.
 *
 *   - orders:          getAll / getById / getBySessionId / getByEmailPhone /
 *                      getByTracking / insert / update
 *   - orderItems:      getAll / insertMany
 *   - productVariants: getAll / getBySlug / upsertMany
 *   - catalog:         getAll / upsert / remove
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

let _client: SupabaseClient | null = null;
function db(): SupabaseClient {
  if (_client) return _client;
  if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    throw new Error(
      "[store] Supabase not configured — set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY"
    );
  }
  _client = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Normalize a phone to comparable digits (UAE): strip non-digits, leading 0 → 971.
function cleanPhone(p: string): string {
  return (p || "").replace(/\D/g, "").replace(/^0/, "971");
}
function phoneMatches(a: string, b: string): boolean {
  const ca = cleanPhone(a);
  const cb = cleanPhone(b);
  if (!ca || !cb) return false;
  return ca.endsWith(cb.slice(-8)) || cb.endsWith(ca.slice(-8));
}

// ───────────────────────── orders ─────────────────────────
export const orders = {
  async getAll(): Promise<any[]> {
    const { data, error } = await db()
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Accepts a full uuid (exact) or a prefix (best-effort). Bad input → null.
  async getById(id: string): Promise<any | null> {
    if (!id) return null;
    if (UUID_RE.test(id)) {
      const { data, error } = await db()
        .from("orders")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (error) return null;
      return data;
    }
    // Prefix lookup on the uuid, cast to text. If the backend rejects it, treat
    // as "not found" rather than erroring the request.
    const { data, error } = await db()
      .from("orders")
      .select("*")
      .ilike("id", `${id}%`)
      .limit(1);
    if (error || !data || !data.length) return null;
    return data[0];
  },

  // Idempotency lookup for Stripe webhooks — match the Stripe session id, which
  // lives in stripe_session_id (the column also has a UNIQUE constraint, so a
  // duplicate insert is rejected atomically even if two webhooks race).
  async getBySessionId(sessionId: string): Promise<any | null> {
    if (!sessionId) return null;
    const { data, error } = await db()
      .from("orders")
      .select("*")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();
    if (error) return null;
    return data;
  },

  async getByEmailPhone(email: string, phone: string): Promise<any[]> {
    const { data, error } = await db()
      .from("orders")
      .select("*")
      .ilike("customer_email", email)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []).filter((o) => phoneMatches(o.customer_phone || "", phone));
  },

  async getByTracking(id: string, phone: string): Promise<any | null> {
    const order = await this.getById(id);
    if (!order) return null;
    if (!phoneMatches(order.customer_phone || "", phone)) return null;
    return order;
  },

  async insert(order: any): Promise<any> {
    // Let Postgres generate id/created_at/updated_at unless explicitly provided.
    const { data, error } = await db()
      .from("orders")
      .insert(order)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Record<string, any>): Promise<any | null> {
    const { data, error } = await db()
      .from("orders")
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq("id", id)
      .select()
      .maybeSingle();
    if (error) return null;
    return data;
  },
};

// ───────────────────────── order_items ─────────────────────────
export const orderItems = {
  async getAll(): Promise<any[]> {
    const { data, error } = await db().from("order_items").select("*");
    if (error) throw error;
    return data || [];
  },
  async insertMany(items: any[]): Promise<void> {
    if (!items.length) return;
    const { error } = await db().from("order_items").insert(items);
    if (error) throw error;
  },
};

// ───────────────────────── product_variants ─────────────────────────
export const productVariants = {
  async getAll(): Promise<any[]> {
    const { data, error } = await db().from("product_variants").select("*");
    if (error) throw error;
    return data || [];
  },
  async getBySlug(slug: string): Promise<any[]> {
    const { data, error } = await db()
      .from("product_variants")
      .select("*")
      .eq("product_slug", slug);
    if (error) throw error;
    return data || [];
  },
  // Upsert on the UNIQUE (product_slug, variant_sku). Returns how many rows the
  // upsert wrote (inserts + updates) — callers only use it as a nonzero signal.
  async upsertMany(variants: any[]): Promise<number> {
    if (!variants.length) return 0;
    const { data, error } = await db()
      .from("product_variants")
      .upsert(variants, { onConflict: "product_slug,variant_sku" })
      .select("id");
    if (error) throw error;
    return data?.length || 0;
  },
};

// ───────────────────────── products (catalog overrides / imports) ─────────────────────────
// The storefront catalog also ships statically in src/lib/products.ts; this
// table holds imported/edited products (Postgres has the full 500+ row catalog).
export const catalog = {
  async getAll(): Promise<any[]> {
    const { data, error } = await db().from("products").select("*");
    if (error) throw error;
    return data || [];
  },
  async upsert(product: any): Promise<void> {
    const { error } = await db()
      .from("products")
      .upsert({ ...product, updated_at: new Date().toISOString() }, { onConflict: "slug" });
    if (error) throw error;
  },
  async remove(slug: string): Promise<void> {
    const { error } = await db().from("products").delete().eq("slug", slug);
    if (error) throw error;
  },
};

// ───────────────────────── newsletter subscribers ─────────────────────────
// Lives here rather than in the route so it shares db(), which resolves the
// URL from SUPABASE_URL *or* NEXT_PUBLIC_SUPABASE_URL. The container only sets
// the NEXT_PUBLIC_ one, so a route that read SUPABASE_URL directly threw
// "supabaseUrl is required" on every signup.
export const subscribers = {
  /** Returns true if this created a new subscriber, false if already on the list. */
  async add(email: string, source = "homepage"): Promise<boolean> {
    const { error } = await db()
      .from("newsletter_subscribers")
      .insert({ email: email.trim().toLowerCase(), source });
    // 23505 = unique violation on email. Subscribing twice is not a failure.
    if (error && error.code === "23505") return false;
    if (error) throw error;
    return true;
  },

  /**
   * Removes an address from the list.
   *
   * The privacy policy has always promised subscribers could opt out, so the
   * mechanism has to exist. It deletes the row outright rather than flagging it,
   * because keeping the address of someone who asked to be forgotten is the
   * opposite of what they asked for.
   */
  async remove(email: string): Promise<void> {
    const { error } = await db()
      .from("newsletter_subscribers")
      .delete()
      .eq("email", email.trim().toLowerCase());
    if (error) throw error;
  },
};
