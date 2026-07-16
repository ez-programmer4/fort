const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');
const { parseSort } = require('../../utils/sort');

const TYPES = ['Retail', 'Warehouse', 'Dispensary', 'Other'];

const SORT_FIELDS = { name: 'name', type: 'type', address: 'address', createdAt: 'createdAt' };

async function list(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { address: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined;
    const orderBy = parseSort(req.query, SORT_FIELDS, 'name');

    // Without ?page, return the full list (dropdown/filter consumers).
    if (!req.query.page) {
      const locations = await prisma.location.findMany({ where, orderBy });
      return res.json({ locations, total: locations.length });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const [total, locations] = await Promise.all([
      prisma.location.count({ where }),
      prisma.location.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ locations, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

function validate(body, partial = false) {
  const { name, type, address, contactPerson } = body || {};
  if (!partial && (!name || !type || !address)) {
    throw new ApiError(400, 'name, type and address are required');
  }
  if (type !== undefined && !TYPES.includes(type)) {
    throw new ApiError(400, `type must be one of: ${TYPES.join(', ')}`);
  }
  const data = {};
  if (name !== undefined) data.name = String(name).trim();
  if (type !== undefined) data.type = type;
  if (address !== undefined) data.address = String(address).trim();
  if (contactPerson !== undefined) {
    data.contactPerson = contactPerson ? String(contactPerson).trim() : null;
  }
  return data;
}

async function create(req, res, next) {
  try {
    const data = validate(req.body);
    const existing = await prisma.location.findUnique({ where: { name: data.name } });
    if (existing) throw new ApiError(409, 'A location with this name already exists');
    const location = await prisma.location.create({ data });
    res.status(201).json({ location });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.location.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Location not found');

    const data = validate(req.body, true);
    if (req.body?.isActive !== undefined) data.isActive = Boolean(req.body.isActive);

    const location = await prisma.location.update({ where: { id }, data });
    res.json({ location });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.location.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Location not found');
    try {
      await prisma.location.delete({ where: { id } });
    } catch (e) {
      if (e.code === 'P2003') {
        throw new ApiError(409, 'This location has stock or transaction history — deactivate it instead');
      }
      throw e;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove };
