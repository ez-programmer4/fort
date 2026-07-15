const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');

const TYPES = ['Medication', 'Equipment', 'Cosmetics'];

const productInclude = { supplier: { select: { id: true, name: true } } };

function buildWhere(query) {
  const { q, type, supplierId, active } = query;
  const where = {};
  if (q) {
    where.OR = [
      { code: { contains: q, mode: 'insensitive' } },
      { genericName: { contains: q, mode: 'insensitive' } },
      { brandName: { contains: q, mode: 'insensitive' } },
      { pharmClass: { contains: q, mode: 'insensitive' } },
      { manufacturer: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (type && TYPES.includes(type)) where.type = type;
  if (supplierId) where.supplierId = Number(supplierId);
  if (active === 'true') where.isActive = true;
  if (active === 'false') where.isActive = false;
  return where;
}

async function list(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const where = buildWhere(req.query);

    const [total, products] = await Promise.all([
      prisma.product.count({ where }),
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: { code: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ products, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

function validate(body, partial = false) {
  const b = body || {};
  if (!partial) {
    if (!b.type || !TYPES.includes(b.type)) throw new ApiError(400, `type must be one of: ${TYPES.join(', ')}`);
    if (!b.pharmClass) throw new ApiError(400, 'Pharmacotherapeutic class is required');
    if (!b.genericName) throw new ApiError(400, 'Generic name is required');
  } else if (b.type !== undefined && !TYPES.includes(b.type)) {
    throw new ApiError(400, `type must be one of: ${TYPES.join(', ')}`);
  }

  const data = {};
  const strFields = [
    'type', 'pharmClass', 'genericName', 'brandName', 'description', 'strength',
    'doseUnit', 'route', 'doseForm', 'orderUnit', 'dispenseUnit', 'countryOfOrigin', 'manufacturer',
  ];
  for (const f of strFields) {
    if (b[f] !== undefined) data[f] = b[f] ? String(b[f]).trim() : null;
  }
  // required strings must not be nulled
  for (const f of ['type', 'pharmClass', 'genericName']) {
    if (data[f] === null) throw new ApiError(400, `${f} cannot be empty`);
  }
  if (b.conversionFactor !== undefined) {
    const cf = Number(b.conversionFactor);
    if (!Number.isFinite(cf) || cf <= 0) throw new ApiError(400, 'Conversion factor must be a positive number');
    data.conversionFactor = cf;
  }
  if (b.unitPrice !== undefined) {
    const up = Number(b.unitPrice);
    if (!Number.isFinite(up) || up < 0) throw new ApiError(400, 'Unit price must be zero or more');
    data.unitPrice = up;
  }
  if (b.supplierId !== undefined) data.supplierId = b.supplierId ? Number(b.supplierId) : null;
  // Per-product alert thresholds (in the product's dispense unit)
  for (const f of ['minStock', 'maxStock', 'expiryAlertDays']) {
    if (b[f] !== undefined) {
      if (b[f] === null || b[f] === '') {
        data[f] = null;
      } else {
        const n = Number(b[f]);
        if (!Number.isInteger(n) || n < 0) throw new ApiError(400, `${f} must be a non-negative whole number`);
        data[f] = n;
      }
    }
  }
  if (data.minStock != null && data.maxStock != null && data.maxStock < data.minStock) {
    throw new ApiError(400, 'maxStock cannot be lower than minStock');
  }
  return data;
}

async function nextCode(tx) {
  const last = await tx.product.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
  return `P-${String((last?.id || 0) + 1).padStart(5, '0')}`;
}

async function create(req, res, next) {
  try {
    const data = validate(req.body);
    if (data.supplierId) {
      const sup = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
      if (!sup) throw new ApiError(400, 'Supplier not found');
    }
    const product = await prisma.$transaction(async (tx) => {
      const code = await nextCode(tx);
      return tx.product.create({ data: { ...data, code }, include: productInclude });
    });
    res.status(201).json({ product });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Product not found');

    const data = validate(req.body, true);
    if (data.supplierId) {
      const sup = await prisma.supplier.findUnique({ where: { id: data.supplierId } });
      if (!sup) throw new ApiError(400, 'Supplier not found');
    }
    if (req.body?.isActive !== undefined) data.isActive = Boolean(req.body.isActive);

    const product = await prisma.product.update({ where: { id }, data, include: productInclude });
    res.json({ product });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, buildWhere, TYPES, productInclude };
