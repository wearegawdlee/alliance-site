const { payableBase } = require('../payments/amounts');
function clean(value) {
  const trimmed = String(value || '').trim();
  return trimmed || null;
}

function splitRecipients(value) {
  return String(value || '')
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}

function appUrl(path) {
  const base = clean(process.env.APP_BASE_URL || process.env.PUBLIC_BASE_URL || process.env.BASE_URL);
  if (!base) return path;
  return `${base.replace(/\/$/, '')}${path}`;
}

function isEmailConfigured() {
  return !!(process.env.SMTP_HOST && process.env.NOTIFICATION_EMAIL_TO);
}

function isWebhookConfigured() {
  return !!process.env.NOTIFICATION_WEBHOOK_URL;
}

function notificationEnabled() {
  return process.env.NOTIFICATIONS_ENABLED !== 'false' && (isEmailConfigured() || isWebhookConfigured());
}

async function notify(event) {
  if (!notificationEnabled()) {
    console.log(`[notification skipped] ${event.subject}`);
    return;
  }

  const tasks = [];
  if (isEmailConfigured()) tasks.push(sendEmail(event));
  if (isWebhookConfigured()) tasks.push(sendWebhook(event));

  const results = await Promise.allSettled(tasks);
  for (const result of results) {
    if (result.status === 'rejected') {
      console.error('[notification failed]', result.reason);
    }
  }
}

async function sendEmail(event) {
  const nodemailer = require('nodemailer');
  const port = Number(process.env.SMTP_PORT || 587);
  const secure = String(process.env.SMTP_SECURE || '').toLowerCase() === 'true' || port === 465;
  const user = clean(process.env.SMTP_USER);
  const pass = clean(process.env.SMTP_PASS);

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: user && pass ? { user, pass } : undefined
  });

  await transport.sendMail({
    from: process.env.NOTIFICATION_EMAIL_FROM || process.env.EMAIL_FROM || user || 'Alliance Backoffice <no-reply@localhost>',
    to: splitRecipients(event.to || process.env.NOTIFICATION_EMAIL_TO),
    subject: event.subject,
    text: event.text,
    html: event.html || textToHtml(event.text)
  });
}

async function sendWebhook(event) {
  const response = await fetch(process.env.NOTIFICATION_WEBHOOK_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      subject: event.subject,
      text: event.text,
      eventType: event.eventType || null,
      url: event.url || null,
      metadata: event.metadata || {}
    })
  });

  if (!response.ok) {
    throw new Error(`Webhook notification failed: ${response.status} ${response.statusText}`);
  }
}

function textToHtml(text) {
  return `<pre style="font-family: system-ui, -apple-system, Segoe UI, sans-serif; white-space: pre-wrap;">${escapeHtml(text)}</pre>`;
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function fireAndForget(promise) {
  Promise.resolve(promise).catch((error) => console.error('[notification failed]', error));
}

function notifyWebsiteLead({ customerId, lead }) {
  const url = appUrl(`/backoffice/customers/${customerId}`);
  fireAndForget(notify({
    eventType: 'website_lead.received',
    subject: `New website lead: ${lead.name || 'Website Prospect'}`,
    url,
    metadata: { customerId },
    text: [
      'A new website lead was received.',
      '',
      `Name: ${lead.name || 'Unknown'}`,
      `Phone: ${lead.phone || 'Not provided'}`,
      `Email: ${lead.email || 'Not provided'}`,
      `Service: ${lead.service_type || 'Not provided'}`,
      `Preferred Contact: ${lead.preferred_contact_method || 'Not provided'}`,
      `Location: ${[lead.address_line_1, lead.city, lead.state, lead.postal_code].filter(Boolean).join(', ') || 'Not provided'}`,
      '',
      lead.message ? `Message: ${lead.message}` : null,
      '',
      `Open in backoffice: ${url}`
    ].filter((line) => line !== null).join('\n')
  }));
}

function notifyWorkOrderAssigned(workOrder) {
  const url = appUrl(`/backoffice/work-orders/${workOrder.id}`);
  fireAndForget(notify({
    eventType: 'work_order.assigned',
    subject: `Work order assigned: ${workOrder.title}`,
    url,
    metadata: { workOrderId: workOrder.id },
    text: [
      'A work order was assigned.',
      '',
      `Work Order: ${workOrder.title}`,
      `Customer: ${workOrder.customer || 'Unknown'}`,
      `Status: ${workOrder.status || 'Unknown'}`,
      `Assigned To: ${workOrder.assigned_to || 'Unassigned'}`,
      workOrder.scheduled_start_at ? `Scheduled: ${workOrder.scheduled_start_at}` : null,
      '',
      `Open in backoffice: ${url}`
    ].filter(Boolean).join('\n')
  }));
}

function notifyInvoiceGenerated({ invoiceId, workOrder }) {
  const url = appUrl('/backoffice/billing');
  fireAndForget(notify({
    eventType: 'invoice.generated',
    subject: `Invoice generated for ${workOrder?.customer || 'customer'}`,
    url,
    metadata: { invoiceId, workOrderId: workOrder?.id },
    text: [
      'A draft invoice was generated.',
      '',
      workOrder ? `Work Order: ${workOrder.title}` : null,
      workOrder ? `Customer: ${workOrder.customer}` : null,
      '',
      `Open billing: ${url}`
    ].filter(Boolean).join('\n')
  }));
}

function notifyPaymentRecorded(invoice) {
  const url = appUrl('/backoffice/billing');
  fireAndForget(notify({
    eventType: 'payment.recorded',
    subject: `Payment recorded: ${invoice.invoice_number || `Invoice #${invoice.id}`}`,
    url,
    metadata: { invoiceId: invoice.id, workOrderId: invoice.work_order_id },
    text: [
      'A payment was recorded.',
      '',
      `Invoice: ${invoice.invoice_number || invoice.id}`,
      `Customer: ${invoice.customer || 'Unknown'}`,
      `Amount Paid: ${invoice.paid_amount || 'Recorded'}`,
      `Status: ${invoice.status || 'Updated'}`,
      '',
      `Open billing: ${url}`
    ].filter(Boolean).join('\n')
  }));
}

module.exports = {
  notify,
  notifyWebsiteLead,
  notifyWorkOrderAssigned,
  notifyInvoiceGenerated,
  notifyPaymentRecorded
};

function notifyInvoiceSubmitted(invoice) {
  const url = appUrl(`/backoffice/billing/invoices/${invoice.id}`);
  fireAndForget(notify({
    eventType: 'invoice.submitted',
    subject: `Invoice submitted: ${invoice.invoice_number || `Invoice #${invoice.id}`}`,
    url,
    metadata: { invoiceId: invoice.id, workOrderId: invoice.work_order_id },
    text: [
      'An invoice was submitted for payment.',
      '',
      `Invoice: ${invoice.invoice_number || invoice.id}`,
      `Customer: ${invoice.customer || 'Unknown'}`,
      `Total: ${invoice.total_amount || '0.00'}`,
      '',
      invoice.public_payment_url ? `Customer payment link: ${invoice.public_payment_url}` : null,
      '',
      `Open invoice: ${url}`
    ].filter(Boolean).join('\n')
  }));
}


function notifyCustomerInvoiceSubmitted(invoice) {
  if (!invoice.customer_email || !invoice.public_payment_url) {
    console.log(`[invoice email skipped] no customer email or payment link for invoice ${invoice.id}`);
    return;
  }
  fireAndForget(notify({
    eventType: 'customer_invoice.submitted',
    to: invoice.customer_email,
    subject: `Your invoice from Alliance Home Services: ${invoice.invoice_number || `Invoice #${invoice.id}`}`,
    metadata: { invoiceId: invoice.id, workOrderId: invoice.work_order_id },
    text: [
      `Hi ${invoice.customer || 'there'},`,
      '',
      'Your invoice is ready.',
      '',
      `Invoice: ${invoice.invoice_number || invoice.id}`,
      `Amount Due: $${payableBase(invoice).toFixed(2)}`,
      '',
      `Pay securely here: ${invoice.public_payment_url}`,
      '',
      'Thank you,',
      'Alliance Home Services'
    ].filter(Boolean).join('\n')
  }));
}

function notifyReceipt(invoice) {
  if (!invoice.customer_email) {
    console.log(`[receipt skipped] no customer email for invoice ${invoice.id}`);
    return;
  }
  fireAndForget(notify({
    eventType: 'payment.receipt',
    to: invoice.customer_email,
    subject: `Receipt for ${invoice.invoice_number || `Invoice #${invoice.id}`}`,
    metadata: { invoiceId: invoice.id, workOrderId: invoice.work_order_id },
    text: [
      'Thank you. Your payment has been recorded.',
      '',
      `Invoice: ${invoice.invoice_number || invoice.id}`,
      `Amount Paid: ${invoice.paid_amount || invoice.total_amount || 'Recorded'}`,
      `Status: ${invoice.status || 'Paid'}`
    ].filter(Boolean).join('\n')
  }));
}

module.exports.notifyInvoiceSubmitted = notifyInvoiceSubmitted;
module.exports.notifyReceipt = notifyReceipt;
module.exports.notifyCustomerInvoiceSubmitted = notifyCustomerInvoiceSubmitted;
