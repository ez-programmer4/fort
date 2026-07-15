const prisma = require('./prisma');
const { ApiError } = require('../middleware/error');

/**
 * Apply a stock movement atomically: upsert the Stock row (batch × location)
 * and record the StockMovement. Every module that moves stock (adjustments,
 * GRV, dispensing, transfers) must go through this so the bin card, alerts
 * and audit trail stay consistent.
 *
 * @param {object} tx  Prisma transaction client
 * @param {object} m   { productId, batchId, locationId, type, direction, quantity, reason?, remark?, performedById }
 */
async function applyMovement(tx, m) {
  const { productId, batchId, locationId, type, direction, quantity, reason, remark, performedById } = m;

  if (!Number.isInteger(quantity) || quantity <= 0) {
    throw new ApiError(400, 'Quantity must be a positive whole number');
  }
  if (!['IN', 'OUT'].includes(direction)) throw new ApiError(400, 'Invalid movement direction');

  const stock = await tx.stock.upsert({
    where: { batchId_locationId: { batchId, locationId } },
    update: {},
    create: { batchId, locationId, quantity: 0 },
  });

  const next = direction === 'IN' ? stock.quantity + quantity : stock.quantity - quantity;
  if (next < 0) {
    throw new ApiError(400, `Not enough stock: only ${stock.quantity} available in this batch at this location`);
  }

  await tx.stock.update({ where: { id: stock.id }, data: { quantity: next } });

  const movement = await tx.stockMovement.create({
    data: { productId, batchId, locationId, type, direction, quantity, reason, remark, performedById },
  });

  return { movement, quantityAfter: next };
}

/** Rebuild all Stock rows from the movement history (maintenance/backfill). */
async function rebuildStock() {
  const grouped = await prisma.stockMovement.groupBy({
    by: ['batchId', 'locationId', 'direction'],
    where: { batchId: { not: null } },
    _sum: { quantity: true },
  });
  const totals = new Map();
  for (const g of grouped) {
    const key = `${g.batchId}:${g.locationId}`;
    const cur = totals.get(key) || 0;
    totals.set(key, cur + (g.direction === 'IN' ? 1 : -1) * (g._sum.quantity || 0));
  }
  for (const [key, quantity] of totals) {
    const [batchId, locationId] = key.split(':').map(Number);
    await prisma.stock.upsert({
      where: { batchId_locationId: { batchId, locationId } },
      update: { quantity },
      create: { batchId, locationId, quantity },
    });
  }
  return totals.size;
}

module.exports = { applyMovement, rebuildStock };
