const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');
const { getSettings } = require('../../utils/settings.service');

const ADJUSTMENT_LOOKBACK_DAYS = 30;

// Alerts are computed live from stock + movements, using each product's own
// thresholds (minStock / maxStock in its dispense unit, expiryAlertDays).
async function buildAlerts(locationId) {
  const settings = await getSettings();
  const DEFAULT_EXPIRY_DAYS = Number(settings.defaultExpiryAlertDays) || 90;
  const where = { quantity: { gt: 0 }, ...(locationId ? { locationId } : {}) };

  const stocks = await prisma.stock.findMany({
    where,
    include: {
      batch: {
        include: {
          product: {
            select: {
              id: true, code: true, genericName: true, brandName: true,
              dispenseUnit: true, minStock: true, maxStock: true, expiryAlertDays: true,
            },
          },
          supplier: { select: { name: true } },
        },
      },
      location: { select: { id: true, name: true } },
    },
  });

  const now = new Date();
  const alerts = [];

  // Expired / expiring soon — per batch × location
  for (const s of stocks) {
    const { batch } = s;
    if (!batch.expiryDate) continue;
    const days = Math.floor((new Date(batch.expiryDate).getTime() - now.getTime()) / 86400000);
    const windowDays = batch.product.expiryAlertDays ?? DEFAULT_EXPIRY_DAYS;
    if (days < 0) {
      alerts.push({
        type: 'EXPIRED',
        product: batch.product,
        location: s.location,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        supplier: batch.supplier?.name || null,
        quantity: s.quantity,
        unit: batch.product.dispenseUnit,
        detail: `Expired ${Math.abs(days)} day(s) ago — ${s.quantity} ${batch.product.dispenseUnit || 'unit(s)'} still in stock`,
      });
    } else if (days <= windowDays) {
      alerts.push({
        type: 'EXPIRING',
        product: batch.product,
        location: s.location,
        batchNo: batch.batchNo,
        expiryDate: batch.expiryDate,
        supplier: batch.supplier?.name || null,
        quantity: s.quantity,
        unit: batch.product.dispenseUnit,
        detail: `Expires in ${days} day(s) (alert window: ${windowDays} days)`,
      });
    }
  }

  // Low / over stock — totals per product × location vs that product's thresholds
  const totals = new Map(); // productId:locationId -> { product, location, qty }
  for (const s of stocks) {
    const key = `${s.batch.product.id}:${s.location.id}`;
    const cur = totals.get(key);
    if (cur) cur.qty += s.quantity;
    else totals.set(key, { product: s.batch.product, location: s.location, qty: s.quantity });
  }
  for (const { product, location, qty } of totals.values()) {
    const unit = product.dispenseUnit || 'unit(s)';
    if (product.minStock != null && qty < product.minStock) {
      alerts.push({
        type: 'LOW_STOCK',
        product, location,
        batchNo: null, expiryDate: null, supplier: null,
        quantity: qty,
        unit: product.dispenseUnit,
        detail: `${qty} ${unit} on hand — below this product's minimum of ${product.minStock} ${unit}`,
      });
    }
    if (product.maxStock != null && qty > product.maxStock) {
      alerts.push({
        type: 'OVER_STOCK',
        product, location,
        batchNo: null, expiryDate: null, supplier: null,
        quantity: qty,
        unit: product.dispenseUnit,
        detail: `${qty} ${unit} on hand — above this product's maximum of ${product.maxStock} ${unit}`,
      });
    }
  }

  // Products whose stock is fully zero don't appear in `stocks`; still check low-stock
  // for products that define minStock and have no stock at the location(s).
  const productsWithMin = await prisma.product.findMany({
    where: { minStock: { not: null }, isActive: true },
    select: { id: true, code: true, genericName: true, brandName: true, dispenseUnit: true, minStock: true, maxStock: true, expiryAlertDays: true },
  });
  const locations = locationId
    ? await prisma.location.findMany({ where: { id: locationId }, select: { id: true, name: true } })
    : await prisma.location.findMany({ where: { isActive: true }, select: { id: true, name: true } });
  for (const product of productsWithMin) {
    for (const location of locations) {
      const key = `${product.id}:${location.id}`;
      if (!totals.has(key) && product.minStock > 0) {
        alerts.push({
          type: 'LOW_STOCK',
          product, location,
          batchNo: null, expiryDate: null, supplier: null,
          quantity: 0,
          unit: product.dispenseUnit,
          detail: `Out of stock — this product's minimum is ${product.minStock} ${product.dispenseUnit || 'unit(s)'}`,
        });
      }
    }
  }

  return alerts;
}

async function list(req, res, next) {
  try {
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    const type = req.query.type ? String(req.query.type) : undefined;

    let alerts = await buildAlerts(locationId);

    // Stock adjustments as alerts (audit visibility), last 30 days
    if (!type || type === 'ADJUSTMENT') {
      const since = new Date(Date.now() - ADJUSTMENT_LOOKBACK_DAYS * 86400000);
      const adjustments = await prisma.stockMovement.findMany({
        where: {
          type: { in: ['ADJUST_INCREASE', 'ADJUST_DECREASE'] },
          createdAt: { gte: since },
          ...(locationId ? { locationId } : {}),
        },
        include: {
          product: { select: { id: true, code: true, genericName: true, brandName: true, dispenseUnit: true } },
          batch: { include: { supplier: { select: { name: true } } } },
          location: { select: { id: true, name: true } },
          performedBy: { select: { fullName: true } },
        },
        orderBy: { createdAt: 'desc' },
      });
      for (const m of adjustments) {
        alerts.push({
          type: 'ADJUSTMENT',
          product: m.product,
          location: m.location,
          batchNo: m.batch?.batchNo || null,
          expiryDate: m.batch?.expiryDate || null,
          supplier: m.batch?.supplier?.name || null,
          quantity: m.quantity,
          unit: m.product.dispenseUnit,
          movementType: m.type,
          reason: m.reason,
          performedBy: m.performedBy.fullName,
          moveDate: m.createdAt,
          detail: `${m.type === 'ADJUST_INCREASE' ? 'Increased' : 'Decreased'} by ${m.quantity} ${m.product.dispenseUnit || 'unit(s)'} — ${m.reason || 'no reason'}`,
        });
      }
    }

    if (type) {
      const valid = ['EXPIRED', 'EXPIRING', 'LOW_STOCK', 'OVER_STOCK', 'ADJUSTMENT'];
      if (!valid.includes(type)) throw new ApiError(400, `type must be one of: ${valid.join(', ')}`);
      alerts = alerts.filter((a) => a.type === type);
    }

    const counts = {};
    for (const a of alerts) counts[a.type] = (counts[a.type] || 0) + 1;

    res.json({ alerts, counts, total: alerts.length });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, buildAlerts };
