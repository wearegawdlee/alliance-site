const pool = require('../../db/pool');

async function getDashboard(){
  const [newLeads, uncontacted, attentionWorkOrders, today, upcoming, unpaidInvoices, recentActivity, counts] = await Promise.all([
    pool.query(`SELECT c.id,c.display_name,c.created_at,ls.name lead_source,cc.phone,cc.email,cl.city,cl.state
      FROM customers c
      JOIN customer_statuses cs ON cs.id=c.customer_status_id
      LEFT JOIN lead_sources ls ON ls.id=c.lead_source_id
      LEFT JOIN customer_contacts cc ON cc.customer_id=c.id AND cc.is_primary=true
      LEFT JOIN customer_locations cl ON cl.customer_id=c.id AND cl.is_primary=true
      WHERE cs.code='prospect'
      ORDER BY c.created_at DESC LIMIT 8`),
    pool.query(`SELECT c.id,c.display_name,c.created_at,cc.phone,cc.email
      FROM customers c
      JOIN customer_statuses cs ON cs.id=c.customer_status_id
      LEFT JOIN customer_contacts cc ON cc.customer_id=c.id AND cc.is_primary=true
      WHERE cs.code='prospect'
        AND NOT EXISTS (SELECT 1 FROM customer_status_history h WHERE h.customer_id=c.id AND h.reason ILIKE '%contact%')
      ORDER BY c.created_at DESC LIMIT 8`),
    pool.query(`SELECT wo.id,wo.title,wo.scheduled_start_at,c.display_name customer,wos.code status_code,wos.name status,sl.name service_line,
        string_agg(DISTINCT u.display_name, ', ' ORDER BY u.display_name) assigned_to,
        COUNT(woa.id)::int assignment_count,
        inv.id invoice_id,
        invs.code invoice_status_code,
        invs.name invoice_status
      FROM work_orders wo
      JOIN customers c ON c.id=wo.customer_id
      JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
      JOIN service_lines sl ON sl.id=wo.service_line_id
      LEFT JOIN work_order_assignments woa ON woa.work_order_id=wo.id
      LEFT JOIN users u ON u.id=woa.user_id
      LEFT JOIN invoices inv ON inv.work_order_id=wo.id
      LEFT JOIN invoice_statuses invs ON invs.id=inv.invoice_status_id
      WHERE wos.code <> 'cancelled'
        AND (wos.code='open' OR (wos.code='completed' AND (inv.id IS NULL OR invs.code <> 'paid')))
      GROUP BY wo.id,wo.title,wo.scheduled_start_at,c.display_name,wos.code,wos.name,sl.name,inv.id,invs.code,invs.name
      ORDER BY CASE WHEN wos.code='open' AND wo.scheduled_start_at IS NULL THEN 1 WHEN COUNT(woa.id)=0 THEN 2 WHEN wos.code='completed' THEN 3 ELSE 4 END, COALESCE(wo.scheduled_start_at,wo.created_at) ASC LIMIT 12`),
    pool.query(`SELECT wo.id,wo.title,wo.scheduled_start_at,c.display_name customer,wos.name status,string_agg(DISTINCT u.display_name, ', ' ORDER BY u.display_name) assigned_to
      FROM work_orders wo
      JOIN customers c ON c.id=wo.customer_id
      JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
      LEFT JOIN work_order_assignments woa ON woa.work_order_id=wo.id
      LEFT JOIN users u ON u.id=woa.user_id
      WHERE wo.scheduled_start_at::date = current_date AND wos.code='open'
      GROUP BY wo.id,wo.title,wo.scheduled_start_at,c.display_name,wos.name
      ORDER BY wo.scheduled_start_at ASC`),
    pool.query(`SELECT wo.id,wo.title,wo.scheduled_start_at,c.display_name customer,wos.name status,string_agg(DISTINCT u.display_name, ', ' ORDER BY u.display_name) assigned_to
      FROM work_orders wo
      JOIN customers c ON c.id=wo.customer_id
      JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
      LEFT JOIN work_order_assignments woa ON woa.work_order_id=wo.id
      LEFT JOIN users u ON u.id=woa.user_id
      WHERE wo.scheduled_start_at::date > current_date AND wos.code='open'
      GROUP BY wo.id,wo.title,wo.scheduled_start_at,c.display_name,wos.name
      ORDER BY wo.scheduled_start_at ASC LIMIT 8`),
    pool.query(`SELECT i.id,i.invoice_number,i.total_amount,i.due_date,c.display_name customer,s.name status,COALESCE(SUM(p.amount),0) paid_amount
      FROM invoices i
      JOIN customers c ON c.id=i.customer_id
      JOIN invoice_statuses s ON s.id=i.invoice_status_id
      LEFT JOIN payments p ON p.invoice_id=i.id
      WHERE s.code NOT IN ('paid','void')
      GROUP BY i.id,i.invoice_number,i.total_amount,i.due_date,c.display_name,s.name
      ORDER BY i.due_date ASC NULLS LAST, i.created_at DESC LIMIT 8`),
    pool.query(`SELECT * FROM activity_events ORDER BY created_at DESC LIMIT 10`),
    pool.query(`SELECT
      (SELECT count(*) FROM customers c JOIN customer_statuses cs ON cs.id=c.customer_status_id WHERE cs.code='prospect')::int AS prospect_count,
      (SELECT count(*) FROM work_orders wo JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id WHERE wos.code='open')::int AS open_work_order_count,
      (SELECT count(*) FROM work_orders wo LEFT JOIN work_order_assignments woa ON woa.work_order_id=wo.id JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id WHERE woa.id IS NULL AND wos.code='open')::int AS unassigned_work_order_count,
      (SELECT count(*) FROM invoices i JOIN invoice_statuses s ON s.id=i.invoice_status_id WHERE s.code NOT IN ('paid','void'))::int AS unpaid_invoice_count`)
  ]);
  return {newLeads:newLeads.rows, uncontacted:uncontacted.rows, attentionWorkOrders:attentionWorkOrders.rows, today:today.rows, upcoming:upcoming.rows, unpaidInvoices:unpaidInvoices.rows, recentActivity:recentActivity.rows, counts:counts.rows[0]};
}
module.exports={getDashboard};
