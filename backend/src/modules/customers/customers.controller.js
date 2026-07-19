const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');
const { parseSort } = require('../../utils/sort');

const SORT_FIELDS = { name: 'name', phone: 'phone', createdAt: 'createdAt' };
const RATINGS = ['UNRATED', 'GOOD', 'FAIR', 'POOR'];

async function list(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    const { active } = req.query;
    const where = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;
    const orderBy = parseSort(req.query, SORT_FIELDS, 'name');

    // Without ?page, return a short list for search/quick-create consumers.
    if (!req.query.page) {
      const customers = await prisma.customer.findMany({ where, orderBy, take: 20 });
      return res.json({ customers, total: customers.length });
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 10));
    const [total, customers] = await Promise.all([
      prisma.customer.count({ where }),
      prisma.customer.findMany({
        where,
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: { _count: { select: { dispenseOrders: true } } },
      }),
    ]);
    res.json({ customers, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

function validate(body, partial = false) {
  const { name, phone, email, bankAccounts, creditRating } = body || {};
  if (!partial && (!name || !String(name).trim())) throw new ApiError(400, 'Customer name is required');
  const data = {};
  if (name !== undefined) {
    if (!String(name).trim()) throw new ApiError(400, 'Customer name cannot be empty');
    data.name = String(name).trim();
  }
  if (phone !== undefined) data.phone = phone ? String(phone).trim() : null;
  if (email !== undefined) data.email = email ? String(email).trim() : null;
  if (creditRating !== undefined) {
    if (!RATINGS.includes(creditRating)) throw new ApiError(400, `creditRating must be one of: ${RATINGS.join(', ')}`);
    data.creditRating = creditRating;
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
    const customer = await prisma.customer.create({ data });
    res.status(201).json({ customer });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Customer not found');

    const data = validate(req.body, true);
    if (req.body?.isActive !== undefined) data.isActive = Boolean(req.body.isActive);

    const customer = await prisma.customer.update({ where: { id }, data });
    res.json({ customer });
  } catch (err) {
    next(err);
  }
}

// Payment-history summary for one customer — the "detailed summary" staff use
// to decide what to manually set creditRating to, and what the Sales dispense
// flow shows (advisory only) when a Credit sale is being made against them.
async function creditSummary(req, res, next) {
  try {
    const id = Number(req.params.id);
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new ApiError(404, 'Customer not found');

    const orders = await prisma.dispenseOrder.findMany({
      where: { customerId: id },
      select: {
        id: true, paymentType: true, total: true, createdAt: true,
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const creditOrders = orders.filter((o) => o.paymentType === 'CREDIT');
    let totalCreditAmount = 0;
    let totalPaid = 0;
    let settledCount = 0;
    for (const o of creditOrders) {
      const total = Number(o.total);
      const paid = o.payments.reduce((s, p) => s + Number(p.amount), 0);
      totalCreditAmount += total;
      totalPaid += Math.min(paid, total);
      if (paid >= total) settledCount += 1;
    }
    const outstanding = Math.round((totalCreditAmount - totalPaid) * 100) / 100;

    res.json({
      creditRating: customer.creditRating,
      totalOrders: orders.length,
      creditOrderCount: creditOrders.length,
      settledCount,
      outstandingCount: creditOrders.length - settledCount,
      totalCreditAmount: Math.round(totalCreditAmount * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      outstanding,
      lastOrderAt: orders[0]?.createdAt || null,
    });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Customer not found');
    try {
      await prisma.customer.delete({ where: { id } });
    } catch (e) {
      if (e.code === 'P2003') {
        throw new ApiError(409, 'This customer has sales history — deactivate them instead');
      }
      throw e;
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, update, remove, creditSummary };
