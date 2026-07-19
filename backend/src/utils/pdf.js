const PDFDocument = require('pdfkit');
const path = require('path');
const fs = require('fs');

const SLATE_900 = '#0f172a';
const SLATE_500 = '#64748b';
const SLATE_200 = '#e2e8f0';
const LOGO_PATH = path.join(__dirname, '../assets/logo.jpg');

function money(v) {
  return Number(v).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/**
 * Start a branded report PDF and stream it to the response.
 * Returns the pdfkit document; caller adds content then calls doc.end().
 */
function startReport(res, { filename, title, subtitle, filters, branding = {} }) {
  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  doc.pipe(res);

  const name = branding.pharmacyName || 'FortInventory';
  const initial = (branding.logoInitial || name[0] || 'F').slice(0, 2);
  const tagline = [branding.pharmacyAddress, branding.pharmacyPhone].filter(Boolean).join('  ·  ')
    || 'Pharmacy Inventory Management System';

  // Header: logo + title. Falls back to a monochrome initials block if the
  // logo asset is missing, so a deployment without it doesn't crash.
  const hasLogo = fs.existsSync(LOGO_PATH);
  if (hasLogo) {
    doc.image(LOGO_PATH, 50, 46, { height: 40 });
  } else {
    doc.rect(50, 50, 26, 26).fill(SLATE_900);
    doc.fill('#ffffff').font('Helvetica-Bold').fontSize(14).text(initial, 50, 57, { width: 26, align: 'center' });
  }
  const textX = hasLogo ? 98 : 86;
  doc.fill(SLATE_900).font('Helvetica-Bold').fontSize(18).text(name, textX, 50);
  doc.font('Helvetica').fontSize(9).fillColor(SLATE_500).text(tagline, textX, 71);

  doc.font('Helvetica-Bold').fontSize(14).fillColor(SLATE_900).text(title, 50, 105);
  if (subtitle) doc.font('Helvetica').fontSize(10).fillColor(SLATE_500).text(subtitle, 50, 123);

  const metaY = subtitle ? 140 : 125;
  doc.font('Helvetica').fontSize(9).fillColor(SLATE_500);
  const parts = [];
  if (filters?.from || filters?.to) parts.push(`Period: ${filters.from || 'beginning'} — ${filters.to || 'today'}`);
  if (filters?.location) parts.push(`Location: ${filters.location}`);
  parts.push(`Generated: ${new Date().toLocaleString()}`);
  doc.text(parts.join('    ·    '), 50, metaY);

  doc.moveTo(50, metaY + 16).lineTo(545, metaY + 16).strokeColor(SLATE_200).stroke();
  doc.y = metaY + 28;
  doc.x = 50;
  return doc;
}

// pdfkit's own `ellipsis`/`lineBreak: false` options still wrap text that's
// wider than the given box (tested against pdfkit 0.19.1), which lets a long
// cell's second line bleed down into the row below. Truncate manually
// instead — measuring against the font/size already active on `doc` — so
// what we pass to text() is guaranteed to fit on one line.
function fitText(doc, str, width) {
  const s = String(str);
  // pdfkit's text() wraps at a slightly smaller effective width than
  // widthOfString() reports (observed ~1-2pt gap), so anything measured
  // within a couple points of the box still wraps if passed through as-is.
  // Budget a safety margin to stay clear of that gap.
  const budget = width - 2;
  if (doc.widthOfString(s) <= budget) return s;
  let out = s;
  while (out.length > 1 && doc.widthOfString(`${out}…`) > budget) {
    out = out.slice(0, -1);
  }
  return `${out}…`;
}

/** Simple table: columns = [{label, width, align?}], rows = string[][] */
function table(doc, columns, rows, { zebra = true } = {}) {
  const startX = 50;
  let y = doc.y;

  // Leave a small gap before the next column starts so adjacent cells never
  // visually touch.
  const CELL_PAD = 6;

  const drawHeader = () => {
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(SLATE_500);
    let x = startX;
    for (const col of columns) {
      const w = col.width - CELL_PAD;
      doc.text(fitText(doc, col.label.toUpperCase(), w), x, y, { width: w, align: col.align || 'left' });
      x += col.width;
    }
    y += 16;
    doc.moveTo(startX, y - 4).lineTo(545, y - 4).strokeColor(SLATE_200).stroke();
  };

  drawHeader();
  doc.font('Helvetica').fontSize(9);

  rows.forEach((row, i) => {
    if (y > 760) {
      doc.addPage();
      y = 50;
      drawHeader();
      doc.font('Helvetica').fontSize(9);
    }
    if (zebra && i % 2 === 1) {
      doc.rect(startX - 4, y - 3, 503, 15).fillColor('#f8fafc').fill();
    }
    doc.fillColor(SLATE_900);
    let x = startX;
    row.forEach((cell, ci) => {
      const w = columns[ci].width - CELL_PAD;
      doc.text(fitText(doc, cell, w), x, y, { width: w, align: columns[ci].align || 'left' });
      x += columns[ci].width;
    });
    y += 15;
  });

  doc.y = y + 8;
  doc.x = startX;
}

/** Key/value summary rows with a bold total-style option */
function summaryRows(doc, rows) {
  const startX = 50;
  let y = doc.y;
  for (const r of rows) {
    if (r.divider) {
      doc.moveTo(startX, y + 2).lineTo(360, y + 2).strokeColor(SLATE_200).stroke();
      y += 8;
      continue;
    }
    doc.font(r.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10);
    doc.fillColor(r.bold ? SLATE_900 : SLATE_500).text(r.label, startX, y, { width: 200 });
    doc.fillColor(SLATE_900).text(r.value, 260, y, { width: 100, align: 'right' });
    y += 18;
  }
  doc.y = y + 6;
  doc.x = startX;
}

/** Signature block at the bottom of the current page */
function signatureBlock(doc) {
  const y = Math.max(doc.y + 40, 700);
  doc.font('Helvetica').fontSize(9).fillColor(SLATE_500);
  doc.moveTo(50, y).lineTo(230, y).strokeColor(SLATE_900).stroke();
  doc.text('Prepared by (name & signature)', 50, y + 4);
  doc.moveTo(320, y).lineTo(500, y).strokeColor(SLATE_900).stroke();
  doc.text('Approved by (name & signature)', 320, y + 4);
  doc.text(`Date: ____________________`, 50, y + 30);
}

module.exports = { startReport, table, summaryRows, signatureBlock, money };
