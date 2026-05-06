const pool = require('../../db/pool');

function normalizeIdentity(identity) {
  const clean = String(identity || '').trim().toLowerCase();
  const phoneDigits = clean.replace(/\D/g, '');
  return { clean, phoneDigits };
}

function invoiceSelect() {
  return `
    SELECT
      i.*,
      s.code status_code,
      s.name status_name,
      c.id customer_id,
      c.display_name customer_name,
      cc.email customer_email,
      cc.phone customer_phone,
      cl.address_line_1,
      cl.address_line_2,
      cl.city,
      cl.state,
      cl.postal_code,
      wo.title work_order_title,
      COALESCE(SUM(p.amount),0) paid_amount,
      GREATEST(
        0,
        GREATEST(
          COALESCE(i.balance_due, 0),
          COALESCE(i.total_amount, 0) - COALESCE(i.deposit_amount, 0)
        ) - COALESCE(SUM(p.amount),0)
      ) computed_amount_due
  `;
}

function invoiceJoins() {
  return `
    FROM invoices i
    JOIN invoice_statuses s ON s.id = i.invoice_status_id
    JOIN customers c ON c.id = i.customer_id
    LEFT JOIN customer_contacts cc ON cc.customer_id = c.id AND cc.is_primary = true
    LEFT JOIN customer_locations cl ON cl.id = i.customer_location_id
    LEFT JOIN work_orders wo ON wo.id = i.work_order_id
    LEFT JOIN payments p ON p.invoice_id = i.id
  `;
}

function invoiceGroupBy() {
  return `
    GROUP BY i.id, s.code, s.name, c.id, c.display_name, cc.email, cc.phone,
      cl.address_line_1, cl.address_line_2, cl.city, cl.state, cl.postal_code, wo.title
  `;
}

async function getInvoiceByToken(token) {
  const invoiceResult = await pool.query(`
    ${invoiceSelect()}
    ${invoiceJoins()}
    WHERE i.public_payment_token = $1
      AND (i.public_payment_token_expires_at IS NULL OR i.public_payment_token_expires_at > current_timestamp)
    ${invoiceGroupBy()}
  `, [token]);
  const invoice = invoiceResult.rows[0] || null;
  if (!invoice) return null;

  await pool.query(`UPDATE invoices SET public_payment_last_viewed_at=current_timestamp WHERE id=$1`, [invoice.id]);

  const lineItems = await pool.query(`SELECT * FROM invoice_line_items WHERE invoice_id=$1 ORDER BY id`, [invoice.id]);
  return { invoice, lineItems: lineItems.rows, paidAmount: Number(invoice.paid_amount || 0) };
}

async function findInvoiceForLookup({ invoiceNumber, identity }) {
  const cleanInvoiceNumber = String(invoiceNumber || '').trim();
  const { clean, phoneDigits } = normalizeIdentity(identity);

  if (!cleanInvoiceNumber || !clean) return null;

  const r = await pool.query(`
    SELECT i.id, i.public_payment_token
    FROM invoices i
    JOIN customers c ON c.id = i.customer_id
    LEFT JOIN customer_contacts cc ON cc.customer_id = c.id AND cc.is_primary = true
    LEFT JOIN customer_locations cl ON cl.id = i.customer_location_id
    WHERE lower(i.invoice_number) = lower($1)
      AND (
        lower(COALESCE(cc.email,'')) = $2
        OR ($3 <> '' AND regexp_replace(COALESCE(cc.phone,''), '[^0-9]', '', 'g') = $3)
        OR lower(COALESCE(cl.postal_code,'')) = $2
      )
    ORDER BY i.created_at DESC
    LIMIT 1
  `, [cleanInvoiceNumber, clean, phoneDigits]);

  return r.rows[0] || null;
}

async function createLookupToken({ identity, invoiceNumber, token, expiresAt }) {
  const { clean, phoneDigits } = normalizeIdentity(identity);

  // node-postgres prepared statements cannot contain multiple SQL commands.
  // Keep cleanup and insert as separate statements so /pay lookup works reliably.
  await pool.query(`
    DELETE FROM public_payment_lookups
    WHERE expires_at < current_timestamp
  `);

  await pool.query(`
    INSERT INTO public_payment_lookups(token, identity_value, phone_digits, invoice_number, expires_at)
    VALUES($1,$2,$3,$4,$5)
  `, [token, clean, phoneDigits || null, String(invoiceNumber || '').trim() || null, expiresAt]);

  return token;
}

async function getLookupToken(token) {
  const r = await pool.query(`
    SELECT *
    FROM public_payment_lookups
    WHERE token=$1 AND expires_at > current_timestamp
    LIMIT 1
  `, [token]);
  return r.rows[0] || null;
}

async function findUnpaidInvoicesForLookupToken(token) {
  const lookup = await getLookupToken(token);
  if (!lookup) return null;

  const params = [lookup.identity_value, lookup.phone_digits || ''];
  let invoiceFilter = '';
  if (lookup.invoice_number) {
    params.push(lookup.invoice_number);
    invoiceFilter = `AND lower(i.invoice_number) = lower($${params.length})`;
  }

  const r = await pool.query(`
    ${invoiceSelect()}
    ${invoiceJoins()}
    WHERE s.code <> 'paid'
      ${invoiceFilter}
      AND (
        lower(COALESCE(cc.email,'')) = $1
        OR ($2 <> '' AND regexp_replace(COALESCE(cc.phone,''), '[^0-9]', '', 'g') = $2)
      )
    ${invoiceGroupBy()}
    HAVING GREATEST(
      0,
      GREATEST(
        COALESCE(i.balance_due, 0),
        COALESCE(i.total_amount, 0) - COALESCE(i.deposit_amount, 0)
      ) - COALESCE(SUM(p.amount),0)
    ) > 0
    ORDER BY COALESCE(i.due_date, i.created_at) ASC, i.created_at DESC
    LIMIT 25
  `, params);

  return { lookup, invoices: r.rows };
}

async function ensureInvoicePaymentToken(invoiceId, token) {
  const r = await pool.query(`
    UPDATE invoices
    SET public_payment_token = COALESCE(public_payment_token, $2),
        updated_at = current_timestamp
    WHERE id = $1
    RETURNING public_payment_token
  `, [invoiceId, token]);
  return r.rows[0]?.public_payment_token || null;
}

async function getInvoiceIdByToken(token) {
  const r = await pool.query(`SELECT id FROM invoices WHERE public_payment_token=$1`, [token]);
  return r.rows[0]?.id || null;
}

module.exports = {
  getInvoiceByToken,
  findInvoiceForLookup,
  createLookupToken,
  getLookupToken,
  findUnpaidInvoicesForLookupToken,
  ensureInvoicePaymentToken,
  getInvoiceIdByToken
};
