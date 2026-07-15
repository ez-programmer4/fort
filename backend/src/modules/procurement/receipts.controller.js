const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');
const { computeWithholding } = require('./orders.controller');

async function listReceipts(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const where = {};
    if (req.query.q) {
      where.OR = [
        { grvNumber: { contains: req.query.q, mode: 'insensitive' } },
        { purchaseOrder: { poNumber: { contains: req.query.q, mode: 'insensitive' } } },
        { supplier: { name: { contains: req.query.q, mode: 'insensitive' } } },
      ];
    }
    const [total, receipts] = await Promise.all([
      prisma.goodsReceipt.count({ where }),
      prisma.goodsReceipt.findMany({
        where,
        include: {
          purchaseOrder: { select: { poNumber: true } },
          supplier: { select: { name: true } },
          location: { select: { name: true } },
          receivedBy: { select: { fullName: true } },
          items: {
            include: {
              product: { select: { code: true, genericName: true, dispenseUnit: true } },
              batch: { select: { batchNo: true, expiryDate: true } },
            },
          },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ receipts, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

async function listExpenses(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const where = {};
    if (req.query.q) {
      where.OR = [
        { description: { contains: req.query.q, mode: 'insensitive' } },
        { category: { contains: req.query.q, mode: 'insensitive' } },
        { supplier: { name: { contains: req.query.q, mode: 'insensitive' } } },
      ];
    }
    const [total, expenses] = await Promise.all([
      prisma.expensePurchase.count({ where }),
      prisma.expensePurchase.findMany({
        where,
        include: {
          supplier: { select: { name: true } },
          createdBy: { select: { fullName: true } },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ expenses, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

async function createExpense(req, res, next) {
  try {
    const { description, category, supplierId, amount, withholdingType = 'NONE', withholdingRate = 0, purchasedAt, notes } = req.body || {};
    if (!description || !String(description).trim()) throw new ApiError(400, 'Description is required');
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) throw new ApiError(400, 'Amount must be greater than zero');
    if (supplierId) {
      const sup = await prisma.supplier.findUnique({ where: { id: Number(supplierId) } });
      if (!sup) throw new ApiError(404, 'Supplier not found');
    }
    const wht = computeWithholding(amt, withholdingType, withholdingRate);

    const expense = await prisma.expensePurchase.create({
      data: {
        description: String(description).trim(),
        category: category ? String(category).trim() : null,
        supplierId: supplierId ? Number(supplierId) : null,
        amount: amt,
        withholdingType,
        withholdingRate: wht.rate,
        withholdingAmount: wht.amount,
        netPayable: wht.netPayable,
        purchasedAt: purchasedAt ? new Date(purchasedAt) : new Date(),
        notes: notes ? String(notes).trim() : null,
        createdById: req.user.id,
      },
      include: { supplier: { select: { name: true } }, createdBy: { select: { fullName: true } } },
    });
    res.status(201).json({ expense });
  } catch (err) {
    next(err);
  }
}

module.exports = { listReceipts, listExpenses, createExpense };
