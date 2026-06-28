import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { products, categories } from "@/lib/products";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  try {
    // Fetch all orders
    const { data: orders, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const allOrders = orders || [];

    // ─── Financial Metrics ───
    const totalRevenue = allOrders.reduce((s, o) => s + Number(o.total || 0), 0);
    const totalDeposits = allOrders.reduce((s, o) => s + Number(o.deposit_amount || 0), 0);
    const deliveredStatuses = ["delivered", "completed"];
    const pendingStatuses = ["deposit_paid", "processing", "shipped", "out_for_delivery"];

    const codPending = allOrders
      .filter((o) => pendingStatuses.includes(o.status))
      .reduce((s, o) => s + Number(o.cod_amount || 0), 0);

    const codCollected = allOrders
      .filter((o) => deliveredStatuses.includes(o.status))
      .reduce((s, o) => s + Number(o.cod_amount || 0), 0);

    const avgOrderValue = allOrders.length > 0 ? Math.round(totalRevenue / allOrders.length) : 0;

    const ordersToday = allOrders.filter((o) => new Date(o.created_at) >= today).length;
    const revenueToday = allOrders
      .filter((o) => new Date(o.created_at) >= today)
      .reduce((s, o) => s + Number(o.total || 0), 0);

    const ordersWeek = allOrders.filter((o) => new Date(o.created_at) >= weekAgo).length;
    const revenueWeek = allOrders
      .filter((o) => new Date(o.created_at) >= weekAgo)
      .reduce((s, o) => s + Number(o.total || 0), 0);

    const ordersMonth = allOrders.filter((o) => new Date(o.created_at) >= monthStart).length;
    const revenueMonth = allOrders
      .filter((o) => new Date(o.created_at) >= monthStart)
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
        const created = new Date(o.created_at).getTime();
        const updated = new Date(o.updated_at).getTime();
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

    // ─── COD Metrics ───
    const codTotal = allOrders.reduce((s, o) => s + Number(o.cod_amount || 0), 0);
    const codCollectionRate = codTotal > 0 ? Math.round((codCollected / codTotal) * 100) : 0;
    const codOutstanding = allOrders
      .filter((o) => o.status === "delivered")
      .map((o) => ({
        id: String(o.id).slice(0, 8),
        customer: o.customer_name,
        amount: Number(o.cod_amount || 0),
        days: Math.floor((now.getTime() - new Date(o.updated_at || o.created_at).getTime()) / (24 * 60 * 60 * 1000)),
      }))
      .filter((o) => o.amount > 0);

    // ─── Customer Metrics ───
    const customerMap = new Map<string, { name: string; phone: string; orders: number; total: number; lastOrder: string }>();
    allOrders.forEach((o) => {
      const key = o.customer_phone || o.customer_email || o.customer_name;
      const existing = customerMap.get(key);
      if (existing) {
        existing.orders++;
        existing.total += Number(o.total || 0);
        if (o.created_at > existing.lastOrder) existing.lastOrder = o.created_at;
      } else {
        customerMap.set(key, {
          name: o.customer_name || "Unknown",
          phone: o.customer_phone || "",
          orders: 1,
          total: Number(o.total || 0),
          lastOrder: o.created_at,
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
      .filter((o) => new Date(o.created_at) >= thirtyDaysAgo)
      .forEach((o) => {
        const key = new Date(o.created_at).toISOString().slice(0, 10);
        ordersPerDay[key] = (ordersPerDay[key] || 0) + 1;
        revenuePerDay[key] = (revenuePerDay[key] || 0) + Number(o.total || 0);
      });

    const ordersChart = Object.entries(ordersPerDay).reverse().map(([date, count]) => ({ date, count }));
    const revenueChart = Object.entries(revenuePerDay).reverse().map(([date, amount]) => ({ date, amount }));

    // ─── Product Metrics (from order_items if available) ───
    let bestSellers: { name: string; quantity: number; revenue: number }[] = [];
    let revenueByCategory: Record<string, number> = {};

    try {
      const { data: items } = await supabase
        .from("order_items")
        .select("product_name, product_slug, price, quantity");

      if (items && items.length > 0) {
        const productSales = new Map<string, { name: string; quantity: number; revenue: number }>();
        items.forEach((item) => {
          const existing = productSales.get(item.product_slug || item.product_name);
          if (existing) {
            existing.quantity += item.quantity || 1;
            existing.revenue += Number(item.price || 0) * (item.quantity || 1);
          } else {
            productSales.set(item.product_slug || item.product_name, {
              name: item.product_name,
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
    if (codOutstanding.length > 0) {
      const totalCOD = codOutstanding.reduce((s, o) => s + o.amount, 0);
      if (totalCOD > 500) {
        alerts.push({ type: "danger", message: `AED ${totalCOD} COD outstanding — collections needed` });
      }
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
        depositsCollected: totalDeposits,
        codPending,
        codCollected,
        avgOrderValue,
        ordersToday,
        ordersWeek,
        ordersMonth,
        ordersTotal: allOrders.length,
      },
      pipeline: statusCounts,
      fulfillment: {
        avgDays: avgFulfillmentDays,
        awaiting: ordersAwaiting,
        inTransit: ordersInTransit,
        deliverySuccessRate,
        pickupOrders,
        deliveryOrders,
      },
      cod: {
        collectionRate: codCollectionRate,
        outstandingAmount: codPending,
        outstandingCount: codOutstanding.length,
        outstanding: codOutstanding.slice(0, 5),
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
