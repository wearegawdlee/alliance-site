const PDFDocument = require('pdfkit');
const { PassThrough } = require('stream');
const fs = require('fs');
const path = require('path');

const PAGE = {
  margin: 54,
  width: 612,
  height: 792
};

function money(value) {
  const number = Number(value || 0);
  return `$${number.toFixed(2)}`;
}

function numberFmt(value) {
  const number = Number(value || 0);
  if (Number.isInteger(number)) return String(number);
  return number.toFixed(2).replace(/\.00$/, '');
}

function dateFmt(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
}

function clean(value) {
  return String(value || '').trim();
}

function serviceAddress(invoice) {
  return [invoice.address_line_1, invoice.address_line_2, invoice.city, invoice.state, invoice.postal_code]
    .filter(Boolean)
    .join(', ');
}

function serviceLineCode(detail) {
  return detail?.invoice?.service_line_code || '';
}

function isPool(detail) {
  const invoice = detail.invoice || {};
  return serviceLineCode(detail) === 'pools' || /pool/i.test(`${invoice.service_line_name || ''} ${invoice.work_order_title || ''}`);
}

function paidAmount(detail) {
  if (detail.paidAmount !== undefined) return Number(detail.paidAmount || 0);
  return (detail.payments || []).reduce((sum, p) => sum + Number(p.amount || 0), 0);
}

function amountDue(detail) {
  const invoice = detail.invoice || {};
  if (invoice.status_code === 'paid') return 0;
  const storedBalance = Number(invoice.balance_due || 0);
  const computedBase = Math.max(0, Number(invoice.total_amount || 0) - Number(invoice.deposit_amount || 0));
  const base = Math.max(storedBalance, computedBase);
  return Math.max(0, base - paidAmount(detail));
}

function accountNumber(invoice) {
  const customerPart = String(invoice.customer_id || invoice.customerId || '').padStart(5, '0');
  const addressDigits = clean(invoice.address_line_1).replace(/\D/g, '').slice(-4);
  return `${customerPart}${addressDigits ? `-${addressDigits}` : ''}`;
}

function invoiceDate(invoice) {
  return invoice.issue_date || invoice.submitted_at || invoice.created_at;
}

function invoiceLabel(invoice) {
  return invoice.invoice_number || `INV-${String(invoice.id || '').padStart(4, '0')}`;
}

function writeWrapped(doc, text, x, y, options = {}) {
  doc.text(clean(text), x, y, options);
  return doc.y;
}

function stripePaymentLine(publicPaymentUrl) {
  if (!publicPaymentUrl) return 'Payments can be made online using the secure payment link provided with this invoice.';
  return `Payments can be made online at ${publicPaymentUrl}`;
}

const SPRING_WATER_LOGO_PATH = path.join(__dirname, '..', '..', 'assets', 'spring-water-logo.png');

function drawSpringWaterLogo(doc, x, y) {
  doc.save();

  if (fs.existsSync(SPRING_WATER_LOGO_PATH)) {
    // Use the real Spring Water logo artwork rather than trying to recreate
    // it with PDF text/shapes. This keeps emailed invoice PDFs visually
    // consistent with the existing Spring Water invoices.
    doc.image(SPRING_WATER_LOGO_PATH, x, y, { width: 250 });
    doc.restore();
    return;
  }

  // Fallback only: this should not normally render because the logo asset
  // ships with the project under /assets/spring-water-logo.png.
  doc.fillColor('#007dbc');
  doc.font('Helvetica-Bold').fontSize(48).text('SPRING', x, y, { width: 250, align: 'center', characterSpacing: -1 });
  doc.fontSize(48).text('WATER', x, y + 36, { width: 250, align: 'center', characterSpacing: -1 });
  doc.moveTo(x + 6, y + 50).lineTo(x + 244, y + 42).lineWidth(3).strokeColor('#0099c7').stroke();
  doc.font('Helvetica-Bold').fontSize(11).fillColor('#169ec5').text('P O O L   S E R V I C E S', x + 62, y + 82, { width: 180, align: 'center' });
  doc.restore();
}

function tableText(doc, text, x, y, width, height, options = {}) {
  const verticalOffset = options.bold ? 5 : 6;
  doc.font(options.bold ? 'Helvetica-Bold' : 'Helvetica')
    .fontSize(options.size || 10)
    .fillColor(options.color || '#111111')
    .text(clean(text), x + 4, y + verticalOffset, { width: width - 8, height: height - 6, align: options.align || 'left' });
}

function drawPoolInvoice(doc, detail, options = {}) {
  const invoice = detail.invoice || {};
  const lineItems = detail.lineItems || [];
  const left = 56;
  const right = 556;
  const pageWidth = right - left;
  const blue = '#4f96d8';
  const rowBlue = '#c4eaf5';

  drawSpringWaterLogo(doc, 82, 82);

  doc.font('Times-Bold').fontSize(18).fillColor('#111111')
    .text(`INVOICE DATE: ${dateFmt(invoiceDate(invoice))}`, 348, 74, { width: 220 })
    .text(`Account# ${accountNumber(invoice)}`, 348, 96, { width: 220 });

  const serviceTitle = (invoice.work_order_title || invoice.service_line_name || 'Pool Service').toUpperCase();
  const titleY = 214;
  const titleWidth = 330;
  const titleX = (PAGE.width - titleWidth) / 2;
  doc.font('Times-Bold').fontSize(20).fillColor('#111111');
  if (serviceTitle.length > 22) {
    const words = serviceTitle.split(/\s+/);
    const midpoint = Math.ceil(words.length / 2);
    doc.text(words.slice(0, midpoint).join(' '), titleX, titleY, { width: titleWidth, align: 'center' });
    doc.text(words.slice(midpoint).join(' '), titleX, titleY + 24, { width: titleWidth, align: 'center' });
    doc.text(`INVOICE: ${invoiceLabel(invoice).replace(/^INV-/i, '')}`, titleX, titleY + 54, { width: titleWidth, align: 'center' });
  } else {
    doc.text(serviceTitle, titleX, titleY, { width: titleWidth, align: 'center' });
    doc.text(`INVOICE: ${invoiceLabel(invoice).replace(/^INV-/i, '')}`, titleX, titleY + 30, { width: titleWidth, align: 'center' });
  }

  const billY = 316;
  doc.font('Times-Bold').fontSize(16).text(`BILL TO: ${invoice.customer_name || invoice.customer || ''}`, left, billY, { width: 260 });
  doc.font('Times-Roman').fontSize(14);
  let y = billY + 21;
  const addr = serviceAddress(invoice);
  if (addr) y = writeWrapped(doc, addr, left, y, { width: 260, lineGap: 2 });
  if (invoice.customer_email) y = writeWrapped(doc, invoice.customer_email, left, doc.y + 2, { width: 260 });

  doc.font('Times-Bold').fontSize(16).text('Spring Water Pool Services', 348, billY, { width: 260 });
  doc.font('Times-Roman').fontSize(14)
    .text('P.O. Box 234', 348, billY + 21)
    .text('Roswell, GA 30077-0234', 348, billY + 39)
    .text('springwaterpoolservices@gmail.com', 348, billY + 57);

  const tableTop = 428;
  doc.font('Times-Bold').fontSize(17).text(`SERVICE: ${invoice.work_order_title || invoice.service_line_name || 'Monthly Pool Service'}`, left, tableTop - 26, { width: pageWidth });

  const cols = [left, left + 38, left + 288, left + 346, left + 420, right];
  const widths = [38, 250, 58, 74, 80];
  const rowHeight = 21;

  doc.rect(left, tableTop, pageWidth, rowHeight).fillAndStroke(blue, '#111111');
  ['Qty', 'Description', 'Price', 'Discount', 'Amount'].forEach((h, i) => {
    tableText(doc, h, cols[i], tableTop, widths[i], rowHeight, { bold: true, color: '#ffffff', size: 15, align: i === 1 ? 'left' : 'center' });
  });
  cols.forEach((x) => doc.moveTo(x, tableTop).lineTo(x, tableTop + rowHeight).strokeColor('#111111').stroke());
  doc.moveTo(right, tableTop).lineTo(right, tableTop + rowHeight).stroke();

  let rowY = tableTop + rowHeight;
  const rowsToDraw = Math.max(lineItems.length, 1);
  lineItems.forEach((item, index) => {
    const fill = index % 2 === 0 ? rowBlue : '#ffffff';
    doc.rect(left, rowY, pageWidth, rowHeight).fillAndStroke(fill, '#111111');
    tableText(doc, numberFmt(item.quantity), cols[0], rowY, widths[0], rowHeight, { bold: index === 0, size: 12 });
    tableText(doc, item.description, cols[1], rowY, widths[1], rowHeight, { bold: index === 0, size: 12 });
    tableText(doc, Number(item.unit_price || 0).toFixed(2), cols[2], rowY, widths[2], rowHeight, { bold: index === 0, size: 12, align: 'right' });
    tableText(doc, '', cols[3], rowY, widths[3], rowHeight, { size: 12, align: 'right' });
    tableText(doc, Number(item.line_total || 0).toFixed(2), cols[4], rowY, widths[4], rowHeight, { bold: index === 0, size: 12, align: 'right' });
    cols.slice(1).forEach((x) => doc.moveTo(x, rowY).lineTo(x, rowY + rowHeight).strokeColor('#111111').stroke());
    rowY += rowHeight;
  });
  if (!lineItems.length) {
    doc.rect(left, rowY, pageWidth, rowHeight).fillAndStroke('#ffffff', '#111111');
    tableText(doc, 'No line items available.', cols[1], rowY, widths[1] + widths[2] + widths[3], rowHeight, { size: 12 });
    rowY += rowHeight;
  }

  const totalsStart = rowY;
  const thankWidth = cols[3] - left;
  const totalsLabelWidth = widths[3];
  const totalsValueWidth = widths[4];
  const totalRows = [
    ['SUBTOTAL', money(invoice.subtotal || 0)],
    ['TAX', Number(invoice.tax_amount || 0).toFixed(2)],
    ['TOTAL', money(invoice.total_amount || 0)]
  ];
  if (paidAmount(detail) > 0) totalRows.splice(2, 0, ['PAID', money(paidAmount(detail))]);
  if (amountDue(detail) > 0 && paidAmount(detail) > 0) totalRows.push(['BALANCE DUE', money(amountDue(detail))]);

  const totalsHeight = totalRows.length * rowHeight;
  doc.rect(left, totalsStart, thankWidth, totalsHeight).strokeColor('#111111').stroke();
  doc.font('Times-Bold').fontSize(16).fillColor('#111111')
    .text('THANK YOU FOR YOUR BUSINESS!', left + 38, totalsStart + Math.max(14, totalsHeight / 2 - 8), { width: thankWidth - 76, align: 'center' });

  totalRows.forEach((row, idx) => {
    const y = totalsStart + idx * rowHeight;
    doc.rect(cols[3], y, totalsLabelWidth, rowHeight).strokeColor('#111111').stroke();
    doc.rect(cols[4], y, totalsValueWidth, rowHeight).strokeColor('#111111').stroke();
    tableText(doc, row[0], cols[3], y, totalsLabelWidth, rowHeight, { bold: true, size: 13 });
    tableText(doc, row[1], cols[4], y, totalsValueWidth, rowHeight, { bold: row[0] === 'TOTAL' || row[0] === 'BALANCE DUE', size: 13, align: 'right' });
  });

  // Payment instructions and contact text are intentionally kept in the email body,
  // not the PDF. Long payment URLs can wrap unpredictably in generated PDFs and
  // push otherwise one-page invoices onto extra pages.
}

function drawGarageInvoice(doc, detail, options = {}) {
  const invoice = detail.invoice || {};
  const lineItems = detail.lineItems || [];
  const paid = paidAmount(detail);
  const due = amountDue(detail);
  const navy = '#06284a';
  const green = '#6e8445';
  const border = '#d7dee8';
  const left = 50;
  const right = 562;

  doc.rect(0, 0, 612, 120).fill(navy);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text('ALLIANCE', left, 36);
  doc.fontSize(14).text('GARAGE DOORS OF ROSWELL', left, 62);
  doc.font('Helvetica').fontSize(9).text('Opening Doors to Your Peace of Mind', left, 82);
  doc.roundedRect(420, 34, 110, 34, 4).fill(green);
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(10).text('INVOICE', 420, 45, { width: 110, align: 'center' });

  doc.fillColor('#13213a').font('Helvetica-Bold').fontSize(28).text(invoiceLabel(invoice), left, 154);
  doc.fillColor('#58667a').font('Helvetica').fontSize(10).text('Trusted garage door service. Every time.', left, 185);

  doc.fillColor('#13213a').font('Helvetica-Bold').fontSize(11).text('Bill To', left, 226);
  doc.font('Helvetica').fontSize(10).fillColor('#1c2b3f').text(invoice.customer_name || invoice.customer || '', left, 244, { width: 220 });
  if (invoice.customer_email) doc.fillColor('#58667a').text(invoice.customer_email, left, 260, { width: 220 });

  doc.fillColor('#13213a').font('Helvetica-Bold').fontSize(11).text('Service Address', 310, 226);
  doc.font('Helvetica').fontSize(10).fillColor('#1c2b3f').text(serviceAddress(invoice) || '-', 310, 244, { width: 240 });

  doc.fillColor('#13213a').font('Helvetica-Bold').fontSize(11).text('Invoice Date', left, 300);
  doc.font('Helvetica').fontSize(10).fillColor('#1c2b3f').text(dateFmt(invoiceDate(invoice)), left, 318, { width: 140 });
  doc.fillColor('#13213a').font('Helvetica-Bold').fontSize(11).text('Service', 210, 300);
  doc.font('Helvetica').fontSize(10).fillColor('#1c2b3f').text(invoice.work_order_title || invoice.service_line_name || 'Garage Door Service', 210, 318, { width: 190 });
  doc.fillColor('#13213a').font('Helvetica-Bold').fontSize(11).text('Amount Due', 438, 300);
  doc.font('Helvetica-Bold').fontSize(18).fillColor(green).text(money(due), 438, 316, { width: 120, align: 'right' });

  const tableTop = 374;
  const tableLeft = left;
  const tableWidth = right - left;
  const cols = [tableLeft, tableLeft + 274, tableLeft + 324, tableLeft + 414, right];
  const widths = [274, 50, 90, 98];
  const rowHeight = 25;
  doc.roundedRect(tableLeft, tableTop - 18, tableWidth, 32 + Math.max(1, lineItems.length) * rowHeight + 8, 8).strokeColor(border).stroke();
  doc.fillColor(navy).font('Helvetica-Bold').fontSize(12).text('Service Details', tableLeft + 14, tableTop - 7);
  doc.moveTo(tableLeft, tableTop + 16).lineTo(right, tableTop + 16).strokeColor(border).stroke();
  ['Description', 'Qty', 'Unit Price', 'Amount'].forEach((h, i) => {
    doc.fillColor('#58667a').font('Helvetica-Bold').fontSize(8).text(h.toUpperCase(), cols[i] + 8, tableTop + 2, { width: widths[i] - 12, align: i === 0 ? 'left' : 'right' });
  });
  let y = tableTop + 17;
  if (lineItems.length) {
    lineItems.forEach((item) => {
      doc.moveTo(tableLeft, y + rowHeight).lineTo(right, y + rowHeight).strokeColor(border).stroke();
      doc.fillColor('#1c2b3f').font('Helvetica').fontSize(10).text(item.description, cols[0] + 8, y + 8, { width: widths[0] - 12 });
      doc.text(numberFmt(item.quantity), cols[1] + 8, y + 8, { width: widths[1] - 12, align: 'right' });
      doc.text(money(item.unit_price), cols[2] + 8, y + 8, { width: widths[2] - 12, align: 'right' });
      doc.font('Helvetica-Bold').text(money(item.line_total), cols[3] + 8, y + 8, { width: widths[3] - 12, align: 'right' });
      y += rowHeight;
    });
  } else {
    doc.fillColor('#1c2b3f').font('Helvetica').fontSize(10).text('No line items available.', cols[0] + 8, y + 8, { width: tableWidth - 16 });
    y += rowHeight;
  }

  const totalsTop = y + 34;
  const totalsX = 340;
  const totalsW = 172;
  [
    ['Subtotal', money(invoice.subtotal || 0)],
    ['Tax', money(invoice.tax_amount || 0)],
    ['Invoice Total', money(invoice.total_amount || 0)],
    ['Paid', money(paid)],
    ['Balance Due', money(due)]
  ].forEach((row, index) => {
    const rowY = totalsTop + index * 24;
    doc.fillColor(index === 4 ? navy : '#58667a').font(index === 4 ? 'Helvetica-Bold' : 'Helvetica').fontSize(index === 4 ? 12 : 10).text(row[0], totalsX, rowY, { width: 92 });
    doc.fillColor(index === 4 ? green : '#1c2b3f').font('Helvetica-Bold').fontSize(index === 4 ? 12 : 10).text(row[1], totalsX + 92, rowY, { width: totalsW - 92, align: 'right' });
  });

  doc.fillColor('#58667a').font('Helvetica').fontSize(9)
    .text('Thank you for your business.', left, totalsTop + 150, { width: right - left, align: 'center' });
}

function generateInvoicePdf(detail, options = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'LETTER', margin: PAGE.margin, bufferPages: true });
    const stream = new PassThrough();
    const chunks = [];
    stream.on('data', (chunk) => chunks.push(chunk));
    stream.on('end', () => resolve(Buffer.concat(chunks)));
    stream.on('error', reject);
    doc.on('error', reject);
    doc.pipe(stream);

    if (isPool(detail)) drawPoolInvoice(doc, detail, options);
    else drawGarageInvoice(doc, detail, options);

    doc.end();
  });
}

function invoicePdfFilename(detail) {
  const label = invoiceLabel(detail.invoice || {}).replace(/[^a-z0-9_-]+/gi, '_');
  return `${label}.pdf`;
}

module.exports = {
  generateInvoicePdf,
  invoicePdfFilename,
  isPool,
  amountDue,
  paidAmount
};
