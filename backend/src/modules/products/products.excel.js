const ExcelJS = require('exceljs');
const prisma = require('../../utils/prisma');
const { ApiError } = require('../../middleware/error');
const { buildWhere, TYPES } = require('./products.controller');

const COLUMNS = [
  { header: 'Type *', key: 'type', width: 14 },
  { header: 'Pharmacotherapeutic Class *', key: 'pharmClass', width: 26 },
  { header: 'Generic Name *', key: 'genericName', width: 24 },
  { header: 'Brand Name', key: 'brandName', width: 20 },
  { header: 'Description', key: 'description', width: 28 },
  { header: 'Strength/Dose', key: 'strength', width: 14 },
  { header: 'Dose Unit', key: 'doseUnit', width: 10 },
  { header: 'Route', key: 'route', width: 12 },
  { header: 'Dose Form', key: 'doseForm', width: 12 },
  { header: 'Order Unit', key: 'orderUnit', width: 10 },
  { header: 'Dispense Unit', key: 'dispenseUnit', width: 12 },
  { header: 'Conversion Factor', key: 'conversionFactor', width: 16 },
  { header: 'Country of Origin', key: 'countryOfOrigin', width: 16 },
  { header: 'Manufacturer', key: 'manufacturer', width: 20 },
  { header: 'Supplier', key: 'supplier', width: 20 },
  { header: 'Unit Price *', key: 'unitPrice', width: 12 },
];

function styleHeader(ws) {
  const row = ws.getRow(1);
  row.font = { bold: true };
  row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEFEFEF' } };
}

async function sendWorkbook(res, wb, filename) {
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  await wb.xlsx.write(res);
  res.end();
}

async function template(req, res, next) {
  try {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Products');
    ws.columns = COLUMNS;
    styleHeader(ws);
    ws.addRow({
      type: 'Medication',
      pharmClass: 'Analgesic',
      genericName: 'Paracetamol',
      brandName: 'Panadol',
      description: 'Pain reliever / fever reducer',
      strength: '500',
      doseUnit: 'mg',
      route: 'Oral',
      doseForm: 'Tablet',
      orderUnit: 'Box',
      dispenseUnit: 'Strip',
      conversionFactor: 10,
      countryOfOrigin: 'Ethiopia',
      manufacturer: 'Example Pharma',
      supplier: 'MedSupply PLC',
      unitPrice: 12.5,
    });
    const notes = wb.addWorksheet('Notes');
    notes.addRows([
      ['How to use this template'],
      ['1. Fields marked with * are required.'],
      [`2. Type must be one of: ${TYPES.join(', ')}.`],
      ['3. Supplier must match an existing supplier name exactly (or leave blank).'],
      ['4. Delete the sample row before uploading.'],
      ['5. Upload the file on the Products page via "Import".'],
    ]);
    notes.getRow(1).font = { bold: true };
    await sendWorkbook(res, wb, 'products-template.xlsx');
  } catch (err) {
    next(err);
  }
}

async function exportProducts(req, res, next) {
  try {
    const where = buildWhere(req.query);
    const ids = String(req.query.ids || '')
      .split(',')
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n) && n > 0);
    if (ids.length) where.id = { in: ids };

    const products = await prisma.product.findMany({
      where,
      include: { supplier: { select: { name: true } } },
      orderBy: { code: 'asc' },
    });

    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Products');
    ws.columns = [{ header: 'Code', key: 'code', width: 10 }, ...COLUMNS];
    styleHeader(ws);
    for (const p of products) {
      ws.addRow({
        code: p.code,
        type: p.type,
        pharmClass: p.pharmClass,
        genericName: p.genericName,
        brandName: p.brandName,
        description: p.description,
        strength: p.strength,
        doseUnit: p.doseUnit,
        route: p.route,
        doseForm: p.doseForm,
        orderUnit: p.orderUnit,
        dispenseUnit: p.dispenseUnit,
        conversionFactor: p.conversionFactor,
        countryOfOrigin: p.countryOfOrigin,
        manufacturer: p.manufacturer,
        supplier: p.supplier?.name || '',
        unitPrice: Number(p.unitPrice),
      });
    }
    await sendWorkbook(res, wb, `products-export-${new Date().toISOString().slice(0, 10)}.xlsx`);
  } catch (err) {
    next(err);
  }
}

function cellText(cell) {
  if (cell == null) return '';
  const v = cell.value;
  if (v == null) return '';
  if (typeof v === 'object') {
    if (v.text) return String(v.text).trim();
    if (v.result != null) return String(v.result).trim();
    return '';
  }
  return String(v).trim();
}

async function importProducts(req, res, next) {
  try {
    if (!req.file) throw new ApiError(400, 'Upload an .xlsx file in the "file" field');

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(req.file.buffer);
    const ws = wb.getWorksheet('Products') || wb.worksheets[0];
    if (!ws) throw new ApiError(400, 'The workbook has no sheets');

    const suppliers = await prisma.supplier.findMany({ select: { id: true, name: true } });
    const supByName = new Map(suppliers.map((s) => [s.name.toLowerCase(), s.id]));

    const results = { created: 0, errors: [] };
    const rows = [];
    ws.eachRow((row, n) => {
      if (n === 1) return; // header
      rows.push({ n, row });
    });

    for (const { n, row } of rows) {
      const get = (i) => cellText(row.getCell(i));
      const record = {
        type: get(1),
        pharmClass: get(2),
        genericName: get(3),
        brandName: get(4) || null,
        description: get(5) || null,
        strength: get(6) || null,
        doseUnit: get(7) || null,
        route: get(8) || null,
        doseForm: get(9) || null,
        orderUnit: get(10) || null,
        dispenseUnit: get(11) || null,
        conversionFactor: get(12) ? Number(get(12)) : 1,
        countryOfOrigin: get(13) || null,
        manufacturer: get(14) || null,
        supplierName: get(15) || null,
        unitPrice: get(16) ? Number(get(16)) : 0,
      };

      if (!record.type && !record.genericName && !record.pharmClass) continue; // blank row

      const problems = [];
      if (!TYPES.includes(record.type)) problems.push(`Type must be one of ${TYPES.join(', ')}`);
      if (!record.pharmClass) problems.push('Pharmacotherapeutic class is required');
      if (!record.genericName) problems.push('Generic name is required');
      if (!Number.isFinite(record.conversionFactor) || record.conversionFactor <= 0) problems.push('Conversion factor must be positive');
      if (!Number.isFinite(record.unitPrice) || record.unitPrice < 0) problems.push('Unit price must be zero or more');

      let supplierId = null;
      if (record.supplierName) {
        supplierId = supByName.get(record.supplierName.toLowerCase()) || null;
        if (!supplierId) problems.push(`Supplier "${record.supplierName}" not found`);
      }

      if (problems.length) {
        results.errors.push({ row: n, message: problems.join('; ') });
        continue;
      }

      const { supplierName, ...data } = record;
      await prisma.$transaction(async (tx) => {
        const last = await tx.product.findFirst({ orderBy: { id: 'desc' }, select: { id: true } });
        const code = `P-${String((last?.id || 0) + 1).padStart(5, '0')}`;
        await tx.product.create({ data: { ...data, supplierId, code } });
      });
      results.created += 1;
    }

    res.json(results);
  } catch (err) {
    next(err);
  }
}

module.exports = { template, exportProducts, importProducts };
