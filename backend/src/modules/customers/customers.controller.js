const path = require('path');
const fs = require('fs');
const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');
const { parseSort } = require('../../utils/sort');

const UPLOAD_DIR = path.join(__dirname, '..', '..', '..', 'uploads', 'customer-licenses');

const SORT_FIELDS = { name: 'name', phone: 'phone', createdAt: 'createdAt' };
const RATINGS = ['UNRATED', 'GOOD', 'FAIR', 'POOR'];
const CLASSIFICATIONS = ['PHARMACY', 'HOSPITAL', 'CLINIC', 'WHOLESALE', 'NGO', 'PRIMARY_HEALTHCARE', 'GOVERNMENT'];
const PAYMENT_TERMS = ['CASH', 'NET_15', 'NET_30', 'NET_60', 'DUE_ON_RECEIPT'];

// Auto-detected behavioral tags — computed at read time from order history,
// never stored, so they can't drift out of sync with actual behavior. Kept
// as simple, easy-to-explain absolute thresholds rather than percentiles,
// since percentile-based rules silently shift meaning as the customer base
// grows.
const HIGH_VOLUME_ORDER_THRESHOLD = 10;
const NEW_BUYER_DAYS = 30;

// Prisma Decimal fields deserialize to Decimal objects, not plain numbers —
// normalize before comparing so a same-value update (e.g. creditLimit: 50000
// vs a stored Decimal("50000")) isn't logged as a spurious change.
function normalizeForDiff(v) {
  if (v === undefined) return null;
  if (v !== null && typeof v === 'object' && typeof v.toNumber === 'function') return v.toNumber();
  return v;
}

function sameValue(a, b) {
  const na = normalizeForDiff(a);
  const nb = normalizeForDiff(b);
  if (typeof na === 'object' || typeof nb === 'object') return JSON.stringify(na) === JSON.stringify(nb);
  return na === nb;
}

// Computes only the fields that actually changed, for a compact audit-log
// snapshot — not the full before/after row.
function diffForLog(before, data) {
  const changes = {};
  for (const [key, newVal] of Object.entries(data)) {
    const oldVal = before ? before[key] : null;
    if (!before || !sameValue(oldVal, newVal)) {
      changes[key] = { from: normalizeForDiff(oldVal), to: normalizeForDiff(newVal) };
    }
  }
  return changes;
}

async function list(req, res, next) {
  try {
    const q = String(req.query.q || '').trim();
    const { active, classification } = req.query;
    const where = {};
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { contactPerson: { contains: q, mode: 'insensitive' } },
        { phone: { contains: q, mode: 'insensitive' } },
        { email: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (active === 'true') where.isActive = true;
    if (active === 'false') where.isActive = false;
    if (classification) where.classification = String(classification);
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

// Company name is the only field truly required at the API level — Sales'
// quick-create-during-a-sale flow only ever sends a name, and shouldn't be
// forced through full B2B onboarding mid-checkout. The rest (contact person,
// phone, city, region) are marked required on the full Customer management
// form instead — enforced there, not here — so quick-create keeps working.
function validate(body, partial = false) {
  const {
    name, contactPerson, phone, altPhone, email, classification, tin,
    city, region, country, addressDetails, paymentTerms, withholdingTaxApplicable,
    creditLimit, notes, tags,
    bankAccounts, creditRating, licenseNumber,
  } = body || {};
  if (!partial && (!name || !String(name).trim())) throw new ApiError(400, 'Company name is required');
  const data = {};
  if (name !== undefined) {
    if (!String(name).trim()) throw new ApiError(400, 'Company name cannot be empty');
    data.name = String(name).trim();
  }
  if (contactPerson !== undefined) data.contactPerson = contactPerson ? String(contactPerson).trim() : null;
  if (phone !== undefined) data.phone = phone ? String(phone).trim() : null;
  if (altPhone !== undefined) data.altPhone = altPhone ? String(altPhone).trim() : null;
  if (email !== undefined) data.email = email ? String(email).trim() : null;
  if (classification !== undefined) {
    if (classification && !CLASSIFICATIONS.includes(classification)) {
      throw new ApiError(400, `classification must be one of: ${CLASSIFICATIONS.join(', ')}`);
    }
    data.classification = classification || null;
  }
  if (tin !== undefined) data.tin = tin ? String(tin).trim() : null;
  if (city !== undefined) data.city = city ? String(city).trim() : null;
  if (region !== undefined) data.region = region ? String(region).trim() : null;
  if (country !== undefined) data.country = country ? String(country).trim() : null;
  if (addressDetails !== undefined) data.addressDetails = addressDetails ? String(addressDetails).trim() : null;
  if (paymentTerms !== undefined) {
    if (paymentTerms && !PAYMENT_TERMS.includes(paymentTerms)) {
      throw new ApiError(400, `paymentTerms must be one of: ${PAYMENT_TERMS.join(', ')}`);
    }
    data.paymentTerms = paymentTerms || null;
  }
  if (withholdingTaxApplicable !== undefined) data.withholdingTaxApplicable = Boolean(withholdingTaxApplicable);
  if (creditLimit !== undefined) {
    const n = Number(creditLimit);
    if (!Number.isFinite(n) || n < 0) throw new ApiError(400, 'Credit limit must be a non-negative number');
    data.creditLimit = n;
  }
  if (notes !== undefined) data.notes = notes ? String(notes).trim() : null;
  if (tags !== undefined) {
    if (!Array.isArray(tags)) throw new ApiError(400, 'tags must be an array');
    data.tags = tags.map((t) => String(t).trim()).filter(Boolean);
  }
  if (licenseNumber !== undefined) data.licenseNumber = licenseNumber ? String(licenseNumber).trim() : null;
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

async function getOne(req, res, next) {
  try {
    const id = Number(req.params.id);
    const customer = await prisma.customer.findUnique({
      where: { id },
      include: { _count: { select: { dispenseOrders: true } } },
    });
    if (!customer) throw new ApiError(404, 'Customer not found');
    res.json({ customer });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const data = validate(req.body);
    const customer = await prisma.customer.create({ data });
    await prisma.customerAuditLog.create({
      data: { customerId: customer.id, action: 'CREATE', changes: diffForLog(null, data), changedById: req.user?.id || null },
    });
    res.status(201).json({ customer });
  } catch (err) {
    next(err);
  }
}

// Status (active/inactive) changes go through setStatus(), not this generic
// update — they need a mandatory reason and a distinct ACTIVATE/DEACTIVATE
// audit action, not a silent field flip.
async function update(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Customer not found');

    const data = validate(req.body, true);
    const customer = await prisma.customer.update({ where: { id }, data });

    const changes = diffForLog(existing, data);
    if (Object.keys(changes).length > 0) {
      await prisma.customerAuditLog.create({
        data: { customerId: id, action: 'UPDATE', changes, changedById: req.user?.id || null },
      });
    }
    res.json({ customer });
  } catch (err) {
    next(err);
  }
}

// Requires a reason — surfaced in the Status Audit Log on the customer
// detail page ("every activation and deactivation, with who and why").
async function setStatus(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Customer not found');

    const isActive = Boolean(req.body?.isActive);
    const reason = String(req.body?.reason || '').trim();
    if (!reason) throw new ApiError(400, 'A reason is required to change status');
    if (isActive === existing.isActive) {
      throw new ApiError(400, `Customer is already ${isActive ? 'active' : 'inactive'}`);
    }

    const customer = await prisma.customer.update({ where: { id }, data: { isActive } });
    await prisma.customerAuditLog.create({
      data: {
        customerId: id,
        action: isActive ? 'ACTIVATE' : 'DEACTIVATE',
        changes: { isActive: { from: existing.isActive, to: isActive } },
        reason,
        changedById: req.user?.id || null,
      },
    });
    res.json({ customer });
  } catch (err) {
    next(err);
  }
}

// One license document per customer — a re-upload replaces (and deletes) the
// previous file rather than accumulating a list, since this is a single
// "current license on file", not a general attachments feed.
async function uploadLicense(req, res, next) {
  try {
    const id = Number(req.params.id);
    const existing = await prisma.customer.findUnique({ where: { id } });
    if (!existing) throw new ApiError(404, 'Customer not found');
    if (!req.file) throw new ApiError(400, 'Upload a file in the "file" field');

    const licenseDocument = {
      storedName: req.file.filename,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date().toISOString(),
    };

    const previous = existing.licenseDocument;
    const customer = await prisma.customer.update({ where: { id }, data: { licenseDocument } });

    if (previous?.storedName) {
      const oldPath = path.join(UPLOAD_DIR, previous.storedName);
      fs.unlink(oldPath, () => {}); // best-effort cleanup; a stray old file isn't worth failing the request over
    }

    res.status(201).json({ customer });
  } catch (err) {
    next(err);
  }
}

async function downloadLicense(req, res, next) {
  try {
    const id = Number(req.params.id);
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer?.licenseDocument) throw new ApiError(404, 'No license document on file');
    const doc = customer.licenseDocument;
    const filePath = path.join(UPLOAD_DIR, doc.storedName);
    if (!fs.existsSync(filePath)) throw new ApiError(404, 'File is missing on the server');
    res.setHeader('Content-Type', doc.mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${doc.originalName.replace(/"/g, '')}"`);
    fs.createReadStream(filePath).pipe(res);
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

    const daysSinceCreated = Math.floor((Date.now() - new Date(customer.createdAt).getTime()) / 86400000);
    const autoTags = [];
    if (daysSinceCreated <= NEW_BUYER_DAYS) autoTags.push('New Buyer');
    if (orders.length >= HIGH_VOLUME_ORDER_THRESHOLD) autoTags.push('High Volume');
    if (orders.length > 0 && creditOrders.length === 0) autoTags.push('Cash Buyer');

    const lastPayment = await prisma.payment.findFirst({
      where: { dispenseOrder: { customerId: id } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    });

    res.json({
      creditRating: customer.creditRating,
      creditLimit: Number(customer.creditLimit),
      totalOrders: orders.length,
      creditOrderCount: creditOrders.length,
      settledCount,
      outstandingCount: creditOrders.length - settledCount,
      totalCreditAmount: Math.round(totalCreditAmount * 100) / 100,
      totalPaid: Math.round(totalPaid * 100) / 100,
      outstanding,
      lastOrderAt: orders[0]?.createdAt || null,
      lastPaymentAt: lastPayment?.createdAt || null,
      autoTags,
    });
  } catch (err) {
    next(err);
  }
}

// Every dispense order for this customer, with computed status/balance due —
// the "Purchase History" table on the customer detail page.
async function purchaseHistory(req, res, next) {
  try {
    const id = Number(req.params.id);
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new ApiError(404, 'Customer not found');

    const orders = await prisma.dispenseOrder.findMany({
      where: { customerId: id },
      select: {
        id: true, dspNumber: true, createdAt: true, paymentType: true, total: true,
        payments: { select: { amount: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    const rows = orders.map((o) => {
      const total = Number(o.total);
      const paid = o.payments.reduce((s, p) => s + Number(p.amount), 0);
      const balanceDue = o.paymentType === 'CREDIT' ? Math.max(0, Math.round((total - paid) * 100) / 100) : 0;
      let status;
      if (o.paymentType === 'CASH' || balanceDue <= 0) status = 'Paid';
      else if (paid > 0) status = 'Partial';
      else status = 'Unpaid';
      return { id: o.id, dspNumber: o.dspNumber, createdAt: o.createdAt, total, balanceDue, status };
    });

    res.json({ rows });
  } catch (err) {
    next(err);
  }
}

// Every payment recorded against this customer's orders — the "Payment
// History" table on the customer detail page.
async function paymentHistory(req, res, next) {
  try {
    const id = Number(req.params.id);
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new ApiError(404, 'Customer not found');

    const payments = await prisma.payment.findMany({
      where: { dispenseOrder: { customerId: id } },
      select: {
        id: true, amount: true, method: true, reference: true, createdAt: true,
        dispenseOrder: { select: { dspNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      rows: payments.map((p) => ({
        id: p.id,
        createdAt: p.createdAt,
        dspNumber: p.dispenseOrder.dspNumber,
        method: p.method,
        reference: p.reference,
        amount: Number(p.amount),
      })),
    });
  } catch (err) {
    next(err);
  }
}

// Full change-history timeline ("Account History") for the customer detail
// page — every create/update/activate/deactivate with a field-level diff.
async function auditLog(req, res, next) {
  try {
    const id = Number(req.params.id);
    const customer = await prisma.customer.findUnique({ where: { id } });
    if (!customer) throw new ApiError(404, 'Customer not found');

    const logs = await prisma.customerAuditLog.findMany({
      where: { customerId: id },
      include: { changedBy: { select: { fullName: true, role: { select: { name: true } } } } },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      rows: logs.map((l) => ({
        id: l.id,
        action: l.action,
        changes: l.changes,
        reason: l.reason,
        createdAt: l.createdAt,
        changedByName: l.changedBy?.fullName || 'System',
        changedByRole: l.changedBy?.role?.name || null,
      })),
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
    if (existing.licenseDocument?.storedName) {
      fs.unlink(path.join(UPLOAD_DIR, existing.licenseDocument.storedName), () => {});
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  list, getOne, create, update, setStatus, remove,
  creditSummary, purchaseHistory, paymentHistory, auditLog,
  uploadLicense, downloadLicense, UPLOAD_DIR,
};
