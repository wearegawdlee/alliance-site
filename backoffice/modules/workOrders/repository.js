const pool = require('../../db/pool');
async function listWorkOrders(){const r=await pool.query(`SELECT wo.id,wo.title,wo.scheduled_start_at,wo.quoted_price,wo.final_price,c.display_name customer,wos.name status,sl.name service_line,u.display_name assigned_to FROM work_orders wo JOIN customers c ON c.id=wo.customer_id JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id JOIN service_lines sl ON sl.id=wo.service_line_id LEFT JOIN users u ON u.id=wo.assigned_user_id ORDER BY COALESCE(wo.scheduled_start_at,wo.created_at) DESC`);return r.rows;}
module.exports={listWorkOrders};
