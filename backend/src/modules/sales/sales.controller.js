const path = require('path');
const fs = require('fs');
const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');
const { applyMovement } = require('../../utils/stock.service');
const { computeWithholding } = require('../procurement/orders.controller');

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads');

const orderInclude = {
  location: { select: { id: true, name: true } },
  dispensedBy: { select: { fullName: true } },
  items: {
    include: {
      product: { select: { code: true, genericName: true, brandName: true, dispenseUnit: true } },
      batch: { select: { batchNo: true, expiryDate: true } },
    },
  },
  attachments: {
    select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true },
  },
};

async function list(req, res, next) {
  try {
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(100, Math.max(1, Number(req.query.pageSize) || 20));
    const where = {};
    if (req.query.q) {
      where.OR = [
        { dspNumber: { contains: req.query.q, mode: 'insensitive' } },
        { items: { some: { product: { genericName: { contains: req.query.q, mode: 'insensitive' } } } } },
      ];
    }
    if (req.query.locationId) where.locationId = Number(req.query.locationId);
    if (req.query.paymentType) where.paymentType = String(req.query.paymentType);

    const [total, orders] = await Promise.all([
      prisma.dispenseOrder.count({ where }),
      prisma.dispenseOrder.findMany({
        where,
        include: orderInclude,
        orderBy: { id: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    res.json({ orders, total, page, pageSize });
  } catch (err) {
    next(err);
  }
}

async function getOne(req, res, next) {
  try {
    const order = await prisma.dispenseOrder.findUnique({
      where: { id: Number(req.params.id) },
      include: orderInclude,
    });
    if (!order) throw new ApiError(404, 'Dispense order not found');
    res.json({ order });
  } catch (err) {
    next(err);
  }
}

// Confirm a dispense order (after the user reviewed the editable summary in the UI).
// Validates batch stock and writes stock-out movements atomically.
async function create(req, res, next) {
  try {
    const { locationId, paymentType = 'CASH', withholdingType = 'NONE', withholdingRate = 0, notes, items } = req.body || {};
    if (!locationId) throw new ApiError(400, 'locationId is required');
    if (!['CASH', 'CREDIT'].includes(paymentType)) throw new ApiError(400, 'paymentType must be CASH or CREDIT');
    if (!Array.isArray(items) || items.length === 0) throw new ApiError(400, 'At least one item is required');

    const location = await prisma.location.findUnique({ where: { id: Number(locationId) } });
    if (!location) throw new ApiError(404, 'Location not found');

    const parsed = [];
    for (const [i, it] of items.entries()) {
      const batchId = Number(it.batchId);
      const quantity = Number(it.quantity);
      const unitPrice = Number(it.unitPrice);
      if (!Number.isInteger(batchId) || batchId <= 0) throw new ApiError(400, `Item ${i + 1}: a valid batchId is required`);
      if (!Number.isInteger(quantity) || quantity <= 0) throw new ApiError(400, `Item ${i + 1}: quantity must be a positive whole number`);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) throw new ApiError(400, `Item ${i + 1}: unit price must be zero or more`);

      const batch = await prisma.batch.findUnique({
        where: { id: batchId },
        include: { product: { select: { id: true, unitPrice: true, genericName: true } } },
      });
      if (!batch) throw new ApiError(400, `Item ${i + 1}: batch not found`);
      parsed.push({
        batchId,
        productId: batch.product.id,
        productName: batch.product.genericName,
        listPrice: Number(batch.product.unitPrice),
        quantity,
        unitPrice,
      });
    }

    const subtotal = Math.round(parsed.reduce((s, l) => s + l.quantity * l.unitPrice, 0) * 100) / 100;
    const wht = computeWithholding(subtotal, withholdingType, withholdingRate);

    const order = await prisma.$transaction(async (tx) => {
      const last = await tx.dispenseOrder.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
      const dspNumber = `DSP-${String((last?.id || 0) + 1).padStart(5, '0')}`;

      const created = await tx.dispenseOrder.create({
        data: {
          dspNumber,
          locationId: Number(locationId),
          paymentType,
          subtotal,
          withholdingType,
          withholdingRate: wht.rate,
          withholdingAmount: wht.amount,
          total: wht.netPayable,
          notes: notes ? String(notes).trim() : null,
          dispensedById: req.user.id,
          items: {
            create: parsed.map((l) => ({
              productId: l.productId,
              batchId: l.batchId,
              quantity: l.quantity,
              listPrice: l.listPrice,
              unitPrice: l.unitPrice,
            })),
          },
        },
      });

      for (const l of parsed) {
        await applyMovement(tx, {
          productId: l.productId,
          batchId: l.batchId,
          locationId: Number(locationId),
          type: 'DISPENSE',
          direction: 'OUT',
          quantity: l.quantity,
          remark: dspNumber,
          performedById: req.user.id,
        });
      }

      return tx.dispenseOrder.findUnique({ where: { id: created.id }, include: orderInclude });
    });

    res.status(201).json({ order });
  } catch (err) {
    next(err);
  }
}

async function addAttachment(req, res, next) {
  try {
    const id = Number(req.params.id);
    const order = await prisma.dispenseOrder.findUnique({ where: { id } });
    if (!order) throw new ApiError(404, 'Dispense order not found');
    if (!req.file) throw new ApiError(400, 'Upload a file in the "file" field');

    const attachment = await prisma.attachment.create({
      data: {
        dispenseOrderId: id,
        storedName: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        size: req.file.size,
      },
      select: { id: true, originalName: true, mimeType: true, size: true, createdAt: true },
    });
    res.status(201).json({ attachment });
  } catch (err) {
    next(err);
  }
}

async function downloadAttachment(req, res, next) {
  try {
    const attachment = await prisma.attachment.findUnique({ where: { id: Number(req.params.attId) } });
    if (!attachment || attachment.dispenseOrderId !== Number(req.params.id)) {
      throw new ApiError(404, 'Attachment not found');
    }
    const filePath = path.join(UPLOAD_DIR, attachment.storedName);
    if (!fs.existsSync(filePath)) throw new ApiError(404, 'File is missing on the server');
    res.setHeader('Content-Type', attachment.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${attachment.originalName.replace(/"/g, '')}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
}

module.exports = { list, getOne, create, addAttachment, downloadAttachment, UPLOAD_DIR };
