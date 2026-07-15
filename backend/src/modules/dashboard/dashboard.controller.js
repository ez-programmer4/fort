const prisma = require('../../utils/prisma');
const { buildAlerts } = require('../alerts/alerts.controller');

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
        stockValue: Math.round(stockValue * 100) / 100,
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

module.exports = { overview };
