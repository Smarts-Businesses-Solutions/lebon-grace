import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-auth";
import { orders as orderStore, orderItems } from "@/lib/store";
import { buildProductionQueue } from "@/lib/production-queue";
import { products, categories } from "@/lib/products";

/**
 * `created_at` is nullable in OrderRow, and it always was in the database — the
 * `any` return type simply hid that `new Date(undefined)` yields Invalid Date,
 * which then poisons every comparison it touches without throwing.
 *
 * Undated rows fall back to the epoch, so they sort oldest and never satisfy a
 * "within the last N days" window. That is the safe direction: an undated order
 * is excluded from a recency bucket rather than silently counted as today's.
 */
function createdAt(value: unknown): Date {
  return new Date(typeof value === "string" && value ? value : 0);
}

/** Same reasoning for the string fields the groupings key on. */
function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function GET(request: NextRequest) {
  // Business metrics (revenue, orders, customers) — admin only.
  if (!requireAdmin(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Fetch all orders
    const orders = await orderStore.getAll();

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const allOrders = orders || [];

    // ─── Financial Metrics ───
    const totalRevenue = allOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const deliveredStatuses = ["delivered", "completed"];
    const pendingStatuses = ["deposit_paid", "processing", "shipped", "out_for_delivery"];



    const avgOrderValue = allOrders.length > 0 ? Math.round(totalRevenue / allOrders.length) : 0;

    const ordersToday = allOrders.filter((o) => createdAt(o.created_at) >= today).length;
    const revenueToday = allOrders
      .filter((o) => createdAt(o.created_at) >= today)
      .reduce((s, o) => s + Number(o.total || 0), 0);

    const ordersWeek = allOrders.filter((o) => createdAt(o.created_at) >= weekAgo).length;
    const revenueWeek = allOrders
      .filter((o) => createdAt(o.created_at) >= weekAgo)
      .reduce((s, o) => s + Number(o.total || 0), 0);

    const ordersMonth = allOrders.filter((o) => createdAt(o.created_at) >= monthStart).length;
    const revenueMonth = allOrders
      .filter((o) => createdAt(o.created_at) >= monthStart)
      .reduce((s, o) => s + Number(o.total || 0), 0);

    // ─── Pipeline Metrics ───
    const statusCounts: Record<string, { count: number; total: number }> = {};
    allOrders.forEach((o) => {
      if (!statusCounts[o.status]) statusCounts[o.status] = { count: 0, total: 0 };
      statusCounts[o.status].count++;
      statusCounts[o.status].total += Number(o.total || 0);
    });

    // ─── Fulfillment Metrics ───
    const deliveredOrders = allOrders.filter((o) => deliveredStatuses.includes(o.status));
    const fulfillmentDays = deliveredOrders
      .filter((o) => o.updated_at && o.created_at)
      .map((o) => {
        const created = createdAt(o.created_at).getTime();
        const updated = createdAt(o.updated_at).getTime();
        return (updated - created) / (24 * 60 * 60 * 1000);
      });
    const avgFulfillmentDays = fulfillmentDays.length > 0
      ? Math.round(fulfillmentDays.reduce((s, d) => s + d, 0) / fulfillmentDays.length)
      : 0;

    const ordersAwaiting = allOrders.filter((o) => o.status === "deposit_paid").length;
    const ordersInTransit = allOrders.filter((o) => ["shipped", "out_for_delivery"].includes(o.status)).length;
    const deliverySuccessRate = allOrders.length > 0
      ? Math.round((deliveredOrders.length / Math.max(allOrders.length, 1)) * 100)
      : 0;

    const pickupOrders = allOrders.filter((o) => {
      try { return JSON.parse(o.metadata || "{}").delivery_method === "pickup"; } catch { return false; }
    }).length;
    const deliveryOrders = allOrders.length - pickupOrders;


    // ─── Customer Metrics ───
    const customerMap = new Map<string, { name: string; phone: string; orders: number; total: number; lastOrder: string }>();
    allOrders.forEach((o) => {
      const key = o.customer_phone || o.customer_email || o.customer_name;
      const existing = customerMap.get(String(key));
      if (existing) {
        existing.orders++;
        existing.total += Number(o.total || 0);
        if (str(o.created_at) > existing.lastOrder) existing.lastOrder = str(o.created_at);
      } else {
        customerMap.set(String(key), {
          name: o.customer_name || "Unknown",
          phone: o.customer_phone || "",
          orders: 1,
          total: Number(o.total || 0),
          lastOrder: str(o.created_at),
        });
      }
    });

    const customers = Array.from(customerMap.values());
    const totalCustomers = customers.length;
    const repeatCustomers = customers.filter((c) => c.orders > 1).length;
    const repeatRate = totalCustomers > 0 ? Math.round((repeatCustomers / totalCustomers) * 100) : 0;
    const topCustomers = customers.sort((a, b) => b.total - a.total).slice(0, 10);

    // ─── Orders by Emirate ───
    const emirateCounts: Record<string, number> = {};
    allOrders.forEach((o) => {
      const emirate = o.emirate || "Unknown";
      emirateCounts[emirate] = (emirateCounts[emirate] || 0) + 1;
    });

    // ─── Charts (last 30 days) ───
    const thirtyDaysAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ordersPerDay: Record<string, number> = {};
    const revenuePerDay: Record<string, number> = {};
    for (let i = 0; i < 30; i++) {
      const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      ordersPerDay[key] = 0;
      revenuePerDay[key] = 0;
    }
    allOrders
      .filter((o) => createdAt(o.created_at) >= thirtyDaysAgo)
      .forEach((o) => {
        const key = createdAt(o.created_at).toISOString().slice(0, 10);
        ordersPerDay[key] = (ordersPerDay[key] || 0) + 1;
        revenuePerDay[key] = (revenuePerDay[key] || 0) + Number(o.total || 0);
      });

    const ordersChart = Object.entries(ordersPerDay).reverse().map(([date, count]) => ({ date, count }));
    const revenueChart = Object.entries(revenuePerDay).reverse().map(([date, amount]) => ({ date, amount }));

    // ─── Product Metrics (from order_items if available) ───
    let bestSellers: { name: string; quantity: number; revenue: number }[] = [];
    let revenueByCategory: Record<string, number> = {};
    // Hoisted out of the try below so the production queue can reuse the same
    // fetch rather than hitting order_items twice per dashboard load.
    let items: Awaited<ReturnType<typeof orderItems.getAll>> = [];

    try {
      items = await orderItems.getAll();

      if (items && items.length > 0) {
        const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
        items.forEach((item) => {
          const existing = productSales.get(str(item.product_slug) || str(item.product_name));
          if (existing) {
            existing.quantity += item.quantity || 1;
            existing.revenue += Number(item.price || 0) * (item.quantity || 1);
          } else {
            productSales.set(str(item.product_slug) || str(item.product_name), {
              name: str(item.product_name),
              quantity: item.quantity || 1,
              revenue: Number(item.price || 0) * (item.quantity || 1),
            });
          }
        });
        bestSellers = Array.from(productSales.values())
          .sort((a, b) => b.quantity - a.quantity)
          .slice(0, 10);
      }
    } catch {
      // order_items table may not exist yet
    }

    // Revenue by category (from products data + order totals)
    revenueByCategory = {};
    categories.forEach((cat) => { revenueByCategory[cat.name] = 0; });
    allOrders.forEach((o) => {
      // Distribute revenue evenly across categories (approximate)
      const amount = Number(o.total || 0);
      const cats = Object.keys(revenueByCategory);
      if (cats.length > 0) {
        const perCat = amount / cats.length;
        cats.forEach((cat) => { revenueByCategory[cat] += perCat; });
      }
    });
    // Round values
    Object.keys(revenueByCategory).forEach((cat) => {
      revenueByCategory[cat] = Math.round(revenueByCategory[cat]);
    });

    // ─── Dead Stock & Low Stock ───
    const lowStockProducts = products
      .filter((p) => p.stock <= 10)
      .sort((a, b) => a.stock - b.stock)
      .slice(0, 10)
      .map((p) => ({ name: p.name, slug: p.slug, stock: p.stock, price: p.price, category: p.category }));

    // ─── Alerts ───
    const alerts: { type: "danger" | "warning" | "success"; message: string }[] = [];

    if (ordersAwaiting > 0) {
      alerts.push({ type: "warning", message: `${ordersAwaiting} order${ordersAwaiting > 1 ? "s" : ""} awaiting CJ processing` });
    }
    // The COD-collections alert that stood here is gone with the model. What an
    // operator of a made-to-order workshop actually needs warning about is a
    // piece that has been waiting too long to be cut.
    const productionQueue = buildProductionQueue(allOrders, items);
    const stale = productionQueue.filter((q) => q.ageDays >= 3);
    if (stale.length > 0) {
      alerts.push({
        type: "danger",
        message: `${stale.length} order${stale.length > 1 ? "s" : ""} waiting 3+ days to be cut`,
      });
    }
    if (lowStockProducts.length > 0 && lowStockProducts[0].stock <= 3) {
      alerts.push({ type: "warning", message: `${lowStockProducts.filter((p) => p.stock <= 3).length} products critically low stock` });
    }
    if (ordersToday > 0) {
      alerts.push({ type: "success", message: `${ordersToday} new order${ordersToday > 1 ? "s" : ""} today` });
    }

    return NextResponse.json({
      financial: {
        revenueToday,
        revenueWeek,
        revenueMonth,
        revenueTotal: totalRevenue,
        avgOrderValue,
        ordersToday,
        ordersWeek,
        ordersMonth,
        ordersTotal: allOrders.length,
      },
      pipeline: statusCounts,
      // What to cut today, in what order (A-15). Built from the orders and
      // items already fetched above, so it costs no extra query.
      queue: productionQueue,
      fulfillment: {
        avgDays: avgFulfillmentDays,
        awaiting: ordersAwaiting,
        inTransit: ordersInTransit,
        deliverySuccessRate,
        // The COUNT, not just the rate. 0% is arithmetically true when nothing
        // has been delivered yet, and reads as "every delivery failed" — which
        // on a made-to-order shop with a 2-3 day lead time is exactly backwards.
        deliveredCount: deliveredOrders.length,
        pickupOrders,
        deliveryOrders,
      },
      customers: {
        total: totalCustomers,
        repeatCount: repeatCustomers,
        repeatRate,
        topCustomers,
        byEmirate: emirateCounts,
      },
      products: {
        bestSellers,
        revenueByCategory,
        lowStock: lowStockProducts,
      },
      charts: {
        ordersPerDay: ordersChart,
        revenuePerDay: revenueChart,
      },
      alerts,
    });
  } catch (err) {
    console.error("Metrics API error:", err);
    return NextResponse.json({ error: "Failed to compute metrics" }, { status: 500 });
  }
}
