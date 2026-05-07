const pool = require('../../db/pool');
const { payableBase } = require('./amounts');

async function getStripeProviderId(client = pool) {
  const r = await client.query(`SELECT id FROM payment_providers WHERE code='stripe'`);
  return r.rows[0]?.id;
}

async function getCustomerPaymentOverview(customerId) {
  const customer = (await pool.query(`SELECT c.*, cc.email customer_email FROM customers c LEFT JOIN customer_contacts cc ON cc.customer_id=c.id AND cc.is_primary=true WHERE c.id=$1`, [customerId])).rows[0];
  if (!customer) return null;
  const methods = (await pool.query(`SELECT * FROM customer_payment_methods WHERE customer_id=$1 AND is_active=true ORDER BY is_default DESC, created_at DESC`, [customerId])).rows;
  const autopay = (await pool.query(`SELECT aps.*, cpm.payment_type, cpm.brand, cpm.last4, cpm.bank_name FROM customer_autopay_settings aps LEFT JOIN customer_payment_methods cpm ON cpm.id=aps.payment_method_id WHERE aps.customer_id=$1`, [customerId])).rows[0] || null;
  return { customer, methods, autopay };
}

async function getCustomerProfile(customerId) {
  const r = await pool.query(`SELECT cpp.*, pp.code provider_code FROM customer_payment_profiles cpp JOIN payment_providers pp ON pp.id=cpp.payment_provider_id WHERE cpp.customer_id=$1 AND pp.code='stripe'`, [customerId]);
  return r.rows[0] || null;
}

async function upsertCustomerProfile(customerId, providerCustomerId) {
  const providerId = await getStripeProviderId();
  const r = await pool.query(`INSERT INTO customer_payment_profiles(customer_id,payment_provider_id,provider_customer_id) VALUES($1,$2,$3) ON CONFLICT(customer_id,payment_provider_id) DO UPDATE SET provider_customer_id=EXCLUDED.provider_customer_id, updated_at=current_timestamp RETURNING *`, [customerId, providerId, providerCustomerId]);
  return r.rows[0];
}

async function upsertPaymentMethod(customerId, providerPaymentMethodId, details) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const providerId = await getStripeProviderId(client);
    const isDefault = details.is_default === true;
    if (isDefault) await client.query(`UPDATE customer_payment_methods SET is_default=false WHERE customer_id=$1`, [customerId]);
    const r = await client.query(`
      INSERT INTO customer_payment_methods(customer_id,payment_provider_id,provider_payment_method_id,payment_type,brand,last4,bank_name,expiration_month,expiration_year,is_default,is_active)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,true)
      ON CONFLICT(payment_provider_id, provider_payment_method_id) DO UPDATE SET
        customer_id=EXCLUDED.customer_id,
        payment_type=EXCLUDED.payment_type,
        brand=EXCLUDED.brand,
        last4=EXCLUDED.last4,
        bank_name=EXCLUDED.bank_name,
        expiration_month=EXCLUDED.expiration_month,
        expiration_year=EXCLUDED.expiration_year,
        is_default=CASE WHEN EXCLUDED.is_default THEN true ELSE customer_payment_methods.is_default END,
        is_active=true,
        updated_at=current_timestamp
      RETURNING *`, [customerId, providerId, providerPaymentMethodId, details.payment_type, details.brand || null, details.last4 || null, details.bank_name || null, details.expiration_month || null, details.expiration_year || null, isDefault]);
    await client.query('COMMIT');
    return r.rows[0];
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function setDefaultPaymentMethod(customerId, methodId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const method = (await client.query(`SELECT * FROM customer_payment_methods WHERE id=$1 AND customer_id=$2 AND is_active=true`, [methodId, customerId])).rows[0];
    if (!method) throw new Error('Payment method not found.');
    await client.query(`UPDATE customer_payment_methods SET is_default=false WHERE customer_id=$1`, [customerId]);
    await client.query(`UPDATE customer_payment_methods SET is_default=true, updated_at=current_timestamp WHERE id=$1`, [methodId]);
    await client.query(`INSERT INTO customer_autopay_settings(customer_id,payment_method_id,is_enabled) VALUES($1,$2,false) ON CONFLICT(customer_id) DO UPDATE SET payment_method_id=EXCLUDED.payment_method_id, updated_at=current_timestamp`, [customerId, methodId]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function deactivatePaymentMethod(customerId, methodId) {
  await pool.query(`UPDATE customer_payment_methods SET is_active=false, is_default=false, updated_at=current_timestamp WHERE id=$1 AND customer_id=$2`, [methodId, customerId]);
  await pool.query(`UPDATE customer_autopay_settings SET is_enabled=false, payment_method_id=NULL, updated_at=current_timestamp WHERE customer_id=$1 AND payment_method_id=$2`, [customerId, methodId]);
}

async function updateAutopay(customerId, data) {
  const methodId = data.payment_method_id ? Number(data.payment_method_id) : null;
  const enabled = data.is_enabled === true || data.is_enabled === '1' || data.is_enabled === 'on';
  if (enabled && !methodId) throw new Error('Choose a payment method before enabling autopay.');
  if (methodId) {
    const r = await pool.query(`SELECT id FROM customer_payment_methods WHERE id=$1 AND customer_id=$2 AND is_active=true`, [methodId, customerId]);
    if (!r.rows[0]) throw new Error('Payment method not found.');
  }
  await pool.query(`INSERT INTO customer_autopay_settings(customer_id,is_enabled,payment_method_id,max_charge_amount) VALUES($1,$2,$3,$4) ON CONFLICT(customer_id) DO UPDATE SET is_enabled=EXCLUDED.is_enabled,payment_method_id=EXCLUDED.payment_method_id,max_charge_amount=EXCLUDED.max_charge_amount,updated_at=current_timestamp`, [customerId, enabled, methodId, data.max_charge_amount ? Number(data.max_charge_amount) : null]);
}


async function getInvoicePaidAmount(invoiceId) {
  const r = await pool.query(`SELECT COALESCE(SUM(amount),0) paid FROM payments WHERE invoice_id=$1`, [invoiceId]);
  return Number(r.rows[0]?.paid || 0);
}

async function getInvoiceForOnlinePayment(invoiceId) {
  const r = await pool.query(`SELECT i.*, s.code status_code, c.display_name customer_name, cc.email customer_email FROM invoices i JOIN invoice_statuses s ON s.id=i.invoice_status_id JOIN customers c ON c.id=i.customer_id LEFT JOIN customer_contacts cc ON cc.customer_id=c.id AND cc.is_primary=true WHERE i.id=$1`, [invoiceId]);
  return r.rows[0] || null;
}

async function createPaymentAttempt(data) {
  const providerId = await getStripeProviderId();
  const values = [
    data.invoice_id,
    data.customer_id,
    providerId,
    data.customer_payment_method_id || null,
    data.payment_type,
    data.status,
    data.amount,
    data.provider_payment_intent_id || null,
    data.provider_checkout_session_id || null,
    data.metadata || {}
  ];

  try {
    const r = await pool.query(
      `INSERT INTO payment_attempts(invoice_id,customer_id,payment_provider_id,customer_payment_method_id,payment_type,status,amount,provider_payment_intent_id,provider_checkout_session_id,metadata)
       VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      values
    );
    return r.rows[0];
  } catch (e) {
    // Stripe redirects/webhooks and browser double-clicks can race. The DB unique
    // indexes are the final guardrail; if one wins, return the existing attempt.
    if (e.code === '23505') {
      if (data.provider_checkout_session_id) {
        const existing = await getAttemptByCheckoutSession(data.provider_checkout_session_id);
        if (existing) return existing;
      }
      if (data.provider_payment_intent_id) {
        const existing = await getAttemptByPaymentIntent(data.provider_payment_intent_id);
        if (existing) return existing;
      }
    }
    throw e;
  }
}

async function getAttemptByCheckoutSession(sessionId) {
  const r = await pool.query(`SELECT * FROM payment_attempts WHERE provider_checkout_session_id=$1`, [sessionId]);
  return r.rows[0] || null;
}

async function updateAttemptByCheckoutSession(sessionId, patch) {
  const fields = [];
  const values = [];
  Object.entries(patch).forEach(([key, value]) => { values.push(value); fields.push(`${key}=$${values.length}`); });
  values.push(sessionId);
  const r = await pool.query(`UPDATE payment_attempts SET ${fields.join(', ')}, updated_at=current_timestamp WHERE provider_checkout_session_id=$${values.length} RETURNING *`, values);
  return r.rows[0];
}

async function updateAttemptByPaymentIntent(paymentIntentId, patch) {
  const fields = [];
  const values = [];
  Object.entries(patch).forEach(([key, value]) => { values.push(value); fields.push(`${key}=$${values.length}`); });
  values.push(paymentIntentId);
  const r = await pool.query(`UPDATE payment_attempts SET ${fields.join(', ')}, updated_at=current_timestamp WHERE provider_payment_intent_id=$${values.length} RETURNING *`, values);
  return r.rows[0];
}

async function listInvoiceAttempts(invoiceId) {
  const r = await pool.query(`SELECT pa.*, cpm.brand, cpm.last4, cpm.bank_name FROM payment_attempts pa LEFT JOIN customer_payment_methods cpm ON cpm.id=pa.customer_payment_method_id WHERE pa.invoice_id=$1 ORDER BY pa.created_at DESC`, [invoiceId]);
  return r.rows;
}

async function recordProviderEvent(providerEventId, eventType, payload) {
  const providerId = await getStripeProviderId();
  const r = await pool.query(`INSERT INTO payment_events(payment_provider_id,provider_event_id,event_type,payload) VALUES($1,$2,$3,$4) ON CONFLICT(provider_event_id) DO NOTHING RETURNING *`, [providerId, providerEventId, eventType, payload]);
  return r.rows[0] || null;
}

async function markProviderEventProcessed(providerEventId) {
  await pool.query(`UPDATE payment_events SET processed_at=current_timestamp WHERE provider_event_id=$1`, [providerEventId]);
}

async function getPaymentMethodCodeId(client, code) {
  const r = await client.query(`SELECT id FROM payment_methods WHERE code=$1`, [code]);
  return r.rows[0]?.id || null;
}

async function getInvoiceStatusId(client, code) {
  const r = await client.query(`SELECT id FROM invoice_statuses WHERE code=$1`, [code]);
  return r.rows[0]?.id || null;
}

async function applySucceededPaymentFromAttempt(attemptId, providerReference) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const attempt = (await client.query(`SELECT * FROM payment_attempts WHERE id=$1 FOR UPDATE`, [attemptId])).rows[0];
    if (!attempt) throw new Error('Payment attempt not found.');
    if (attempt.status === 'succeeded') { await client.query('COMMIT'); return attempt; }
    const invoice = (await client.query(`SELECT i.*, s.code status_code FROM invoices i JOIN invoice_statuses s ON s.id=i.invoice_status_id WHERE i.id=$1 FOR UPDATE`, [attempt.invoice_id])).rows[0];
    if (!invoice) throw new Error('Invoice not found.');
    const methodCode = attempt.payment_type === 'ach' ? 'stripe_ach' : 'stripe_card';
    const paymentMethodId = await getPaymentMethodCodeId(client, methodCode);
    const reference = providerReference || attempt.provider_payment_intent_id;

    const existingPayment = reference
      ? (await client.query(`SELECT id FROM payments WHERE invoice_id=$1 AND reference_number=$2 LIMIT 1`, [attempt.invoice_id, reference])).rows[0]
      : null;

    if (!existingPayment) {
      await client.query(
        `INSERT INTO payments(invoice_id,payment_method_id,amount,reference_number,notes) VALUES($1,$2,$3,$4,$5)`,
        [attempt.invoice_id, paymentMethodId, attempt.amount, reference, 'Online payment via Stripe']
      );
    }

    await client.query(`UPDATE payment_attempts SET status='succeeded', updated_at=current_timestamp WHERE id=$1`, [attempt.id]);
    const paid = Number((await client.query(`SELECT COALESCE(SUM(amount),0) paid FROM payments WHERE invoice_id=$1`, [attempt.invoice_id])).rows[0].paid || 0);
    const payable = payableBase(invoice);
    const remaining = Math.max(0, Number((payable - paid).toFixed(2)));

    if (remaining <= 0) {
      const paidStatus = await getInvoiceStatusId(client, 'paid');
      await client.query(
        `UPDATE invoices SET invoice_status_id=$1, balance_due=0, paid_at=COALESCE(paid_at, current_timestamp), updated_at=current_timestamp WHERE id=$2`,
        [paidStatus, attempt.invoice_id]
      );
    } else {
      await client.query(
        `UPDATE invoices SET balance_due=$1, updated_at=current_timestamp WHERE id=$2`,
        [remaining, attempt.invoice_id]
      );
    }

    await client.query('COMMIT');
    return attempt;
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}


async function setInvoicePaymentPending(invoiceId) {
  const pendingStatus = (await pool.query(`SELECT id FROM invoice_statuses WHERE code='payment_pending'`)).rows[0]?.id;
  if (!pendingStatus) return;
  await pool.query(`UPDATE invoices SET invoice_status_id=$1, updated_at=current_timestamp WHERE id=$2 AND invoice_status_id <> (SELECT id FROM invoice_statuses WHERE code='paid')`, [pendingStatus, invoiceId]);
}

async function getAttemptByPaymentIntent(paymentIntentId) {
  const r = await pool.query(`SELECT * FROM payment_attempts WHERE provider_payment_intent_id=$1`, [paymentIntentId]);
  return r.rows[0] || null;
}

async function markAttemptFailed(paymentIntentId, message) {
  const attempt = await updateAttemptByPaymentIntent(paymentIntentId, { status: 'failed', failure_message: message || null });
  if (attempt) {
    const failedStatus = (await pool.query(`SELECT id FROM invoice_statuses WHERE code='payment_failed'`)).rows[0]?.id;
    if (failedStatus) await pool.query(`UPDATE invoices SET invoice_status_id=$1, updated_at=current_timestamp WHERE id=$2 AND invoice_status_id <> (SELECT id FROM invoice_statuses WHERE code='paid')`, [failedStatus, attempt.invoice_id]);
  }
  return attempt;
}

module.exports = {
  getCustomerPaymentOverview, getCustomerProfile, upsertCustomerProfile, upsertPaymentMethod, setDefaultPaymentMethod,
  deactivatePaymentMethod, updateAutopay, getInvoiceForOnlinePayment, createPaymentAttempt, updateAttemptByCheckoutSession,
  updateAttemptByPaymentIntent, listInvoiceAttempts, recordProviderEvent, markProviderEventProcessed,
  applySucceededPaymentFromAttempt, markAttemptFailed, setInvoicePaymentPending, getAttemptByPaymentIntent, getAttemptByCheckoutSession, getInvoicePaidAmount
};
