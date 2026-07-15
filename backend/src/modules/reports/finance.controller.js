const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');
const pdf = require('../../utils/pdf');

function parseFilters(query) {
  const from = query.from ? new Date(`${query.from}T00:00:00`) : null;
  const to = query.to ? new Date(`${query.to}T23:59:59.999`) : null;
  if ((from && isNaN(from)) || (to && isNaN(to))) throw new ApiError(400, 'Invalid date range');
  const locationId = query.locationId ? Number(query.locationId) : undefined;
  const createdAt = from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
  return { createdAt, locationId, from: query.from, to: query.to };
}

async function locationName(locationId) {
  if (!locationId) return null;
  const loc = await prisma.location.findUnique({ where: { id: locationId } });
  if (!loc) throw new ApiError(404, 'Location not found');
  return loc.name;
}

// Finance figures: Total Sales (gross), WHT, Net Revenue, COGS, Gross Profit, Payments
async function computeFinance(filters) {
  const whereOrders = {
    ...(filters.createdAt ? { createdAt: filters.createdAt } : {}),
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
  };

  const [orderAgg, byPayment, items, creditPayments, expenses] = await Promise.all([
    prisma.dispenseOrder.aggregate({
      where: whereOrders,
      _sum: { subtotal: true, withholdingAmount: true, total: true },
      _count: true,
    }),
    prisma.dispenseOrder.groupBy({
      by: ['paymentType'],
      where: whereOrders,
      _sum: { total: true },
    }),
    prisma.dispenseItem.findMany({
      where: { dispenseOrder: whereOrders },
      include: {
        batch: { select: { unitCost: true } },
        product: { select: { unitPrice: true } },
      },
    }),
    prisma.payment.aggregate({
      where: {
        ...(filters.createdAt ? { createdAt: filters.createdAt } : {}),
        ...(filters.locationId ? { dispenseOrder: { locationId: filters.locationId } } : {}),
      },
      _sum: { amount: true },
    }),
    prisma.expensePurchase.aggregate({
      where: filters.createdAt ? { purchasedAt: filters.createdAt } : {},
      _sum: { netPayable: true },
    }),
  ]);

  const cogs = items.reduce((s, it) => {
    const cost = it.batch.unitCost != null ? Number(it.batch.unitCost) : Number(it.product.unitPrice);
    return s + it.quantity * cost;
  }, 0);

  const totalSales = Number(orderAgg._sum.subtotal || 0);
  const wht = Number(orderAgg._sum.withholdingAmount || 0);
  const revenue = Number(orderAgg._sum.total || 0);
  const cashSales = Number(byPayment.find((g) => g.paymentType === 'CASH')?._sum.total || 0);
  const paymentsOnCredit = Number(creditPayments._sum.amount || 0);

  return {
    salesCount: orderAgg._count,
    totalSales: Math.round(totalSales * 100) / 100,
    withholding: Math.round(wht * 100) / 100,
    revenue: Math.round(revenue * 100) / 100,
    cogs: Math.round(cogs * 100) / 100,
    grossProfit: Math.round((totalSales - cogs) * 100) / 100,
    paymentsReceived: Math.round((cashSales + paymentsOnCredit) * 100) / 100,
    cashSales: Math.round(cashSales * 100) / 100,
    paymentsOnCredit: Math.round(paymentsOnCredit * 100) / 100,
    otherPurchases: Math.round(Number(expenses._sum.netPayable || 0) * 100) / 100,
  };
}

async function financeJson(req, res, next) {
  try {
    const filters = parseFilters(req.query);
    const location = await locationName(filters.locationId);
    const data = await computeFinance(filters);
    res.json({ ...data, location });
  } catch (err) {
    next(err);
  }
}

async function financePdf(req, res, next) {
  try {
    const filters = parseFilters(req.query);
    const location = await locationName(filters.locationId);
    const data = await computeFinance(filters);

    const doc = pdf.startReport(res, {
      filename: `finance-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: 'Finance Report',
      subtitle: 'Sales, cost of goods sold, gross profit and payments',
      filters: { from: filters.from, to: filters.to, location },
    });

    const neg = (v) => (v > 0 ? `-${pdf.money(v)}` : pdf.money(0));
    pdf.summaryRows(doc, [
      { label: `Total Sales (${data.salesCount} sale(s), gross)`, value: pdf.money(data.totalSales) },
      { label: 'Withholding tax on sales', value: neg(data.withholding) },
      { label: 'Revenue (net of withholding)', value: pdf.money(data.revenue), bold: true },
      { divider: true },
      { label: 'Cost of Goods Sold (COGS)', value: neg(data.cogs) },
      { label: 'Gross Profit', value: pdf.money(data.grossProfit), bold: true },
      { divider: true },
      { label: 'Payments received — cash sales', value: pdf.money(data.cashSales) },
      { label: 'Payments received — against credit', value: pdf.money(data.paymentsOnCredit) },
      { label: 'Total payments received', value: pdf.money(data.paymentsReceived), bold: true },
      { divider: true },
      { label: 'Non-sale purchases (expenses)', value: neg(data.otherPurchases) },
    ]);

    pdf.signatureBlock(doc);
    doc.end();
  } catch (err) {
    next(err);
  }
}

// Sales report: date-wise revenue within the period
async function computeSales(filters) {
  const whereOrders = {
    ...(filters.createdAt ? { createdAt: filters.createdAt } : {}),
    ...(filters.locationId ? { locationId: filters.locationId } : {}),
  };
  const orders = await prisma.dispenseOrder.findMany({
    where: whereOrders,
    select: { createdAt: true, subtotal: true, total: true, paymentType: true },
    orderBy: { createdAt: 'asc' },
  });

  const byDay = new Map();
  for (const o of orders) {
    const day = o.createdAt.toISOString().slice(0, 10);
    const cur = byDay.get(day) || { date: day, count: 0, gross: 0, net: 0, cash: 0, credit: 0 };
    cur.count += 1;
    cur.gross += Number(o.subtotal);
    cur.net += Number(o.total);
    if (o.paymentType === 'CASH') cur.cash += Number(o.total);
    else cur.credit += Number(o.total);
    byDay.set(day, cur);
  }
  const days = [...byDay.values()].map((d) => ({
    ...d,
    gross: Math.round(d.gross * 100) / 100,
    net: Math.round(d.net * 100) / 100,
    cash: Math.round(d.cash * 100) / 100,
    credit: Math.round(d.credit * 100) / 100,
  }));
  const totals = days.reduce(
    (t, d) => ({
      count: t.count + d.count,
      gross: t.gross + d.gross,
      net: t.net + d.net,
      cash: t.cash + d.cash,
      credit: t.credit + d.credit,
    }),
    { count: 0, gross: 0, net: 0, cash: 0, credit: 0 },
  );
  return { days, totals };
}

async function salesJson(req, res, next) {
  try {
    const filters = parseFilters(req.query);
    const location = await locationName(filters.locationId);
    const data = await computeSales(filters);
    res.json({ ...data, location });
  } catch (err) {
    next(err);
  }
}

async function salesPdf(req, res, next) {
  try {
    const filters = parseFilters(req.query);
    const location = await locationName(filters.locationId);
    const { days, totals } = await computeSales(filters);

    const doc = pdf.startReport(res, {
      filename: `sales-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      title: 'Sales Report',
      subtitle: 'Performance by period — date-wise revenue',
      filters: { from: filters.from, to: filters.to, location },
    });

    pdf.table(
      doc,
      [
        { label: 'Date', width: 90 },
        { label: 'Sales', width: 60, align: 'right' },
        { label: 'Gross', width: 90, align: 'right' },
        { label: 'Cash', width: 85, align: 'right' },
        { label: 'Credit', width: 85, align: 'right' },
        { label: 'Net Revenue', width: 93, align: 'right' },
      ],
      days.map((d) => [
        d.date,
        d.count,
        pdf.money(d.gross),
        pdf.money(d.cash),
        pdf.money(d.credit),
        pdf.money(d.net),
      ]),
    );

    pdf.summaryRows(doc, [
      { label: `Total (${totals.count} sale(s))`, value: pdf.money(totals.gross), bold: true },
      { label: 'Cash', value: pdf.money(totals.cash) },
      { label: 'Credit', value: pdf.money(totals.credit) },
      { label: 'Net revenue', value: pdf.money(totals.net), bold: true },
    ]);

    pdf.signatureBlock(doc);
    doc.end();
  } catch (err) {
    next(err);
  }
}

module.exports = { financeJson, financePdf, salesJson, salesPdf };
