"use client";

import { useState, useEffect } from "react";

interface MetricsData {
  financial: {
    revenueToday: number; revenueWeek: number; revenueMonth: number; revenueTotal: number;
    depositsCollected: number; codPending: number; codCollected: number; avgOrderValue: number;
    ordersToday: number; ordersWeek: number; ordersMonth: number; ordersTotal: number;
  };
  pipeline: Record<string, { count: number; total: number }>;
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

function KpiCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub?: string; color?: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 lg:p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">{label}</p>
          <p className={`text-xl lg:text-2xl font-bold mt-1 ${color || "text-gray-900"}`}>{value}</p>
          {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
        </div>
        <span className="text-2xl">{icon}</span>
      </div>
    </div>
  );
}

function MiniBarChart({ data, label, color = "bg-[#16A34A]" }: { data: { label: string; value: number }[]; label: string; color?: string }) {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="text-sm font-semibold text-gray-800 mb-4">{label}</h3>
      <div className="space-y-2">
        {data.map((d, i) => (
          <div key={i} className="flex items-center gap-3">
            <span className="text-[11px] text-gray-500 w-20 text-right truncate">{d.label}</span>
            <div className="flex-1 bg-gray-100 rounded-full h-4 overflow-hidden">
              <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${(d.value / max) * 100}%` }} />
            </div>
            <span className="text-[11px] font-medium text-gray-700 w-16 text-right">{typeof d.value === "number" && d.value > 100 ? fmt(d.value) : d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OperationsDashboard() {
  const [data, setData] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/metrics")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="animate-spin w-8 h-8 border-2 border-gray-300 border-t-[#16A34A] rounded-full" />
      </div>
    );
  }

  if (!data) {
    return <div className="text-center py-20 text-gray-400">Failed to load metrics</div>;
  }

  const { financial: fin, pipeline, fulfillment: fulf, cod, customers: cust, products: prod, charts, alerts } = data;

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

      {/* ─── KPI Cards ─── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-3">
        <KpiCard icon="💰" label="Revenue (Month)" value={fmt(fin.revenueMonth)} sub={`${fin.ordersMonth} orders`} />
        <KpiCard icon="💳" label="Deposits Collected" value={fmt(fin.depositsCollected)} color="text-[#16A34A]" />
        <KpiCard icon="🟡" label="COD Pending" value={fmt(fin.codPending)} sub={`${cod.outstandingCount} orders`} color="text-[#C9A96E]" />
        <KpiCard icon="✅" label="COD Collected" value={fmt(fin.codCollected)} sub={`${cod.collectionRate}% rate`} color="text-[#16A34A]" />
        <KpiCard icon="📊" label="Avg Order Value" value={fmt(fin.avgOrderValue)} sub={`${fin.ordersTotal} total`} />
        <KpiCard icon="📈" label="Today" value={String(fin.ordersToday)} sub={fmt(fin.revenueToday)} />
      </div>

      {/* ─── Pipeline ─── */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="text-sm font-semibold text-gray-800 mb-4">Order Pipeline</h3>
        <div className="flex items-end gap-2 overflow-x-auto pb-2">
          {PIPELINE_STAGES.map((stage) => {
            const count = pipeline[stage.key]?.count || 0;
            const total = pipeline[stage.key]?.total || 0;
            const height = Math.max((count / pipelineMax) * 120, 20);
            return (
              <div key={stage.key} className="flex-1 min-w-[80px] flex flex-col items-center gap-1">
                <span className="text-lg">{stage.icon}</span>
                <div className={`w-full ${stage.color} rounded-t-lg transition-all`} style={{ height: `${height}px` }} />
                <span className="text-xs font-bold text-gray-900">{count}</span>
                <span className="text-[10px] text-gray-400 text-center leading-tight">{stage.label}</span>
                {total > 0 && <span className="text-[10px] text-gray-400">{fmt(total)}</span>}
              </div>
            );
          })}
        </div>
      </div>

      {/* ─── Charts Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Revenue (Last 14 Days)</h3>
          <div className="flex items-end gap-1 h-32">
            {revenueChart.map((d, i) => {
              const h = Math.max((d.amount / chartMax) * 100, 2);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${fmt(d.amount)}`}>
                  <div className="w-full bg-[#16A34A] rounded-t transition-all" style={{ height: `${h}%` }} />
                  <span className="text-[8px] text-gray-400 -rotate-45 origin-left">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Orders Chart */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Orders (Last 14 Days)</h3>
          <div className="flex items-end gap-1 h-32">
            {ordersChart.map((d, i) => {
              const maxCount = Math.max(...ordersChart.map((o) => o.count), 1);
              const h = Math.max((d.count / maxCount) * 100, 2);
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1" title={`${d.date}: ${d.count} orders`}>
                  <div className="w-full bg-[#C9A96E] rounded-t transition-all" style={{ height: `${h}%` }} />
                  <span className="text-[8px] text-gray-400 -rotate-45 origin-left">{d.date.slice(5)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Action Items Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Needs Action */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">⚡ Needs Action</h3>
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
              <p className="text-xs text-gray-400 py-4 text-center">All caught up! 🎉</p>
            )}
          </div>
        </div>

        {/* Fulfillment Stats */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">📦 Fulfillment</h3>
          <div className="space-y-3">
            <div className="flex justify-between"><span className="text-xs text-gray-500">Avg Delivery Time</span><span className="text-sm font-bold">{fulf.avgDays} days</span></div>
            <div className="flex justify-between"><span className="text-xs text-gray-500">Success Rate</span><span className="text-sm font-bold text-[#16A34A]">{fulf.deliverySuccessRate}%</span></div>
            <div className="flex justify-between"><span className="text-xs text-gray-500">Pickup Orders</span><span className="text-sm font-bold">{fulf.pickupOrders}</span></div>
            <div className="flex justify-between"><span className="text-xs text-gray-500">Delivery Orders</span><span className="text-sm font-bold">{fulf.deliveryOrders}</span></div>
          </div>
        </div>

        {/* COD Outstanding */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">💵 COD Outstanding</h3>
          {cod.outstanding.length > 0 ? (
            <div className="space-y-2">
              {cod.outstanding.map((o, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg">
                  <div>
                    <span className="text-xs font-medium text-gray-700">#{o.id}</span>
                    <span className="text-[10px] text-gray-400 ml-2">{o.customer}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-[#C9A96E]">{fmt(o.amount)}</span>
                    <span className="text-[10px] text-gray-400 ml-1">{o.days}d ago</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-4 text-center">No outstanding COD</p>
          )}
        </div>
      </div>

      {/* ─── Bottom Row ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Customers */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">🏆 Top Customers</h3>
          {cust.topCustomers.length > 0 ? (
            <div className="space-y-2">
              {cust.topCustomers.slice(0, 5).map((c, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-gray-200 rounded-full flex items-center justify-center text-[10px] font-bold text-gray-600">{i + 1}</span>
                    <div>
                      <p className="text-xs font-medium text-gray-800">{c.name}</p>
                      <p className="text-[10px] text-gray-400">{c.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-900">{fmt(c.total)}</p>
                    <p className="text-[10px] text-gray-400">{c.orders} order{c.orders > 1 ? "s" : ""}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-gray-400 py-4 text-center">No customers yet</p>
          )}
        </div>

        {/* Best Sellers or Revenue by Category */}
        {prod.bestSellers.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-800 mb-3">🔥 Best Sellers</h3>
            <div className="space-y-2">
              {prod.bestSellers.slice(0, 5).map((p, i) => (
                <div key={i} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 bg-[#16A34A]/10 rounded-full flex items-center justify-center text-[10px] font-bold text-[#16A34A]">{i + 1}</span>
                    <span className="text-xs text-gray-800 line-clamp-1">{p.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-900">{p.quantity} sold</span>
                    <span className="text-[10px] text-gray-400 ml-2">{fmt(p.revenue)}</span>
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
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-800 mb-3">⚠️ Low Stock Alerts</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
            {prod.lowStock.map((p, i) => (
              <div key={i} className="px-3 py-2 bg-gray-50 rounded-lg">
                <p className="text-[11px] text-gray-800 line-clamp-1">{p.name}</p>
                <div className="flex items-center justify-between mt-1">
                  <span className={`text-xs font-bold ${p.stock === 0 ? "text-red-600" : p.stock <= 3 ? "text-orange-500" : "text-yellow-600"}`}>
                    {p.stock} left
                  </span>
                  <span className="text-[10px] text-gray-400">{fmt(p.price)}</span>
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
