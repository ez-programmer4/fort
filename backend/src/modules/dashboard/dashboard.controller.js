const prisma = require('../../utils/prisma');
const { buildAlerts } = require('../alerts/alerts.controller');

const round2 = (v) => Math.round(v * 100) / 100;

async function overview(req, res, next) {
  try {
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

    const whereLoc = locationId ? { locationId } : {};

    const [stocks, productCount, salesToday, sales7d, topMoverGroups, recentSales, alerts] =
      await Promise.all([
        prisma.stock.findMany({
          where: { quantity: { gt: 0 }, ...whereLoc },
          include: {
            batch: { select: { unitCost: true, product: { select: { unitPrice: true } } } },
          },
        }),
        prisma.product.count({ where: { isActive: true } }),
        prisma.dispenseOrder.aggregate({
          where: { createdAt: { gte: startOfDay }, ...whereLoc },
          _sum: { total: true },
          _count: true,
        }),
        prisma.dispenseOrder.aggregate({
          where: { createdAt: { gte: sevenDaysAgo }, ...whereLoc },
          _sum: { total: true },
          _count: true,
        }),
        prisma.dispenseItem.groupBy({
          by: ['productId'],
          where: {
            dispenseOrder: { createdAt: { gte: thirtyDaysAgo }, ...whereLoc },
          },
          _sum: { quantity: true },
          orderBy: { _sum: { quantity: 'desc' } },
          take: 5,
        }),
        prisma.dispenseOrder.findMany({
          where: whereLoc,
          include: { location: { select: { name: true } } },
          orderBy: { id: 'desc' },
          take: 5,
        }),
        buildAlerts(locationId),
      ]);

    const stockValue = stocks.reduce((s, st) => {
      const cost = st.batch.unitCost != null ? Number(st.batch.unitCost) : Number(st.batch.product.unitPrice);
      return s + st.quantity * cost;
    }, 0);
    const unitsInStock = stocks.reduce((s, st) => s + st.quantity, 0);

    const moverProducts = await prisma.product.findMany({
      where: { id: { in: topMoverGroups.map((g) => g.productId) } },
      select: { id: true, code: true, genericName: true, brandName: true, dispenseUnit: true },
    });
    const byId = new Map(moverProducts.map((p) => [p.id, p]));
    const topMovers = topMoverGroups.map((g) => ({
      product: byId.get(g.productId),
      quantity: g._sum.quantity || 0,
    }));

    const alertCounts = {};
    for (const a of alerts) alertCounts[a.type] = (alertCounts[a.type] || 0) + 1;

    res.json({
      stock: {
        products: productCount,
        unitsInStock,
        stockValue: round2(stockValue),
        batchLocations: stocks.length,
      },
      sales: {
        todayTotal: Number(salesToday._sum.total || 0),
        todayCount: salesToday._count,
        last7dTotal: Number(sales7d._sum.total || 0),
        last7dCount: sales7d._count,
      },
      alertCounts,
      topMovers,
      recentSales: recentSales.map((o) => ({
        id: o.id,
        dspNumber: o.dspNumber,
        total: Number(o.total),
        paymentType: o.paymentType,
        location: o.location.name,
        createdAt: o.createdAt,
      })),
    });
  } catch (err) {
    next(err);
  }
}

// ── Phase A4: period-scoped analytics (profit overview, top customers, charts) ──

const PERIOD_DAYS = { '7d': 7, '30d': 30, '90d': 90 };

function periodRange(period) {
  const now = new Date();
  const end = now;
  let start;
  if (period === '12m') {
    start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
  } else {
    const days = PERIOD_DAYS[period] || 30;
    start = new Date(now.getTime() - days * 86400000);
  }
  const spanMs = end.getTime() - start.getTime();
  const prevEnd = new Date(start.getTime());
  const prevStart = new Date(prevEnd.getTime() - spanMs);
  return { start, end, prevStart, prevEnd };
}

function granularityFor(period) {
  if (period === '90d') return 'week';
  if (period === '12m') return 'month';
  return 'day';
}

function bucketKey(date, granularity) {
  const d = new Date(date);
  if (granularity === 'day') return d.toISOString().slice(0, 10);
  if (granularity === 'week') {
    const dow = (d.getDay() + 6) % 7; // Monday = 0
    const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - dow);
    return monday.toISOString().slice(0, 10);
  }
  return d.toISOString().slice(0, 7); // YYYY-MM
}

function bucketLabels(start, end, granularity) {
  const labels = [];
  if (granularity === 'day') {
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate());
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cur <= last) {
      labels.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
  } else if (granularity === 'week') {
    const dow = (start.getDay() + 6) % 7;
    const cur = new Date(start.getFullYear(), start.getMonth(), start.getDate() - dow);
    const last = new Date(end.getFullYear(), end.getMonth(), end.getDate());
    while (cur <= last) {
      labels.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 7);
    }
  } else {
    const cur = new Date(start.getFullYear(), start.getMonth(), 1);
    const last = new Date(end.getFullYear(), end.getMonth(), 1);
    while (cur <= last) {
      labels.push(cur.toISOString().slice(0, 7));
      cur.setMonth(cur.getMonth() + 1);
    }
  }
  return labels;
}

function pctChange(cur, prev) {
  if (!prev) return cur ? 100 : 0;
  return round2(((cur - prev) / Math.abs(prev)) * 100);
}

async function computeProfitTotals(start, end, locationId) {
  const whereOrders = { createdAt: { gte: start, lte: end }, ...(locationId ? { locationId } : {}) };
  const [orderAgg, items, expenses] = await Promise.all([
    prisma.dispenseOrder.aggregate({ where: whereOrders, _sum: { subtotal: true } }),
    prisma.dispenseItem.findMany({
      where: { dispenseOrder: whereOrders },
      select: { quantity: true, batch: { select: { unitCost: true } }, product: { select: { unitPrice: true } } },
    }),
    prisma.expensePurchase.aggregate({ where: { purchasedAt: { gte: start, lte: end } }, _sum: { netPayable: true } }),
  ]);

  const cogs = items.reduce((s, it) => {
    const cost = it.batch.unitCost != null ? Number(it.batch.unitCost) : Number(it.product.unitPrice);
    return s + it.quantity * cost;
  }, 0);

  const totalSales = Number(orderAgg._sum.subtotal || 0);
  const gross = totalSales - cogs;
  const expenseTotal = Number(expenses._sum.netPayable || 0);
  const net = gross - expenseTotal;

  return {
    totalSales: round2(totalSales),
    cogs: round2(cogs),
    gross: round2(gross),
    expenses: round2(expenseTotal),
    net: round2(net),
  };
}

async function topCustomers(start, end, locationId, limit = 8) {
  const rows = await prisma.dispenseOrder.groupBy({
    by: ['customerId'],
    where: { createdAt: { gte: start, lte: end }, customerId: { not: null }, ...(locationId ? { locationId } : {}) },
    _sum: { total: true },
    _count: true,
    _max: { createdAt: true },
    orderBy: { _sum: { total: 'desc' } },
    take: limit,
  });
  if (rows.length === 0) return [];

  const customers = await prisma.customer.findMany({
    where: { id: { in: rows.map((r) => r.customerId) } },
    select: { id: true, name: true, phone: true },
  });
  const byId = new Map(customers.map((c) => [c.id, c]));

  return rows.map((r) => ({
    customer: byId.get(r.customerId) || null,
    orderCount: r._count,
    totalSpent: round2(Number(r._sum.total || 0)),
    lastOrderAt: r._max.createdAt,
  }));
}

async function salesVsPurchasesSeries(start, end, granularity, locationId) {
  const [sales, purchases] = await Promise.all([
    prisma.dispenseOrder.findMany({
      where: { createdAt: { gte: start, lte: end }, ...(locationId ? { locationId } : {}) },
      select: { createdAt: true, total: true },
    }),
    prisma.goodsReceipt.findMany({
      where: { createdAt: { gte: start, lte: end }, ...(locationId ? { locationId } : {}) },
      select: { createdAt: true, netPayable: true },
    }),
  ]);

  const buckets = new Map(bucketLabels(start, end, granularity).map((l) => [l, { label: l, sales: 0, purchases: 0 }]));
  for (const s of sales) {
    const b = buckets.get(bucketKey(s.createdAt, granularity));
    if (b) b.sales += Number(s.total);
  }
  for (const p of purchases) {
    const b = buckets.get(bucketKey(p.createdAt, granularity));
    if (b) b.purchases += Number(p.netPayable);
  }
  return [...buckets.values()].map((b) => ({ label: b.label, sales: round2(b.sales), purchases: round2(b.purchases) }));
}

async function profitSeries(start, end, granularity, locationId) {
  const whereOrders = { createdAt: { gte: start, lte: end }, ...(locationId ? { locationId } : {}) };
  const [orders, items, expenses] = await Promise.all([
    prisma.dispenseOrder.findMany({ where: whereOrders, select: { id: true, createdAt: true, subtotal: true } }),
    prisma.dispenseItem.findMany({
      where: { dispenseOrder: whereOrders },
      select: {
        dispenseOrderId: true,
        quantity: true,
        batch: { select: { unitCost: true } },
        product: { select: { unitPrice: true } },
      },
    }),
    prisma.expensePurchase.findMany({
      where: { purchasedAt: { gte: start, lte: end } },
      select: { purchasedAt: true, netPayable: true },
    }),
  ]);

  const orderDate = new Map(orders.map((o) => [o.id, o.createdAt]));
  const buckets = new Map(bucketLabels(start, end, granularity).map((l) => [l, { label: l, sales: 0, cogs: 0, expenses: 0 }]));

  for (const o of orders) {
    const b = buckets.get(bucketKey(o.createdAt, granularity));
    if (b) b.sales += Number(o.subtotal);
  }
  for (const it of items) {
    const d = orderDate.get(it.dispenseOrderId);
    if (!d) continue;
    const b = buckets.get(bucketKey(d, granularity));
    if (!b) continue;
    const cost = it.batch.unitCost != null ? Number(it.batch.unitCost) : Number(it.product.unitPrice);
    b.cogs += it.quantity * cost;
  }
  for (const e of expenses) {
    const b = buckets.get(bucketKey(e.purchasedAt, granularity));
    if (b) b.expenses += Number(e.netPayable);
  }

  return [...buckets.values()].map((b) => {
    const gross = b.sales - b.cogs;
    return { label: b.label, gross: round2(gross), net: round2(gross - b.expenses) };
  });
}

async function productStats(start, end, locationId, limit = 5) {
  const items = await prisma.dispenseItem.findMany({
    where: { dispenseOrder: { createdAt: { gte: start, lte: end }, ...(locationId ? { locationId } : {}) } },
    select: {
      productId: true,
      quantity: true,
      unitPrice: true,
      batch: { select: { unitCost: true } },
      product: { select: { code: true, genericName: true, brandName: true, dispenseUnit: true, unitPrice: true } },
    },
  });

  const byProduct = new Map();
  for (const it of items) {
    const cost = it.batch.unitCost != null ? Number(it.batch.unitCost) : Number(it.product.unitPrice);
    const revenue = it.quantity * Number(it.unitPrice);
    const margin = revenue - it.quantity * cost;
    const cur = byProduct.get(it.productId) || { product: it.product, quantity: 0, revenue: 0, margin: 0 };
    cur.quantity += it.quantity;
    cur.revenue += revenue;
    cur.margin += margin;
    byProduct.set(it.productId, cur);
  }

  const all = [...byProduct.values()].map((x) => ({ ...x, revenue: round2(x.revenue), margin: round2(x.margin) }));
  return {
    byMargin: [...all].sort((a, b) => b.margin - a.margin).slice(0, limit),
    byVolume: [...all].sort((a, b) => b.quantity - a.quantity).slice(0, limit),
  };
}

async function analytics(req, res, next) {
  try {
    const period = ['7d', '30d', '90d', '12m'].includes(req.query.period) ? req.query.period : '30d';
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    const { start, end, prevStart, prevEnd } = periodRange(period);
    const granularity = granularityFor(period);

    const now = new Date();
    const twelveMoStart = new Date(now.getFullYear(), now.getMonth() - 11, 1);

    const [currentProfit, previousProfit, customers, salesVsPurchases, profitTrend, products, monthlyOverview] =
      await Promise.all([
        computeProfitTotals(start, end, locationId),
        computeProfitTotals(prevStart, prevEnd, locationId),
        topCustomers(start, end, locationId),
        salesVsPurchasesSeries(start, end, granularity, locationId),
        profitSeries(start, end, granularity, locationId),
        productStats(start, end, locationId),
        salesVsPurchasesSeries(twelveMoStart, now, 'month', locationId),
      ]);

    res.json({
      period,
      range: { from: start, to: end },
      profit: {
        current: currentProfit,
        previous: previousProfit,
        trend: {
          gross: pctChange(currentProfit.gross, previousProfit.gross),
          net: pctChange(currentProfit.net, previousProfit.net),
        },
      },
      topCustomers: customers,
      charts: {
        salesVsPurchases,
        profitTrend,
        topProductsByMargin: products.byMargin,
        topProductsByVolume: products.byVolume,
        monthlyOverview,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { overview, analytics };
