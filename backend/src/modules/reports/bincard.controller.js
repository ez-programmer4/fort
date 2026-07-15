const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');

// Bin Card: chronological In/Out/Balance ledger for one product at one location.
// Opening balance = net of all movements before the "from" date.
async function binCard(req, res, next) {
  try {
    const productId = Number(req.query.productId);
    const locationId = Number(req.query.locationId);
    if (!productId || !locationId) throw new ApiError(400, 'productId and locationId are required');

    const from = req.query.from ? new Date(`${req.query.from}T00:00:00`) : null;
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999`) : null;
    if ((from && isNaN(from)) || (to && isNaN(to))) throw new ApiError(400, 'Invalid date range');

    const [product, location] = await Promise.all([
      prisma.product.findUnique({
        where: { id: productId },
        select: { id: true, code: true, genericName: true, brandName: true, description: true, dispenseUnit: true },
      }),
      prisma.location.findUnique({ where: { id: locationId }, select: { id: true, name: true } }),
    ]);
    if (!product) throw new ApiError(404, 'Product not found');
    if (!location) throw new ApiError(404, 'Location not found');

    let opening = 0;
    if (from) {
      const before = await prisma.stockMovement.groupBy({
        by: ['direction'],
        where: { productId, locationId, createdAt: { lt: from } },
        _sum: { quantity: true },
      });
      for (const g of before) {
        opening += (g.direction === 'IN' ? 1 : -1) * (g._sum.quantity || 0);
      }
    }

    const movements = await prisma.stockMovement.findMany({
      where: {
        productId,
        locationId,
        ...(from || to ? { createdAt: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } } : {}),
      },
      include: {
        batch: { include: { supplier: { select: { name: true } } } },
        performedBy: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    let balance = opening;
    const rows = movements.map((m) => {
      const qtyIn = m.direction === 'IN' ? m.quantity : 0;
      const qtyOut = m.direction === 'OUT' ? m.quantity : 0;
      balance += qtyIn - qtyOut;
      return {
        date: m.createdAt,
        batchNo: m.batch?.batchNo || '—',
        expiryDate: m.batch?.expiryDate || null,
        supplier: m.batch?.supplier?.name || '—',
        movementType: m.type,
        in: qtyIn,
        out: qtyOut,
        balance,
        performedBy: m.performedBy.fullName,
        remark: m.remark || m.reason || '',
      };
    });

    res.json({ product, location, opening, closing: balance, rows });
  } catch (err) {
    next(err);
  }
}

module.exports = { binCard };
