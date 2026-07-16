const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');

async function list(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    const where = q
      ? {
          OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { phone: { contains: q, mode: 'insensitive' } },
          ],
        }
      : undefined;
    const customers = await prisma.customer.findMany({
      where,
      orderBy: { name: 'asc' },
      take: 20,
    });
    res.json({ customers });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { name, phone, email } = req.body || {};
    if (!name || !String(name).trim()) throw new ApiError(400, 'Customer name is required');
    const customer = await prisma.customer.create({
      data: {
        name: String(name).trim(),
        phone: phone ? String(phone).trim() : null,
        email: email ? String(email).trim() : null,
      },
    });
    res.status(201).json({ customer });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create };
