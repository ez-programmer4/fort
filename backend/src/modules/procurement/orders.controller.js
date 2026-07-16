const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');
const { applyMovement } = require('../../utils/stock.service');
const { parseSort } = require('../../utils/sort');

const WHT_TYPES = ['NONE', 'GOODS', 'SERVICES'];

const SORT_FIELDS = {
  poNumber: 'poNumber',
  status: 'status',
  createdAt: 'createdAt',
  supplier: (dir) => ({ supplier: { name: dir } }),
};

const orderInclude = {
  supplier: { select: { id: true, name: true } },
  location: { select: { id: true, name: true } },
  createdBy: { select: { fullName: true } },
  items: {
    include: {
      product: { select: { id: true, code: true, genericName: true, brandName: true, dispenseUnit: true } },
    },
  },
  receipts: { select: { id: true, grvNumber: true } },
};

function computeWithholding(subtotal, type, rate) {
  if (!WHT_TYPES.includes(type)) throw new ApiError(400, `withholdingType must be one of: ${WHT_TYPES.join(', ')}`);
  const r = type === 'NONE' ? 0 : Number(rate);
  if (!Number.isFinite(r) || r < 0 || r > 100) throw new ApiError(400, 'Withholding rate must be between 0 and 100');
  const amount = Math.round(subtotal * r) / 100;
  return { rate: r, amount, netPayable: Math.round((subtotal - amount) * 100) / 100 };
}

function parseItems(items) {
  if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, 'At least one item is required');
  return items.map((it, i) => {
    const quantity = Number(it.quantity);
    const unitCost = Number(it.unitCost);
    const productId = Number(it.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new ApiError(400, `Item ${i + 1}: a valid productId is required`);
    }
    if (!Number.isInteger(quantity) || quantity <= 0) throw new ApiError(400, `Item ${i + 1}: quantity must be a positive whole number`);
    if (!Number.isFinite(unitCost) || unitCost < 0) throw new ApiError(400, `Item ${i + 1}: unit cost must be zero or more`);
    return {
      productId,
      quantity,
      unitCost,
      batchNo: it.batchNo ? String(it.batchNo).trim() : null,
      expiryDate: it.expiryDate ? new Date(it.expiryDate) : null,
    };
  });
}

async function list(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const where = {};
    if (req.query.status) where.status = String(req.query.status);
    if (req.query.q) {
      where.OR = [
        { poNumber: { contains: req.query.q, mode: 'insensitive' } },
        { supplier: { name: { contains: req.query.q, mode: 'insensitive' } } },
      ];
    }
    const orderBy = req.query.sortBy ? parseSort(req.query, SORT_FIELDS, 'createdAt') : { id: 'desc' };
    const [total, orders] = await Promise.all([
      prisma.purchaseOrder.count({ where }),
      prisma.purchaseOrder.findMany({
        where,
        include: orderInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ orders, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { supplierId, locationId, notes } = req.body || {};
    if (!locationId) throw new ApiError(400, 'locationId is required');
    const location = await prisma.location.findUnique({ where: { id: Number(locationId) } });
    if (!location) throw new ApiError(404, 'Location not found');
    if (supplierId) {
      const sup = await prisma.supplier.findUnique({ where: { id: Number(supplierId) } });
      if (!sup) throw new ApiError(404, 'Supplier not found');
    }
    const items = parseItems(req.body?.items);

    const productIds = [...new Set(items.map((i) => i.productId))];
    const found = await prisma.product.count({ where: { id: { in: productIds } } });
    if (found !== productIds.length) throw new ApiError(400, 'One or more products do not exist');

    const order = await prisma.$transaction(async (tx) => {
      const last = await tx.purchaseOrder.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
      const poNumber = `PO-${String((last?.id || 0) + 1).padStart(5, '0')}`;
      return tx.purchaseOrder.create({
        data: {
          poNumber,
          supplierId: supplierId ? Number(supplierId) : null,
          locationId: Number(locationId),
          notes: notes ? String(notes).trim() : null,
          createdById: req.user.id,
          items: { create: items },
        },
        include: orderInclude,
      });
    });
    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
}

// Receive a PO: create batches, stock-in movements, and the GRV — atomically.
async function receive(req, res, next) {
  try {
    const id = Number(req.params.id);
    const order = await prisma.purchaseOrder.findUnique({ where: { id }, include: { items: true } });
    if (!order) throw new ApiError(404, 'Purchase order not found');
    if (order.status !== 'OPEN') throw new ApiError(400, `This purchase order is already ${order.status.toLowerCase()}`);

    const { withholdingType = 'NONE', withholdingRate = 0, notes } = req.body || {};
    const lines = req.body?.items;
    if (!Array.isArray(lines) || lines.length === 0) throw new ApiError(400, 'items are required');

    const byItemId = new Map(order.items.map((it) => [it.id, it]));
    const parsed = lines.map((l, i) => {
      const poItem = byItemId.get(Number(l.itemId));
      if (!poItem) throw new ApiError(400, `Line ${i + 1}: itemId does not belong to this purchase order`);
      const quantity = Number(l.quantity ?? poItem.quantity);
      const unitCost = Number(l.unitCost ?? poItem.unitCost);
      const batchNo = String(l.batchNo ?? poItem.batchNo ?? '').trim();
      const expiryDate = l.expiryDate ? new Date(l.expiryDate) : poItem.expiryDate;
      if (!batchNo) throw new ApiError(400, `Line ${i + 1}: batch number is required`);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new ApiError(400, `Line ${i + 1}: quantity must be a positive whole number`);
      if (!Number.isFinite(unitCost) || unitCost < 0) throw new ApiError(400, `Line ${i + 1}: unit cost must be zero or more`);
      return { productId: poItem.productId, quantity, unitCost, batchNo, expiryDate };
    });

    const subtotal = Math.round(parsed.reduce((s, l) => s + l.quantity * l.unitCost, 0) * 100) / 100;
    const wht = computeWithholding(subtotal, withholdingType, withholdingRate);

    const receipt = await prisma.$transaction(async (tx) => {
      const last = await tx.goodsReceipt.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
      const grvNumber = `GRV-${String((last?.id || 0) + 1).padStart(5, '0')}`;

      const grv = await tx.goodsReceipt.create({
        data: {
          grvNumber,
          purchaseOrderId: order.id,
          supplierId: order.supplierId,
          locationId: order.locationId,
          subtotal,
          withholdingType,
          withholdingRate: wht.rate,
          withholdingAmount: wht.amount,
          netPayable: wht.netPayable,
          notes: notes ? String(notes).trim() : null,
          receivedById: req.user.id,
        },
      });

      for (const line of parsed) {
        const batch = await tx.batch.upsert({
          where: { productId_batchNo: { productId: line.productId, batchNo: line.batchNo } },
          update: {
            ...(line.expiryDate ? { expiryDate: line.expiryDate } : {}),
            supplierId: order.supplierId,
            unitCost: line.unitCost,
          },
          create: {
            productId: line.productId,
            batchNo: line.batchNo,
            expiryDate: line.expiryDate,
            supplierId: order.supplierId,
            unitCost: line.unitCost,
          },
        });

        await tx.gRVItem.create({
          data: {
            goodsReceiptId: grv.id,
            productId: line.productId,
            batchId: batch.id,
            quantity: line.quantity,
            unitCost: line.unitCost,
          },
        });

        await applyMovement(tx, {
          productId: line.productId,
          batchId: batch.id,
          locationId: order.locationId,
          type: 'GRV',
          direction: 'IN',
          quantity: line.quantity,
          remark: `${grvNumber} (${order.poNumber})`,
          performedById: req.user.id,
        });
      }

      await tx.purchaseOrder.update({ where: { id: order.id }, data: { status: 'RECEIVED' } });
      return grv;
    });

    res.status(201).json({ receipt });
  } catch (err) {
    next(err);
  }
}

async function cancel(req, res, next) {
  try {
    const id = Number(req.params.id);
    const order = await prisma.purchaseOrder.findUnique({ where: { id } });
    if (!order) throw new ApiError(404, 'Purchase order not found');
    if (order.status !== 'OPEN') throw new ApiError(400, `Only open purchase orders can be cancelled (this one is ${order.status.toLowerCase()})`);
    const updated = await prisma.purchaseOrder.update({
      where: { id },
      data: { status: 'CANCELLED' },
      include: orderInclude,
    });
    res.json({ order: updated });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, receive, cancel, computeWithholding, WHT_TYPES };
