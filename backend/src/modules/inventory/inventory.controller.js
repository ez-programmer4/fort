const ExcelJS = require('exceljs');
const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');
const { applyMovement } = require('../../utils/stock.service');
const { parseSort } = require('../../utils/sort');

const SORT_FIELDS = {
  code: (dir) => ({ batch: { product: { code: dir } } }),
  genericName: (dir) => ({ batch: { product: { genericName: dir } } }),
  quantity: 'quantity',
  expiryDate: (dir) => ({ batch: { expiryDate: dir } }),
  location: (dir) => ({ location: { name: dir } }),
};

const MOVEMENT_SORT_FIELDS = {
  createdAt: 'createdAt',
  type: 'type',
  quantity: 'quantity',
  product: (dir) => ({ product: { genericName: dir } }),
  location: (dir) => ({ location: { name: dir } }),
  performedBy: (dir) => ({ performedBy: { fullName: dir } }),
};

const TRANSFER_SORT_FIELDS = {
  transferNumber: 'transferNumber',
  createdAt: 'createdAt',
  fromLocation: (dir) => ({ fromLocation: { name: dir } }),
  toLocation: (dir) => ({ toLocation: { name: dir } }),
};

function buildWhere(query) {
  const { locationId, q, includeZero, active } = query;
  const where = {};
  if (includeZero !== 'true') where.quantity = { gt: 0 };
  if (locationId) where.locationId = Number(locationId);
  const batchAnd = [];
  if (q) {
    batchAnd.push({
      OR: [
        { batchNo: { contains: q, mode: 'insensitive' } },
        {
          product: {
            OR: [
              { code: { contains: q, mode: 'insensitive' } },
              { genericName: { contains: q, mode: 'insensitive' } },
              { brandName: { contains: q, mode: 'insensitive' } },
            ],
          },
        },
      ],
    });
  }
  if (active === 'true') batchAnd.push({ product: { isActive: true } });
  if (batchAnd.length) where.batch = { AND: batchAnd };
  return where;
}

const stockInclude = {
  batch: {
    include: {
      product: {
        select: {
          id: true, code: true, genericName: true, brandName: true,
          description: true, dispenseUnit: true, unitPrice: true,
        },
      },
      supplier: { select: { name: true } },
    },
  },
  location: { select: { id: true, name: true } },
};

function toRow(s) {
  return {
    stockId: s.id,
    batchId: s.batchId,
    productId: s.batch.product.id,
    code: s.batch.product.code,
    genericName: s.batch.product.genericName,
    brandName: s.batch.product.brandName,
    description: s.batch.product.description,
    dispenseUnit: s.batch.product.dispenseUnit,
    unitPrice: s.batch.product.unitPrice,
    quantity: s.quantity,
    supplier: s.batch.supplier?.name || null,
    batchNo: s.batch.batchNo,
    expiryDate: s.batch.expiryDate,
    location: s.location,
  };
}

async function list(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const where = buildWhere(req.query);
    const orderBy = req.query.sortBy
      ? parseSort(req.query, SORT_FIELDS, 'code')
      : [{ batch: { product: { code: 'asc' } } }, { batch: { expiryDate: 'asc' } }];

    const [total, stocks] = await Promise.all([
      prisma.stock.count({ where }),
      prisma.stock.findMany({
        where,
        include: stockInclude,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ items: stocks.map(toRow), total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

async function adjust(req, res, next) {
  try {
    const { batchId, locationId, type, quantity, reason } = req.body || {};
    if (!batchId || !locationId) throw new ApiError(400, 'batchId and locationId are required');
    if (!['INCREASE', 'DECREASE'].includes(type)) throw new ApiError(400, 'type must be INCREASE or DECREASE');
    if (!reason || !String(reason).trim()) throw new ApiError(400, 'A reason is required for stock adjustments');

    const batch = await prisma.batch.findUnique({ where: { id: Number(batchId) } });
    if (!batch) throw new ApiError(404, 'Batch not found');
    const location = await prisma.location.findUnique({ where: { id: Number(locationId) } });
    if (!location) throw new ApiError(404, 'Location not found');

    const result = await prisma.$transaction((tx) =>
      applyMovement(tx, {
        productId: batch.productId,
        batchId: batch.id,
        locationId: location.id,
        type: type === 'INCREASE' ? 'ADJUST_INCREASE' : 'ADJUST_DECREASE',
        direction: type === 'INCREASE' ? 'IN' : 'OUT',
        quantity: Number(quantity),
        reason: String(reason).trim(),
        performedById: req.user.id,
      }),
    );

    res.status(201).json({ ok: true, quantityAfter: result.quantityAfter });
  } catch (err) {
    next(err);
  }
}

// Dispose expired / near-expiry stock (write-off). Always a stock-out; reason is mandatory.
async function dispose(req, res, next) {
  try {
    const { batchId, locationId, quantity, reason } = req.body || {};
    if (!batchId || !locationId) throw new ApiError(400, 'batchId and locationId are required');
    if (!reason || !String(reason).trim()) throw new ApiError(400, 'A reason is required to dispose stock');

    const batch = await prisma.batch.findUnique({ where: { id: Number(batchId) } });
    if (!batch) throw new ApiError(404, 'Batch not found');
    const location = await prisma.location.findUnique({ where: { id: Number(locationId) } });
    if (!location) throw new ApiError(404, 'Location not found');

    const result = await prisma.$transaction((tx) =>
      applyMovement(tx, {
        productId: batch.productId,
        batchId: batch.id,
        locationId: location.id,
        type: 'DISPOSE',
        direction: 'OUT',
        quantity: Number(quantity),
        reason: String(reason).trim(),
        performedById: req.user.id,
      }),
    );

    res.status(201).json({ ok: true, quantityAfter: result.quantityAfter });
  } catch (err) {
    next(err);
  }
}

// Move one or more batches from one location to another as a single,
// atomic, traceable transaction — a paired TRANSFER_OUT/TRANSFER_IN
// movement per item, sharing one transfer number.
async function transfer(req, res, next) {
  try {
    const { fromLocationId, toLocationId, notes, items } = req.body || {};
    const fromId = Number(fromLocationId);
    const toId = Number(toLocationId);
    if (!Number.isInteger(fromId) || fromId <= 0 || !Number.isInteger(toId) || toId <= 0) {
      throw new ApiError(400, 'fromLocationId and toLocationId are required');
    }
    if (fromId === toId) throw new ApiError(400, 'Source and destination locations must be different');
    if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, 'At least one item is required');

    const [fromLocation, toLocation] = await Promise.all([
      prisma.location.findUnique({ where: { id: fromId } }),
      prisma.location.findUnique({ where: { id: toId } }),
    ]);
    if (!fromLocation) throw new ApiError(404, 'Source location not found');
    if (!toLocation) throw new ApiError(404, 'Destination location not found');
    if (!toLocation.isActive) throw new ApiError(400, 'Destination location is inactive');

    const parsed = items.map((it, i) => {
      const batchId = Number(it.batchId);
      const quantity = Number(it.quantity);
      if (!Number.isInteger(batchId) || batchId <= 0) throw new ApiError(400, `Item ${i + 1}: a valid batchId is required`);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new ApiError(400, `Item ${i + 1}: quantity must be a positive whole number`);
      return { batchId, quantity };
    });

    const batches = await prisma.batch.findMany({
      where: { id: { in: parsed.map((p) => p.batchId) } },
      select: { id: true, productId: true },
    });
    const batchById = new Map(batches.map((b) => [b.id, b]));
    parsed.forEach((p, i) => {
      if (!batchById.has(p.batchId)) throw new ApiError(400, `Item ${i + 1}: batch not found`);
    });

    const transferRecord = await prisma.$transaction(async (tx) => {
      const last = await tx.stockTransfer.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
      const transferNumber = `TRF-${String((last?.id || 0) + 1).padStart(5, '0')}`;

      const created = await tx.stockTransfer.create({
        data: {
          transferNumber,
          fromLocationId: fromId,
          toLocationId: toId,
          notes: notes ? String(notes).trim() : null,
          performedById: req.user.id,
        },
      });

      for (const item of parsed) {
        const batch = batchById.get(item.batchId);
        await tx.stockTransferItem.create({
          data: {
            stockTransferId: created.id,
            productId: batch.productId,
            batchId: batch.id,
            quantity: item.quantity,
          },
        });

        await applyMovement(tx, {
          productId: batch.productId,
          batchId: batch.id,
          locationId: fromId,
          type: 'TRANSFER_OUT',
          direction: 'OUT',
          quantity: item.quantity,
          remark: `${transferNumber} → ${toLocation.name}`,
          performedById: req.user.id,
        });
        await applyMovement(tx, {
          productId: batch.productId,
          batchId: batch.id,
          locationId: toId,
          type: 'TRANSFER_IN',
          direction: 'IN',
          quantity: item.quantity,
          remark: `${transferNumber} ← ${fromLocation.name}`,
          performedById: req.user.id,
        });
      }

      return created;
    });

    res.status(201).json({ transfer: transferRecord });
  } catch (err) {
    next(err);
  }
}

async function listTransfers(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const where = {};
    if (req.query.locationId) {
      const locId = Number(req.query.locationId);
      where.OR = [{ fromLocationId: locId }, { toLocationId: locId }];
    }
    if (req.query.q) where.transferNumber = { contains: String(req.query.q), mode: 'insensitive' };

    const orderBy = req.query.sortBy ? parseSort(req.query, TRANSFER_SORT_FIELDS, 'createdAt') : { id: 'desc' };

    const [total, rows] = await Promise.all([
      prisma.stockTransfer.count({ where }),
      prisma.stockTransfer.findMany({
        where,
        include: {
          fromLocation: { select: { name: true } },
          toLocation: { select: { name: true } },
          performedBy: { select: { fullName: true } },
          items: {
            include: {
              product: { select: { code: true, genericName: true, dispenseUnit: true } },
              batch: { select: { batchNo: true } },
            },
          },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ transfers: rows, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

async function exportInventory(req, res, next) {
  try {
    const where = buildWhere(req.query);
    const stocks = await prisma.stock.findMany({
      where,
      include: stockInclude,
      orderBy: [{ batch: { product: { code: 'asc' } } }, { batch: { expiryDate: 'asc' } }],
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Inventory');
    ws.columns = [
      { header: 'Code', key: 'code', width: 10 },
      { header: 'Generic Name', key: 'genericName', width: 24 },
      { header: 'Brand', key: 'brandName', width: 18 },
      { header: 'Description', key: 'description', width: 28 },
      { header: 'Quantity', key: 'quantity', width: 10 },
      { header: 'Unit', key: 'dispenseUnit', width: 10 },
      { header: 'Unit Price', key: 'unitPrice', width: 12 },
      { header: 'Supplier', key: 'supplier', width: 20 },
      { header: 'Batch No.', key: 'batchNo', width: 14 },
      { header: 'Expiry Date', key: 'expiryDate', width: 14 },
      { header: 'Location', key: 'location', width: 18 },
    ];
    ws.getRow(1).font = { bold: true };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
    for (const s of stocks) {
      const r = toRow(s);
      ws.addRow({
        ...r,
        unitPrice: Number(r.unitPrice),
        expiryDate: r.expiryDate ? new Date(r.expiryDate).toISOString().slice(0, 10) : '',
        location: r.location.name,
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="inventory-${new Date().toISOString().slice(0, 10)}.xlsx"`);
    await wb.xlsx.write(res);
    res.end();
  } catch (err) {
    next(err);
  }
}

// Audit trail: every stock movement, filterable
async function movements(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 25));
    const where = {};
    if (req.query.type) where.type = String(req.query.type);
    if (req.query.locationId) where.locationId = Number(req.query.locationId);
    if (req.query.q) {
      where.product = {
        OR: [
          { code: { contains: req.query.q, mode: 'insensitive' } },
          { genericName: { contains: req.query.q, mode: 'insensitive' } },
          { brandName: { contains: req.query.q, mode: 'insensitive' } },
        ],
      };
    }
    const from = req.query.from ? new Date(`${req.query.from}T00:00:00`) : null;
    const to = req.query.to ? new Date(`${req.query.to}T23:59:59.999`) : null;
    if ((from && isNaN(from)) || (to && isNaN(to))) throw new ApiError(400, 'Invalid date range');
    if (from || to) where.createdAt = { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };

    const orderBy = req.query.sortBy ? parseSort(req.query, MOVEMENT_SORT_FIELDS, 'createdAt') : { id: 'desc' };
    const [total, rows] = await Promise.all([
      prisma.stockMovement.count({ where }),
      prisma.stockMovement.findMany({
        where,
        include: {
          product: { select: { code: true, genericName: true, dispenseUnit: true } },
          batch: { select: { batchNo: true, expiryDate: true } },
          location: { select: { name: true } },
          performedBy: { select: { fullName: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ movements: rows, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, adjust, dispose, transfer, listTransfers, exportInventory, movements };
