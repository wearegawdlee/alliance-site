const pool=require('../../db/pool');
async function listInvoices(){
  const r=await pool.query(`SELECT i.*,c.display_name customer,s.name status,cl.city,cl.state FROM invoices i JOIN customers c ON c.id=i.customer_id JOIN invoice_statuses s ON s.id=i.invoice_status_id LEFT JOIN customer_locations cl ON cl.id=i.customer_location_id ORDER BY i.created_at DESC`);
  return r.rows;
}
module.exports={listInvoices};
