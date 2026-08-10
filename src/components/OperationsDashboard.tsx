"use client";

import { useState, useEffect, useCallback } from "react";
import type { QueueEntry } from "@/lib/production-queue";

interface MetricsData {
  financial: {
    revenueToday: number; revenueWeek: number; revenueMonth: number; revenueTotal: number;
    depositsCollected: number; codPending: number; codCollected: number; avgOrderValue: number;
    ordersToday: number; ordersWeek: number; ordersMonth: number; ordersTotal: number;
  };
  pipeline: Record<string, { count: number; total: number }>;
  queue: QueueEntry[];
  fulfillment: {
    avgDays: number; awaiting: number; inTransit: number; deliverySuccessRate: number;
    pickupOrders: number; deliveryOrders: number;
  };
  cod: {
    collectionRate: number; outstandingAmount: number; outstandingCount: number;
    outstanding: { id: string; customer: string; amount: number; days: number }[];
  };
  customers: {
    total: number; repeatCount: number; repeatRate: number;
    topCustomers: { name: string; phone: string; orders: number; total: number; lastOrder: string }[];
    byEmirate: Record<string, number>;
  };
  products: {
    bestSellers: { name: string; quantity: number; revenue: number }[];
    revenueByCategory: Record<string, number>;
    lowStock: { name: string; slug: string; stock: number; price: number; category: string }[];
  };
  charts: {
    ordersPerDay: { date: string; count: number }[];
    revenuePerDay: { date: string; amount: number }[];
  };
  alerts: { type: "danger" | "warning" | "success"; message: string }[];
}

const PIPELINE_STAGES = [
  { key: "deposit_paid", label: "Deposit Paid", icon: "💳", color: "bg-yellow-400" },
  { key: "processing", label: "Processing", icon: "📦", color: "bg-blue-400" },
  { key: "shipped", label: "Shipped", icon: "🚚", color: "bg-indigo-400" },
  { key: "out_for_delivery", label: "Out for Delivery", icon: "🛵", color: "bg-purple-400" },
  { key: "delivered", label: "Delivered", icon: "✅", color: "bg-green-400" },
  { key: "completed", label: "Completed", icon: "🎉", color: "bg-emerald-400" },
];

function fmt(n: number): string {
  return `AED ${n.toLocaleString("en")}`;
}

/**
 * What to cut today, in the order to cut it.
 *
 * Answers the workshop's daily question without opening the database (A-15).
 * Deliberately dense: this is a working list read at a bench, not a chart.
 */
function CuttingQueue({ queue }: { queue: QueueEntry[] }) {
  const pieces = queue.reduce((n, e) => n + e.pieces, 0);
  const engraved = queue.filter((e) => e.engraved).length;

  return (
    <div className="bg-bone rounded-xl border border-rule p-5">
      <div className="flex items-baseline justify-between mb-4 gap-3 flex-wrap">
        <h3 className="text-sm font-semibold text-ink">
          Cutting Queue
          <span className="ml-2 font-normal text-ink-soft">
            {queue.length === 0
              ? "nothing waiting"
              : `${queue.length} order${queue.length === 1 ? "" : "s"} · ${pieces} piece${pieces === 1 ? "" : "s"}${engraved ? ` · ${engraved} to engrave` : ""}`}
          </span>
        </h3>
        <span className="text-[10px] uppercase tracking-wider text-ink-soft">oldest first</span>
      </div>

      {queue.length === 0 ? (
        <p className="text-sm text-ink-soft py-6 text-center">
          Nothing waiting to be cut. Every paid order has shipped.
        </p>
      ) : (
        <ol className="space-y-2">
          {queue.map((e, i) => (
            <li
              key={e.id}
              className={`flex flex-wrap items-start gap-3 rounded-lg border p-3 ${
                e.status === "processing"
                  ? "border-blue-200 bg-blue-50/40"
                  : "border-rule bg-paper/60"
              }`}
            >
              <span className="w-6 shrink-0 text-center text-sm font-bold text-ink-soft">{i + 1}</span>

              <div className="min-w-[9rem] flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-ink-soft">#{e.shortId}</span>
                  <span className="text-sm font-medium text-ink">{e.customer}</span>
                </div>
                <div className="mt-0.5 flex items-center gap-2 flex-wrap text-[11px] text-ink-soft">
                  <span
                    className={`rounded px-1.5 py-0.5 font-medium ${
                      e.status === "processing" ? "bg-blue-100 text-blue-700" : "bg-yellow-100 text-yellow-800"
                    }`}
                  >
                    {e.status === "processing" ? "in progress" : "not started"}
                  </span>
                  {/* Waiting time is the thing that turns into a complaint, so
                      it is called out once it stops being reasonable. */}
                  <span className={e.ageDays >= 3 ? "font-semibold text-red-700" : ""}>
                    {e.ageDays === 0 ? "today" : `${e.ageDays} day${e.ageDays === 1 ? "" : "s"} waiting`}
                  </span>
                  <span>{e.deliveryMethod === "pickup" ? "🏠 pickup" : `🚚 ${e.emirate || "delivery"}`}</span>
                </div>
              </div>

              <div className="flex-[2] min-w-[12rem] space-y-1">
                {e.items.length === 0 ? (
                  // A paid order with no recorded lines is not "nothing to do",
                  // it is a problem that needs a human before it ships.
                  <span className="text-[11px] font-medium text-red-700">
                    ⚠ no items recorded — check this order before cutting
                  </span>
                ) : (
                  e.items.map((it, n) => (
                    <div key={n} className="flex items-baseline gap-2 text-sm">
                      <span className="text-ink-soft tabular-nums">{it.quantity}×</span>
                      <span className="text-ink">{it.name}</span>
                      {it.engraving && (
                        // The one field that gets cut irreversibly. Loud on
                        // purpose — a missed engraving means recutting the piece.
                        <span className="rounded bg-ink px-1.5 py-0.5 font-mono text-[11px] font-medium text-sand">
                          ✎ {it.engraving}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function KpiCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-bone rounded-xl border border-rule p-4 lg:p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-ink-soft uppercase tracking-wider">{label}</p>
          <p className={`text-xl lg:text-2xl font-bold mt-1 ${color || "text-ink"}`}>{value}</p>
          {sub && <p className="text-xs text-ink-soft mt-1">{sub}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

function MiniBarChart({ data, label, color = "bg-ink" }: { data: { label: string; value: number }[]; label: string; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="bg-bone rounded-xl border border-rule p-5">
      <h3 className="text-sm font-semibold text-ink mb-4">{label}</h3>
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-[11px] text-ink-soft w-20 text-right truncate">{d.label}</span>
            <div className="flex-1 bg-paper-deep rounded-full h-4 overflow-hidden">
              <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${(d.value / max) * 100}%` }} />
            </div>
            <span className="text-[11px] font-medium text-ink-soft w-16 text-right">{typeof d.value === "number" && d.value > 100 ? fmt(d.value) : d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OperationsDashboard() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  /*
   * Refetchable, because the failure state was a dead end (OP-01).
   *
   * This ran once on mount and, on failure, only stopped the spinner: `data`
   * stayed null, the screen read "Failed to load metrics", and there was no way
   * back — `[]` deps mean it never retries, so the operator's only recovery was
   * to reload the whole admin and log in again. A transient blip in /api/metrics
   * therefore looked identical to a broken dashboard.
   */
  const loadMetrics = useCallback(() => {
    setLoading(true);
    setFailed(false);
    fetch("/api/metrics")
      .then((r) => {
        // A non-OK response is a failure, not JSON to parse. `r.json()` on a 500
        // yields either a parse error or an object with none of the expected
        // keys, and the latter would render a dashboard full of blanks rather
        // than saying it failed.
        if (!r.ok) throw new Error(`metrics responded ${r.status}`);
        return r.json();
      })
      .then((d) => { setData(d); setLoading(false); })
      .catch((err) => {
        // console.error, which reaches GlitchTip now that console capture is
        // configured (B-29) — an operator staring at a failed dashboard should
        // not be the only record that it failed.
        console.error("[ops-dashboard] could not load metrics:", err);
        setFailed(true);
        setLoading(false);
      });
  }, []);

  // The setState the rule objects to is `setLoading(true)` inside loadMetrics,
  // and there is no render-time equivalent: the fetch must not start until the
  // component is mounted, and the same function has to be callable from the
  // retry button. Same trade-off, and same disable, as admin/page.tsx.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-rule border-t-sand-dark rounded-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-20">
        <p className="text-ink-soft">
          {failed ? "Could not load the operations metrics." : "No metrics available yet."}
        </p>
        <button
          onClick={loadMetrics}
          className="mt-4 px-4 py-2 text-sm border border-rule rounded-lg hover:bg-paper transition-colors"
        >
          Try again
        </button>
      </div>
    );
  }

  const { financial: fin, pipeline, queue, fulfillment: fulf, cod, customers: cust, products: prod, charts, alerts } = data;

  // Pipeline data for visual
  const pipelineMax = Math.max(...PIPELINE_STAGES.map((s) => pipeline[s.key]?.count || 0), 1);

  // Chart data (last 14 days for readability)
  const ordersChart = charts.ordersPerDay.slice(0, 14).reverse();
  const revenueChart = charts.revenuePerDay.slice(0, 14).reverse();
  const chartMax = Math.max(...revenueChart.map((d) => d.amount), 1);

  // Revenue by category
  const catData = Object.entries(prod.revenueByCategory)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, value]) => ({ label, value }));

  return (
    <div className="space-y-6">
      {/* ─── Alerts ─── */}
      {alerts.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {alerts.map((a, i) => (
            <div key={i} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium ${a.type === "danger" ? "bg-red-50 text-red-700 border border-red-200" : a.type === "warning" ? "bg-yellow-50 text-yellow-700 border border-yellow-200" : "bg-green-50 text-green-700 border border-green-200"}`}>
              {a.type === "danger" ? "🔴" : a.type === "warning" ? "🟡" : "🟢"}
              {a.message}
            </div>
          ))}
        </div>
      )}

      {/* ─── Cutting Queue ───
          First, and above the money, because it is the only part of this page
          that tells the workshop what to physically do today. Ordered by
          buildProductionQueue: started work first, then strict FIFO. */}
      <CuttingQueue queue={queue} />

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <KpiCard icon="💰" label="Revenue (Month)" value={fmt(fin.revenueMonth)} sub={`${fin.ordersMonth} orders`} />
        <KpiCard icon="💳" label="Deposits Collected" value={fmt(fin.depositsCollected)} color="text-sand-dark" />
        <KpiCard icon="🟡" label="COD Pending" value={fmt(fin.codPending)} sub={`${cod.outstandingCount} orders`} color="text-sand" />
        <KpiCard icon="✅" label="COD Collected" value={fmt(fin.codCollected)} sub={`${cod.collectionRate}% rate`} color="text-sand-dark" />
        <KpiCard icon="📊" label="Avg Order Value" value={fmt(fin.avgOrderValue)} sub={`${fin.ordersTotal} total`} />
        <KpiCard icon="📈" label="Today" value={String(fin.ordersToday)} sub={fmt(fin.revenueToday)} />
      </div>

      {/* ─── Pipeline ─── */}
      <div className="bg-bone rounded-xl border border-rule p-5">
        <h3 className="text-sm font-semibold text-ink mb-4">Order Pipeline</h3>
        <div className="flex items-end gap-2 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((stage) => {
            const count = pipeline[stage.key]?.count || 0;
            const total = pipeline[stage.key]?.total || 0;
            const height = Math.max((count / pipelineMax) * 120, 20);
            return (
              <div key={stage.key} className="flex-1 min-w-[80px] flex flex-col items-center gap-1">
                <span className="text-lg">{stage.icon}</span>
                <div className={`w-full ${stage.color} rounded-t-lg transition-all`} style={{ height: `${height}px` }} />
                <span className="text-xs font-bold text-ink">{count}</span>
                <span className="text-[10px] text-ink-soft text-center leading-tight">{stage.label}</span>
                {total > 0 && <span className="text-[10px] text-ink-soft">{fmt(total)}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Charts Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Chart */}
        <div className="bg-bone rounded-xl border border-rule p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Revenue (Last 14 Days)</h3>
          <div className="flex items-end gap-1 h-32">
            {revenueChart.map((d, i) => {
              const h = Math.max((d.amount / chartMax) * 100, 2);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${fmt(d.amount)}`}>
                  <div className="w-full bg-ink rounded-t transition-all" style={{ height: `${h}%` }} />
                  <span className="text-[8px] text-ink-soft -rotate-45 origin-left">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Orders Chart */}
        <div className="bg-bone rounded-xl border border-rule p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">Orders (Last 14 Days)</h3>
          <div className="flex items-end gap-1 h-32">
            {ordersChart.map((d, i) => {
              const maxCount = Math.max(...ordersChart.map((o) => o.count), 1);
              const h = Math.max((d.count / maxCount) * 100, 2);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.count} orders`}>
                  <div className="w-full bg-sand rounded-t transition-all" style={{ height: `${h}%` }} />
                  <span className="text-[8px] text-ink-soft -rotate-45 origin-left">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Action Items Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Needs Action */}
        <div className="bg-bone rounded-xl border border-rule p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">⚡ Needs Action</h3>
          <div className="space-y-2">
            {fulf.awaiting > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-yellow-50 rounded-lg">
                <span className="text-xs text-yellow-800">Awaiting CJ Processing</span>
                <span className="text-sm font-bold text-yellow-800">{fulf.awaiting}</span>
              </div>
            )}
            {fulf.inTransit > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-blue-50 rounded-lg">
                <span className="text-xs text-blue-800">In Transit</span>
                <span className="text-sm font-bold text-blue-800">{fulf.inTransit}</span>
              </div>
            )}
            {prod.lowStock.filter((p) => p.stock <= 3).length > 0 && (
              <div className="flex items-center justify-between px-3 py-2 bg-red-50 rounded-lg">
                <span className="text-xs text-red-800">Critical Low Stock</span>
                <span className="text-sm font-bold text-red-800">{prod.lowStock.filter((p) => p.stock <= 3).length}</span>
              </div>
            )}
            {fulf.awaiting === 0 && fulf.inTransit === 0 && (
              <p className="text-xs text-ink-soft py-4 text-center">All caught up! 🎉</p>
            )}
          </div>
        </div>

        {/* Fulfillment Stats */}
        <div className="bg-bone rounded-xl border border-rule p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">📦 Fulfillment</h3>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-xs text-ink-soft">Avg Delivery Time</span><span className="text-sm font-bold">{fulf.avgDays} days</span></div>
            <div className="flex justify-between"><span className="text-xs text-ink-soft">Success Rate</span><span className="text-sm font-bold text-ink">{fulf.deliverySuccessRate}%</span></div>
            <div className="flex justify-between"><span className="text-xs text-ink-soft">Pickup Orders</span><span className="text-sm font-bold">{fulf.pickupOrders}</span></div>
            <div className="flex justify-between"><span className="text-xs text-ink-soft">Delivery Orders</span><span className="text-sm font-bold">{fulf.deliveryOrders}</span></div>
          </div>
        </div>

        {/* COD Outstanding */}
        <div className="bg-bone rounded-xl border border-rule p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">💵 COD Outstanding</h3>
          {cod.outstanding.length > 0 ? (
            <div className="space-y-2">
              {cod.outstanding.map((o, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-paper rounded-lg">
                  <div>
                    <span className="text-xs font-medium text-ink-soft">#{o.id}</span>
                    <span className="text-[10px] text-ink-soft ml-2">{o.customer}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-sand">{fmt(o.amount)}</span>
                    <span className="text-[10px] text-ink-soft ml-1">{o.days}d ago</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-soft py-4 text-center">No outstanding COD</p>
          )}
        </div>
      </div>

      {/* ─── Bottom Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Customers */}
        <div className="bg-bone rounded-xl border border-rule p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">🏆 Top Customers</h3>
          {cust.topCustomers.length > 0 ? (
            <div className="space-y-2">
              {cust.topCustomers.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-paper rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-rule rounded-full flex items-center justify-center text-[10px] font-bold text-ink-soft">{i + 1}</span>
                    <div>
                      <p className="text-xs font-medium text-ink">{c.name}</p>
                      <p className="text-[10px] text-ink-soft">{c.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-ink">{fmt(c.total)}</p>
                    <p className="text-[10px] text-ink-soft">{c.orders} order{c.orders > 1 ? "s" : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-ink-soft py-4 text-center">No customers yet</p>
          )}
        </div>

        {/* Best Sellers or Revenue by Category */}
        {prod.bestSellers.length > 0 ? (
          <div className="bg-bone rounded-xl border border-rule p-5">
            <h3 className="text-sm font-semibold text-ink mb-3">🔥 Best Sellers</h3>
            <div className="space-y-2">
              {prod.bestSellers.slice(0, 5).map((p, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-paper rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-ink/10 rounded-full flex items-center justify-center text-[10px] font-bold text-ink">{i + 1}</span>
                    <span className="text-xs text-ink line-clamp-1">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-ink">{p.quantity} sold</span>
                    <span className="text-[10px] text-ink-soft ml-2">{fmt(p.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <MiniBarChart data={catData} label="Revenue by Category" />
        )}
      </div>

      {/* ─── Low Stock ─── */}
      {prod.lowStock.length > 0 && (
        <div className="bg-bone rounded-xl border border-rule p-5">
          <h3 className="text-sm font-semibold text-ink mb-3">⚠️ Low Stock Alerts</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {prod.lowStock.map((p, i) => (
              <div key={i} className="px-3 py-2 bg-paper rounded-lg">
                <p className="text-[11px] text-ink line-clamp-1">{p.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-xs font-bold ${p.stock === 0 ? "text-red-700" : p.stock <= 3 ? "text-orange-500" : "text-yellow-600"}`}>
                    {p.stock} left
                  </span>
                  <span className="text-[10px] text-ink-soft">{fmt(p.price)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ─── Customer Stats ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard icon="👥" label="Total Customers" value={String(cust.total)} />
        <KpiCard icon="🔄" label="Repeat Customers" value={String(cust.repeatCount)} sub={`${cust.repeatRate}% rate`} />
        <KpiCard icon="📊" label="Repeat Rate" value={`${cust.repeatRate}%`} />
        <KpiCard icon="🚚" label="Delivery Success" value={`${fulf.deliverySuccessRate}%`} />
      </div>
    </div>
  );
}
