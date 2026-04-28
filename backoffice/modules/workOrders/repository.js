const pool = require('../../db/pool');
async function listWorkOrders(){
  const r=await pool.query(`SELECT wo.id,wo.title,wo.scheduled_start_at,wo.quoted_price,wo.final_price,c.display_name customer,wos.name status,sl.name service_line,wot.name work_order_type,cl.city,cl.state,a.name asset,string_agg(u.display_name, ', ' ORDER BY u.display_name) assigned_to FROM work_orders wo JOIN customers c ON c.id=wo.customer_id JOIN customer_locations cl ON cl.id=wo.customer_location_id JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id JOIN service_lines sl ON sl.id=wo.service_line_id LEFT JOIN work_order_types wot ON wot.id=wo.work_order_type_id LEFT JOIN assets a ON a.id=wo.asset_id LEFT JOIN work_order_assignments woa ON woa.work_order_id=wo.id LEFT JOIN users u ON u.id=woa.user_id GROUP BY wo.id,wo.title,wo.scheduled_start_at,wo.quoted_price,wo.final_price,c.display_name,wos.name,sl.name,wot.name,cl.city,cl.state,a.name ORDER BY COALESCE(wo.scheduled_start_at,wo.created_at) DESC`);
  return r.rows;
}
module.exports={listWorkOrders};
