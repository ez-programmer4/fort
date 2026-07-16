const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');

async function list(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { tin: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined;

    // Without ?page, return the full list (dropdown/filter consumers).
    if (!req.query.page) {
      const suppliers = await prisma.supplier.findMany({ where, orderBy: { name: 'asc' } });
      return res.json({ suppliers, total: suppliers.length });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const [total, suppliers] = await Promise.all([
      prisma.supplier.count({ where }),
      prisma.supplier.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ suppliers, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

function validate(body, partial = false) {
  const { name, tin, phone, email, address, bankAccounts } = body || {};
  if (!partial && !name) throw new ApiError(400, 'name is required');

  const data = {};
  if (name !== undefined) data.name = String(name).trim();
  for (const [key, val] of Object.entries({ tin, phone, email, address })) {
    if (val !== undefined) data[key] = val ? String(val).trim() : null;
  }
  if (bankAccounts !== undefined) {
    if (!Array.isArray(bankAccounts)) throw new ApiError(400, 'bankAccounts must be an array');
    data.bankAccounts = bankAccounts
      .map((b) => ({
        bankName: String(b?.bankName || '').trim(),
        accountNumber: String(b?.accountNumber || '').trim(),
      }))
      .filter((b) => b.bankName || b.accountNumber);
  }
  return data;
}

async function create(req, res, next) {
  try {
    const data = validate(req.body);
    const existing = await prisma.supplier.findUnique({ where: { name: data.name } });
    if (existing) throw new ApiError(409, 'A supplier with this name already exists');
    const supplier = await prisma.supplier.create({ data });
    res.status(201).json({ supplier });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Supplier not found');

    const data = validate(req.body, true);
    if (req.body?.isActive !== undefined) data.isActive = Boolean(req.body.isActive);

    const supplier = await prisma.supplier.update({ where: { id }, data });
    res.json({ supplier });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.supplier.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Supplier not found');
    try {
      await prisma.supplier.delete({ where: { id } });
    } catch (e) {
      if (e.code === 'P2003') {
        throw new ApiError(409, 'This supplier is linked to products or purchases — deactivate it instead');
      }
      throw e;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
