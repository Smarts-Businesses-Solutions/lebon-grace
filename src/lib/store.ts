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
import { phoneMatches } from "./phone";

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

/**
 * A row as PostgREST returns it.
 *
 * `any` was used for every return type here, which is 20 of this project's lint
 * errors and, more to the point, meant a typo in a column name compiled
 * silently. These interfaces name the columns the application actually reads,
 * with an `unknown` index signature so a column nobody has typed yet is still
 * reachable — but reachable as `unknown`, which has to be narrowed rather than
 * used by accident.
 *
 * Nullability mirrors the database, including the constraints added in
 * migration 0002: `orders.status`, `subtotal`, `total`, `deposit_amount` and
 * `cod_amount` are NOT NULL there, so they are non-optional here. Where the two
 * disagree, the database is right and this file is the bug.
 */
export interface OrderRow {
  id: string;
  status: string;
  subtotal: number;
  total: number;
  deposit_amount: number;
  cod_amount: number;
  shipping?: number | null;
  stripe_session_id?: string | null;
  stripe_payment_intent?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  customer_email_lc?: string | null;
  customer_phone?: string | null;
  delivery_address?: string | null;
  emirate?: string | null;
  delivery_method?: string | null;
  tracking_number?: string | null;
  courier_name?: string | null;
  notes?: string | null;
  metadata?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  [column: string]: unknown;
}

export interface OrderItemRow {
  id?: string;
  order_id: string;
  product_slug?: string | null;
  product_name?: string | null;
  /** Own column since migration 0004 — the workshop queue reads it. */
  personalisation?: string | null;
  price: number;
  quantity: number;
  image_url?: string | null;
  [column: string]: unknown;
}

export interface ProductRow {
  slug: string;
  name?: string | null;
  category?: string | null;
  price: number;
  stock?: number | null;
  image_url?: string | null;
  hidden?: boolean | null;
  cj_pid?: string | null;
  cj_price?: string | null;
  [column: string]: unknown;
}

export interface VariantRow {
  id?: string;
  product_slug: string;
  variant_sku?: string | null;
  variant_name?: string | null;
  variant_image?: string | null;
  variant_color?: string | null;
  variant_size?: string | null;
  variant_price?: number | null;
  [column: string]: unknown;
}

export interface ReviewRow {
  id: string;
  order_id?: string;
  product_slug?: string;
  rating: number;
  comment?: string | null;
  customer_name?: string;
  created_at?: string;
  [column: string]: unknown;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// What a customer may type into Track Order. The receipt shows the first eight
// characters of the uuid (TrackClient.tsx:205 renders `#${id.slice(0, 8)}`), so
// eight hex characters is the shortest real order reference; a uuid prefix is
// hex and hyphens and nothing else.
//
// Enforcing that matters because the prefix branch below builds a LIKE pattern
// out of this string. Anything shorter is a probe rather than a reference —
// `?id=a` matched every order beginning with "a" — and the pattern characters
// were live: `_` matches any single character, and PostgREST treats `*` as an
// alias for `%` so it never has to be URL-encoded. `?id=*` therefore searched
// on `%%`, matched the entire orders table and returned an arbitrary row.
// Only the phone check stood between that and a stranger's name, address and
// order history, which reduced the credential from "your order id and your
// phone" to "a phone number" — the id stopped being a secret at all.
const ID_PREFIX_RE = /^[0-9a-f]{8}[0-9a-f-]*$/i;

// Phone comparison moved to src/lib/phone.ts. It was two private functions
// here, which is exactly why the defect in it survived: nothing could reach
// them without a database, so nothing tested them. `ca.endsWith(cb.slice(-8))`
// let a SHORT input widen the match — supplying "7" matched any number ending
// in 7, so ten attempts defeated the phone half of the credential against a
// limit of ten an hour.

// ───────────────────────── orders ─────────────────────────
export const orders = {
  async getAll(): Promise<OrderRow[]> {
    const { data, error } = await db()
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  // Accepts a full uuid (exact) or a prefix (best-effort). Bad input → null.
  async getById(id: string): Promise<OrderRow | null> {
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
    if (!ID_PREFIX_RE.test(id)) return null;
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
  async getBySessionId(sessionId: string): Promise<OrderRow | null> {
    if (!sessionId) return null;
    const { data, error } = await db()
      .from("orders")
      .select("*")
      .eq("stripe_session_id", sessionId)
      .maybeSingle();
    if (error) return null;
    return data;
  },

  async getByEmailPhone(email: string, phone: string): Promise<OrderRow[]> {
    // Matches on customer_email_lc, a stored generated column holding
    // lower(customer_email), indexed by 0003. This was `.ilike("customer_email",
    // email)` with no wildcards — case-insensitive equality written with a
    // pattern operator, which is exactly what stopped it using an index, so
    // every /account lookup scanned the whole orders table.
    //
    // Behaviour is unchanged: same rows, still case-insensitive. Only the plan
    // differs. Lowercasing here must stay in step with the column's lower().
    const { data, error } = await db()
      .from("orders")
      .select("*")
      .eq("customer_email_lc", email.trim().toLowerCase())
      .order("created_at", { ascending: false });
    if (error) throw error;
    // The phone stays in JavaScript on purpose — see the note at the foot of
    // 0003. It is a last-eight-digits comparison, which no btree index can
    // serve, and by this point the set is one address's orders.
    return (data || []).filter((o) => phoneMatches(o.customer_phone || "", phone));
  },

  /**
   * The order a Stripe charge belongs to.
   *
   * `charge.refunded` carries `payment_intent`, and the webhook has always
   * written `stripe_payment_intent` when the session completed — so a refund
   * maps back to its order with no schema change and no call out to Stripe.
   * The column was there and nothing read it.
   */
  async getByPaymentIntent(paymentIntent: string): Promise<OrderRow | null> {
    if (!paymentIntent) return null;
    const { data, error } = await db()
      .from("orders")
      .select("*")
      .eq("stripe_payment_intent", paymentIntent)
      .maybeSingle();
    if (error) throw error;
    return data;
  },

  async getByTracking(id: string, phone: string): Promise<OrderRow | null> {
    const order = await this.getById(id);
    if (!order) return null;
    if (!phoneMatches(order.customer_phone || "", phone)) return null;
    return order;
  },

  async insert(order: Partial<OrderRow>): Promise<OrderRow> {
    // Let Postgres generate id/created_at/updated_at unless explicitly provided.
    const { data, error } = await db()
      .from("orders")
      .insert(order)
      .select()
      .single();
    if (error) throw error;
    return data;
  },

  async update(id: string, updates: Partial<OrderRow>): Promise<OrderRow | null> {
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
  async getAll(): Promise<OrderItemRow[]> {
    const { data, error } = await db().from("order_items").select("*");
    if (error) throw error;
    return data || [];
  },

  /**
   * The items of ONE order.
   *
   * `/api/reviews` answered "did this order contain this piece?" by calling
   * `getAll()` and filtering in JavaScript — reading every order item in the
   * database into the Node process on every review submission, to look at one
   * order's worth of rows.
   *
   * `idx_order_items_order_id` has existed since the baseline (line 3100); the
   * query simply never used it. That is A-12's shape exactly: there, an index
   * was added and `.ilike` stopped the planner reaching it; here the column is
   * indexed and nothing asked for it.
   *
   * Not a correctness bug today — `PGRST_DB_MAX_ROWS` is unset on this estate's
   * PostgREST containers, checked rather than assumed, so nothing is silently
   * truncated. It is the cost that is wrong, and the rate limit permits ten
   * submissions an hour per IP.
   */
  async getByOrder(orderId: string): Promise<OrderItemRow[]> {
    const { data, error } = await db().from("order_items").select("*").eq("order_id", orderId);
    if (error) throw error;
    return data || [];
  },
  async insertMany(items: Partial<OrderItemRow>[]): Promise<void> {
    if (!items.length) return;
    const { error } = await db().from("order_items").insert(items);
    if (error) throw error;
  },
};

// ───────────────────────── product_reviews ─────────────────────────
// Every row is tied to an order by foreign key (migration 0005), which is what
// makes "ratings shown are backed by a real order" structural rather than a
// promise. See src/app/page.tsx:9-25 for why that matters here.
export const reviews = {
  /** Published reviews for one product, newest first. */
  async getBySlug(slug: string): Promise<ReviewRow[]> {
    if (!slug) return [];
    const { data, error } = await db()
      .from("product_reviews")
      .select("id, rating, comment, customer_name, created_at")
      .eq("product_slug", slug)
      .order("created_at", { ascending: false });
    if (error) throw error;
    return data || [];
  },

  /**
   * Average and count per slug, for the catalogue grid.
   *
   * Aggregated in JS rather than SQL because PostgREST cannot express GROUP BY
   * without a database view, and the review count here is small enough that the
   * round trip is the cost, not the arithmetic. Revisit with a view if this
   * table ever reaches five figures.
   */
  async aggregates(): Promise<Record<string, { average: number; count: number }>> {
    const { data, error } = await db().from("product_reviews").select("product_slug, rating");
    if (error) throw error;
    const totals = new Map<string, { sum: number; count: number }>();
    for (const row of data || []) {
      const slug = String(row.product_slug);
      const t = totals.get(slug) || { sum: 0, count: 0 };
      t.sum += Number(row.rating) || 0;
      t.count += 1;
      totals.set(slug, t);
    }
    const out: Record<string, { average: number; count: number }> = {};
    for (const [slug, t] of totals) {
      out[slug] = { average: Math.round((t.sum / t.count) * 10) / 10, count: t.count };
    }
    return out;
  },

  /** Reviews already left against one order, so the form can grey them out. */
  async getByOrder(orderId: string): Promise<Pick<ReviewRow, "product_slug">[]> {
    if (!orderId) return [];
    const { data, error } = await db()
      .from("product_reviews")
      .select("product_slug")
      .eq("order_id", orderId);
    if (error) return [];
    return data || [];
  },

  /** Has this order already reviewed this piece? Enforced by a UNIQUE too. */
  async existsFor(orderId: string, slug: string): Promise<boolean> {
    const { data, error } = await db()
      .from("product_reviews")
      .select("id")
      .eq("order_id", orderId)
      .eq("product_slug", slug)
      .maybeSingle();
    if (error) return false;
    return !!data;
  },

  async insert(review: Partial<ReviewRow>): Promise<ReviewRow> {
    const { data, error } = await db().from("product_reviews").insert(review).select().single();
    if (error) throw error;
    return data;
  },
};

// ───────────────────────── product_variants ─────────────────────────
export const productVariants = {
  async getAll(): Promise<VariantRow[]> {
    const { data, error } = await db().from("product_variants").select("*");
    if (error) throw error;
    return data || [];
  },
  async getBySlug(slug: string): Promise<VariantRow[]> {
    const { data, error } = await db()
      .from("product_variants")
      .select("*")
      .eq("product_slug", slug);
    if (error) throw error;
    return data || [];
  },
  // Upsert on the UNIQUE (product_slug, variant_sku). Returns how many rows the
  // upsert wrote (inserts + updates) — callers only use it as a nonzero signal.
  async upsertMany(variants: Partial<VariantRow>[]): Promise<number> {
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
  async getAll(): Promise<ProductRow[]> {
    const { data, error } = await db().from("products").select("*");
    if (error) throw error;
    return data || [];
  },
  async upsert(product: Partial<ProductRow>): Promise<void> {
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
  /**
   * The list, for the operator.
   *
   * This did not exist. `subscribers` had `add` and `remove` and nothing else,
   * so an address typed into the homepage went into a table that **nothing in
   * the application could read** — no admin view, no export, no send path. The
   * homepage meanwhile promises "We will email you when there is something
   * new", which was a promise the system had no way to keep.
   *
   * Newest first, because the useful question is "who joined since I last
   * looked".
   */
  async getAll(): Promise<Array<{ id: string; email: string; source: string | null; created_at: string }>> {
    const { data, error } = await db()
      .from("newsletter_subscribers")
      .select("id,email,source,created_at")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return (data || []) as Array<{ id: string; email: string; source: string | null; created_at: string }>;
  },

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

/**
 * The operator's action trail (AD-02).
 *
 * Append-only by design: there is `record` and there is `forTarget`, and
 * deliberately no update or delete. An audit trail the application can rewrite
 * is not an audit trail.
 */
export const adminActions = {
  /** Write one action. Returns false rather than throwing — see lib/audit.ts. */
  async record(
    action: string,
    targetType: string,
    targetId: string,
    details: Record<string, unknown> = {}
  ): Promise<boolean> {
    const { error } = await db()
      .from("admin_actions")
      .insert({ action, target_type: targetType, target_id: String(targetId), details });

    if (error) {
      // supabase-js reports failures in `error` instead of throwing — the same
      // convention that hid B-30 for months, so it is checked explicitly.
      console.error(`[audit] could not record ${action} on ${targetType}:${targetId}: ${error.message}`);
      return false;
    }
    return true;
  },

  /** Everything recorded against one target, newest first. */
  async forTarget(targetType: string, targetId: string) {
    const { data, error } = await db()
      .from("admin_actions")
      .select("id,action,details,created_at")
      .eq("target_type", targetType)
      .eq("target_id", String(targetId))
      .order("created_at", { ascending: false });

    if (error) throw error;
    return data ?? [];
  },
};
