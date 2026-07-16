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

function buildWhere(query) {
  const { locationId, q, includeZero } = query;
  const where = {};
  if (includeZero !== 'true') where.quantity = { gt: 0 };
  if (locationId) where.locationId = Number(locationId);
  if (q) {
    where.batch = {
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
    };
  }
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

module.exports = { list, adjust, dispose, exportInventory, movements };
