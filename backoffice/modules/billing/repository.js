const pool=require('../../db/pool');
async function listInvoices(){
  const r=await pool.query(`SELECT i.*,c.display_name customer,s.code status_code,s.name status,cl.city,cl.state,COALESCE(SUM(p.amount),0) paid_amount FROM invoices i JOIN customers c ON c.id=i.customer_id JOIN invoice_statuses s ON s.id=i.invoice_status_id LEFT JOIN customer_locations cl ON cl.id=i.customer_location_id LEFT JOIN payments p ON p.invoice_id=i.id GROUP BY i.id,c.display_name,s.code,s.name,cl.city,cl.state ORDER BY i.created_at DESC`);
  return r.rows;
}
async function getPaymentMethods(){ const r=await pool.query(`SELECT id,name FROM payment_methods WHERE is_active=true ORDER BY name`); return r.rows; }
async function getInvoiceStatusId(client, code){ const r=await client.query(`SELECT id FROM invoice_statuses WHERE code=$1`,[code]); return r.rows[0]?.id; }
async function getInvoiceSummary(invoiceId){
  const r = await pool.query(`SELECT i.*,c.display_name customer,s.code status_code,s.name status,COALESCE(SUM(p.amount),0) paid_amount FROM invoices i JOIN customers c ON c.id=i.customer_id JOIN invoice_statuses s ON s.id=i.invoice_status_id LEFT JOIN payments p ON p.invoice_id=i.id WHERE i.id=$1 GROUP BY i.id,c.display_name,s.code,s.name`, [invoiceId]);
  return r.rows[0] || null;
}
async function recordPayment(invoiceId,data){
  const client=await pool.connect();
  try{
    await client.query('BEGIN');
    const invoice=(await client.query(`SELECT * FROM invoices WHERE id=$1`,[invoiceId])).rows[0];
    if(!invoice) throw new Error('Invoice not found');
    const amount=Number(data.amount || invoice.total_amount || 0);
    await client.query(`INSERT INTO payments(invoice_id,payment_method_id,amount,reference_number,notes) VALUES($1,$2,$3,$4,$5)`,[invoiceId,data.payment_method_id||null,amount,data.reference_number||null,data.notes||null]);
    const paid=(await client.query(`SELECT COALESCE(SUM(amount),0) paid FROM payments WHERE invoice_id=$1`,[invoiceId])).rows[0].paid;
    const paidStatus=await getInvoiceStatusId(client, Number(paid) >= Number(invoice.total_amount) ? 'paid' : 'partially_paid');
    await client.query(`UPDATE invoices SET invoice_status_id=$1,updated_at=current_timestamp WHERE id=$2`,[paidStatus,invoiceId]);
    if (Number(paid) >= Number(invoice.total_amount) && invoice.work_order_id) {
      const closed = (await client.query(`SELECT id FROM work_order_statuses WHERE code='closed'`)).rows[0]?.id;
      if (closed) {
        await client.query(`UPDATE work_orders SET work_order_status_id=$1,updated_at=current_timestamp WHERE id=$2`,[closed,invoice.work_order_id]);
        await client.query(`INSERT INTO work_order_status_history(work_order_id,to_status_id,reason) VALUES($1,$2,'Invoice paid; ticket closed')`,[invoice.work_order_id,closed]);
      }
    }
    await client.query('COMMIT');
    return getInvoiceSummary(invoiceId);
  }catch(e){await client.query('ROLLBACK');throw e;}finally{client.release();}
}

async function getInvoiceDetail(id){
  const invoiceResult = await pool.query(`
    SELECT
      i.*,
      c.display_name customer_name,
      wo.id work_order_id,
      wo.title work_order_title
    FROM invoices i
    JOIN customers c
      ON c.id=i.customer_id
    LEFT JOIN work_orders wo
      ON wo.id=i.work_order_id
    WHERE i.id=$1
  `,[id]);

  const lineItems = await pool.query(`
    SELECT *
    FROM invoice_line_items
    WHERE invoice_id=$1
    ORDER BY id
  `,[id]);

  const payments = await pool.query(`
    SELECT *
    FROM payments
    WHERE invoice_id=$1
    ORDER BY created_at DESC
  `,[id]);

  return {
    invoice: invoiceResult.rows[0],
    lineItems: lineItems.rows,
    payments: payments.rows
  };
}

module.exports = {
 ...module.exports,
 getInvoiceDetail
};
module.exports={listInvoices,getPaymentMethods,recordPayment,getInvoiceSummary, getInvoiceDetail};
