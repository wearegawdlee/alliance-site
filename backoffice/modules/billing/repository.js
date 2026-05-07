const pool=require('../../db/pool');
const { payableBase } = require('../payments/amounts');

async function listInvoices(filters = {}){
  const params = [];
  const where = [];
  const status = filters.status || 'unpaid';
  if (status === 'paid') where.push(`s.code = 'paid'`);
  else if (status !== 'all') where.push(`s.code <> 'paid'`);
  const r=await pool.query(`SELECT i.*,c.id customer_id,c.display_name customer,cc.email customer_email,s.code status_code,s.name status,cl.city,cl.state,COALESCE(SUM(p.amount),0) paid_amount FROM invoices i JOIN customers c ON c.id=i.customer_id JOIN invoice_statuses s ON s.id=i.invoice_status_id LEFT JOIN customer_contacts cc ON cc.customer_id=c.id AND cc.is_primary=true LEFT JOIN customer_locations cl ON cl.id=i.customer_location_id LEFT JOIN payments p ON p.invoice_id=i.id ${where.length ? `WHERE ${where.join(' AND ')}` : ''} GROUP BY i.id,c.id,c.display_name,cc.email,s.code,s.name,cl.city,cl.state ORDER BY CASE WHEN s.code='created' THEN 1 WHEN s.code='submitted' THEN 2 WHEN s.code='paid' THEN 3 ELSE 4 END, i.created_at DESC`, params);
  return r.rows;
}
async function getPaymentMethods(){ const r=await pool.query(`SELECT id,name FROM payment_methods WHERE is_active=true ORDER BY name`); return r.rows; }
async function getInvoiceStatusId(client, code){ const r=await client.query(`SELECT id FROM invoice_statuses WHERE code=$1`,[code]); return r.rows[0]?.id; }

async function getInvoiceDetail(id){
  const invoiceResult = await pool.query(`
    SELECT i.*,s.code status_code,s.name status_name,c.id customer_id,c.display_name customer_name,cc.email customer_email,wo.id work_order_id,wo.title work_order_title,wos.code work_order_status_code,wos.name work_order_status,sl.code service_line_code,sl.name service_line_name,tr.county tax_county,tr.city tax_city,tr.postal_code tax_postal_code
    FROM invoices i
    JOIN invoice_statuses s ON s.id=i.invoice_status_id
    JOIN customers c ON c.id=i.customer_id
    LEFT JOIN customer_contacts cc ON cc.customer_id=c.id AND cc.is_primary=true
    LEFT JOIN work_orders wo ON wo.id=i.work_order_id
    LEFT JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
    LEFT JOIN service_lines sl ON sl.id=wo.service_line_id
    LEFT JOIN tax_rates tr ON tr.id=i.tax_rate_id
    WHERE i.id=$1`, [id]);
  const lineItems = await pool.query(`SELECT * FROM invoice_line_items WHERE invoice_id=$1 ORDER BY id`, [id]);
  const payments = await pool.query(`SELECT p.*,pm.name payment_method FROM payments p LEFT JOIN payment_methods pm ON pm.id=p.payment_method_id WHERE p.invoice_id=$1 ORDER BY p.created_at DESC`, [id]);
  return { invoice: invoiceResult.rows[0], lineItems: lineItems.rows, payments: payments.rows };
}

async function getInvoiceSummary(invoiceId){
  const r = await pool.query(`SELECT i.*,c.display_name customer,cc.email customer_email,s.code status_code,s.name status,COALESCE(SUM(p.amount),0) paid_amount FROM invoices i JOIN customers c ON c.id=i.customer_id LEFT JOIN customer_contacts cc ON cc.customer_id=c.id AND cc.is_primary=true JOIN invoice_statuses s ON s.id=i.invoice_status_id LEFT JOIN payments p ON p.invoice_id=i.id WHERE i.id=$1 GROUP BY i.id,c.display_name,cc.email,s.code,s.name`, [invoiceId]);
  return r.rows[0] || null;
}

async function submitInvoice(invoiceId){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const invoice=(await client.query(`SELECT i.*,s.code status_code FROM invoices i JOIN invoice_statuses s ON s.id=i.invoice_status_id WHERE i.id=$1`,[invoiceId])).rows[0];
    if(!invoice) throw new Error('Invoice not found');
    if(invoice.status_code==='paid') throw new Error('Paid invoices cannot be submitted again.');
    const submitted=await getInvoiceStatusId(client,'submitted');
    await client.query(`UPDATE invoices SET invoice_status_id=$1,submitted_at=current_timestamp,updated_at=current_timestamp WHERE id=$2`,[submitted,invoiceId]);
    await client.query('COMMIT');
    return getInvoiceSummary(invoiceId);
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

async function recordPayment(invoiceId,data){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const invoice=(await client.query(`SELECT i.*,s.code status_code FROM invoices i JOIN invoice_statuses s ON s.id=i.invoice_status_id WHERE i.id=$1`,[invoiceId])).rows[0];
    if(!invoice) throw new Error('Invoice not found');
    if(!['submitted','payment_failed','payment_pending'].includes(invoice.status_code)) throw new Error('Invoice must be submitted before payment can be recorded.');
    const balanceDue = payableBase(invoice);
    const priorPaid = Number((await client.query(`SELECT COALESCE(SUM(amount),0) paid FROM payments WHERE invoice_id=$1`,[invoiceId])).rows[0].paid || 0);
    const remaining = Math.max(0, balanceDue - priorPaid);

    const amount =
      data.amount !== undefined && data.amount !== null
        ? Number(data.amount)
        : Number(remaining);

    if (!amount || amount <= 0) {
      throw new Error('Payment amount must be greater than zero.');
    }

    if (amount > remaining) {
      throw new Error('Payment amount cannot exceed remaining balance.');
    }


    await client.query(`INSERT INTO payments(invoice_id,payment_method_id,amount,reference_number,notes) VALUES($1,$2,$3,$4,$5)`,[invoiceId,data.payment_method_id||null,amount,data.reference_number||null,data.notes||null]);
    const paid=(await client.query(`SELECT COALESCE(SUM(amount),0) paid FROM payments WHERE invoice_id=$1`,[invoiceId])).rows[0].paid;
    if(Number(paid) >= balanceDue){
      const paidStatus=await getInvoiceStatusId(client,'paid');
      await client.query(`UPDATE invoices SET invoice_status_id=$1,paid_at=current_timestamp,updated_at=current_timestamp WHERE id=$2`,[paidStatus,invoiceId]);
    }
    await client.query('COMMIT');
    return getInvoiceSummary(invoiceId);
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}
module.exports={listInvoices,getPaymentMethods,getInvoiceDetail,recordPayment,getInvoiceSummary,submitInvoice};
