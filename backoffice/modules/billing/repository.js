const pool=require('../../db/pool');
async function listInvoices(){const r=await pool.query(`SELECT i.*,c.display_name customer,s.name status FROM invoices i JOIN customers c ON c.id=i.customer_id JOIN invoice_statuses s ON s.id=i.invoice_status_id ORDER BY i.created_at DESC`);return r.rows;}
module.exports={listInvoices};
