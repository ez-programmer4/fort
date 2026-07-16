const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');
const { parseSort } = require('../../utils/sort');

const PAYMENT_METHODS = ['CASH', 'BANK_TRANSFER', 'CHEQUE', 'MOBILE'];

// paid/outstanding are computed post-query (summed from payments), so only
// DB-backed columns are sortable here.
const CREDIT_SORT_FIELDS = {
  dspNumber: 'dspNumber',
  createdAt: 'createdAt',
  total: 'total',
  location: (dir) => ({ location: { name: dir } }),
  dispensedBy: (dir) => ({ dispensedBy: { fullName: dir } }),
};

const PAYMENT_SORT_FIELDS = {
  createdAt: 'createdAt',
  amount: 'amount',
  method: 'method',
  reference: 'reference',
  dspNumber: (dir) => ({ dispenseOrder: { dspNumber: dir } }),
};

function dateRange(query) {
  const from = query.from ? new Date(`${query.from}T00:00:00`) : null;
  const to = query.to ? new Date(`${query.to}T23:59:59.999`) : null;
  if ((from && isNaN(from)) || (to && isNaN(to))) throw new ApiError(400, 'Invalid date range');
  if (!from && !to) return undefined;
  return { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) };
}

// Cash sales are settled at sale time; credit sales are settled by payments.
async function summary(req, res, next) {
  try {
    const createdAt = dateRange(req.query);
    const locationId = req.query.locationId ? Number(req.query.locationId) : undefined;
    const whereOrders = { ...(createdAt ? { createdAt } : {}), ...(locationId ? { locationId } : {}) };

    const [byPayment, wht, payments, credits] = await Promise.all([
      prisma.dispenseOrder.groupBy({
        by: ['paymentType'],
        where: whereOrders,
        _sum: { total: true },
        _count: true,
      }),
      prisma.dispenseOrder.aggregate({ where: whereOrders, _sum: { withholdingAmount: true } }),
      prisma.payment.aggregate({
        where: { ...(createdAt ? { createdAt } : {}), ...(locationId ? { dispenseOrder: { locationId } } : {}) },
        _sum: { amount: true },
      }),
      prisma.dispenseOrder.findMany({
        where: { ...whereOrders, paymentType: 'CREDIT' },
        select: { total: true, payments: { select: { amount: true } } },
      }),
    ]);

    const cash = byPayment.find((g) => g.paymentType === 'CASH');
    const credit = byPayment.find((g) => g.paymentType === 'CREDIT');
    const cashTotal = Number(cash?._sum.total || 0);
    const creditTotal = Number(credit?._sum.total || 0);
    const outstanding = credits.reduce(
      (s, o) => s + Math.max(0, Number(o.total) - o.payments.reduce((p, x) => p + Number(x.amount), 0)),
      0,
    );

    res.json({
      totalSales: Math.round((cashTotal + creditTotal) * 100) / 100,
      cashSales: cashTotal,
      creditSales: creditTotal,
      salesCount: (cash?._count || 0) + (credit?._count || 0),
      paymentsReceived: Number(payments._sum.amount || 0),
      outstanding: Math.round(outstanding * 100) / 100,
      withholdingOnSales: Number(wht._sum.withholdingAmount || 0),
    });
  } catch (err) {
    next(err);
  }
}

// Credit sales ledger with paid / outstanding per order
async function credits(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const where = { paymentType: 'CREDIT' };
    if (req.query.q) where.dspNumber = { contains: req.query.q, mode: 'insensitive' };
    if (req.query.locationId) where.locationId = Number(req.query.locationId);

    const orderBy = req.query.sortBy ? parseSort(req.query, CREDIT_SORT_FIELDS, 'createdAt') : { id: 'desc' };
    const [total, orders] = await Promise.all([
      prisma.dispenseOrder.count({ where }),
      prisma.dispenseOrder.findMany({
        where,
        include: {
          location: { select: { name: true } },
          dispensedBy: { select: { fullName: true } },
          payments: { select: { amount: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    const rows = orders
      .map((o) => {
        const paid = o.payments.reduce((s, p) => s + Number(p.amount), 0);
        return {
          id: o.id,
          dspNumber: o.dspNumber,
          location: o.location.name,
          dispensedBy: o.dispensedBy.fullName,
          createdAt: o.createdAt,
          total: Number(o.total),
          paid: Math.round(paid * 100) / 100,
          outstanding: Math.round((Number(o.total) - paid) * 100) / 100,
        };
      })
      .filter((r) => (req.query.settled === 'true' ? true : r.outstanding > 0));

    res.json({ credits: rows, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

async function recordPayment(req, res, next) {
  try {
    const { dispenseOrderId, amount, method = 'CASH', reference, notes } = req.body || {};
    const amt = Number(amount);
    if (!dispenseOrderId) throw new ApiError(400, 'dispenseOrderId is required');
    if (!Number.isFinite(amt) || amt <= 0) throw new ApiError(400, 'Amount must be greater than zero');
    if (!PAYMENT_METHODS.includes(method)) throw new ApiError(400, `method must be one of: ${PAYMENT_METHODS.join(', ')}`);

    const order = await prisma.dispenseOrder.findUnique({
      where: { id: Number(dispenseOrderId) },
      include: { payments: { select: { amount: true } } },
    });
    if (!order) throw new ApiError(404, 'Dispense order not found');
    if (order.paymentType !== 'CREDIT') throw new ApiError(400, 'Payments can only be recorded against credit sales');

    const paid = order.payments.reduce((s, p) => s + Number(p.amount), 0);
    const outstanding = Math.round((Number(order.total) - paid) * 100) / 100;
    if (amt > outstanding) {
      throw new ApiError(400, `Payment exceeds the outstanding balance (${outstanding.toFixed(2)})`);
    }

    const payment = await prisma.payment.create({
      data: {
        dispenseOrderId: order.id,
        amount: amt,
        method,
        reference: reference ? String(reference).trim() : null,
        notes: notes ? String(notes).trim() : null,
        receivedById: req.user.id,
      },
      include: {
        dispenseOrder: { select: { dspNumber: true } },
        receivedBy: { select: { fullName: true } },
      },
    });

    res.status(201).json({ payment, outstandingAfter: Math.round((outstanding - amt) * 100) / 100 });
  } catch (err) {
    next(err);
  }
}

async function listPayments(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const where = {};
    if (req.query.q) {
      where.OR = [
        { reference: { contains: req.query.q, mode: 'insensitive' } },
        { dispenseOrder: { dspNumber: { contains: req.query.q, mode: 'insensitive' } } },
      ];
    }
    const orderBy = req.query.sortBy ? parseSort(req.query, PAYMENT_SORT_FIELDS, 'createdAt') : { id: 'desc' };
    const [total, payments] = await Promise.all([
      prisma.payment.count({ where }),
      prisma.payment.findMany({
        where,
        include: {
          dispenseOrder: { select: { dspNumber: true, total: true } },
          receivedBy: { select: { fullName: true } },
        },
        orderBy,
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ payments, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

module.exports = { summary, credits, recordPayment, listPayments };
