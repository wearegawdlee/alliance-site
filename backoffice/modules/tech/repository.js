const pool = require('../../db/pool');

async function getTechnicianDashboard(userId) {
  const result = await pool.query(`
    SELECT wo.id, wo.title, wo.description, wo.scheduled_start_at, wo.scheduled_end_at,
           c.display_name customer, cc.phone customer_phone,
           cl.address_line_1, cl.city, cl.state, cl.postal_code,
           wos.code status_code, wos.name status, sl.name service_line,
           COALESCE(li.item_count,0)::int item_count,
           COALESCE(li.item_total,0)::numeric(10,2) item_total
    FROM work_orders wo
    JOIN work_order_assignments woa ON woa.work_order_id=wo.id AND woa.user_id=$1
    JOIN customers c ON c.id=wo.customer_id
    LEFT JOIN customer_contacts cc ON cc.customer_id=c.id AND cc.is_primary=true
    JOIN customer_locations cl ON cl.id=wo.customer_location_id
    JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
    JOIN service_lines sl ON sl.id=wo.service_line_id
    LEFT JOIN (SELECT work_order_id, COUNT(*)::int item_count, SUM(line_total)::numeric(10,2) item_total FROM work_order_line_items GROUP BY work_order_id) li ON li.work_order_id=wo.id
    WHERE wos.code <> 'cancelled'
    ORDER BY CASE WHEN wo.scheduled_start_at::date=current_date THEN 0 WHEN wo.scheduled_start_at IS NULL THEN 2 WHEN wo.scheduled_start_at > current_timestamp THEN 1 ELSE 3 END, wo.scheduled_start_at ASC NULLS LAST, wo.created_at DESC
  `, [userId]);
  return { jobs: result.rows };
}

async function isAssignedToWorkOrder(workOrderId, userId) {
  const result = await pool.query('SELECT 1 FROM work_order_assignments WHERE work_order_id=$1 AND user_id=$2 LIMIT 1', [workOrderId, userId]);
  return !!result.rows[0];
}

module.exports = { getTechnicianDashboard, isAssignedToWorkOrder };
