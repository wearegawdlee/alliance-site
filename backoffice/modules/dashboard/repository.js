const pool = require('../../db/pool');

async function getDashboard(){
  const [newLeads, attentionWorkOrders, today, upcoming, unpaidInvoices, recentActivity, counts, workload, invoiceStatus, revenueTrend, moneyQueue, leadTrend] = await Promise.all([
    pool.query(`SELECT c.id,c.display_name,l.id lead_id,l.created_at,ls.name lead_source,
        COALESCE(l.submitted_phone,cc.phone) phone,
        COALESCE(l.submitted_email,cc.email) email,
        COALESCE(l.submitted_city,cl.city) city,
        COALESCE(l.submitted_state,cl.state) state,
        l.status
      FROM leads l
      JOIN customers c ON c.id=l.customer_id
      LEFT JOIN lead_sources ls ON ls.id=l.lead_source_id
      LEFT JOIN customer_contacts cc ON cc.customer_id=c.id AND cc.is_primary=true
      LEFT JOIN customer_locations cl ON cl.customer_id=c.id AND cl.is_primary=true
      WHERE l.status IN ('new','contacted')
      ORDER BY l.created_at DESC LIMIT 6`),
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
        AND (
          (wos.code='open' AND (wo.scheduled_start_at IS NULL OR wo.scheduled_start_at::date < current_date OR woa.id IS NULL))
          OR (wos.code='completed' AND (inv.id IS NULL OR invs.code <> 'paid'))
        )
      GROUP BY wo.id,wo.title,wo.scheduled_start_at,c.display_name,wos.code,wos.name,sl.name,inv.id,invs.code,invs.name
      ORDER BY CASE
        WHEN wos.code='open' AND wo.scheduled_start_at IS NULL THEN 1
        WHEN COUNT(woa.id)=0 THEN 2
        WHEN wo.scheduled_start_at::date < current_date THEN 3
        WHEN wos.code='completed' THEN 4
        ELSE 5 END,
        COALESCE(wo.scheduled_start_at,wo.created_at) ASC LIMIT 8`),
    pool.query(`SELECT wo.id,wo.title,wo.scheduled_start_at,c.display_name customer,wos.name status,string_agg(DISTINCT u.display_name, ', ' ORDER BY u.display_name) assigned_to
      FROM work_orders wo
      JOIN customers c ON c.id=wo.customer_id
      JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
      LEFT JOIN work_order_assignments woa ON woa.work_order_id=wo.id
      LEFT JOIN users u ON u.id=woa.user_id
      WHERE wo.scheduled_start_at::date = current_date AND wos.code='open'
      GROUP BY wo.id,wo.title,wo.scheduled_start_at,c.display_name,wos.name
      ORDER BY wo.scheduled_start_at ASC LIMIT 6`),
    pool.query(`SELECT wo.id,wo.title,wo.scheduled_start_at,c.display_name customer,wos.name status,string_agg(DISTINCT u.display_name, ', ' ORDER BY u.display_name) assigned_to
      FROM work_orders wo
      JOIN customers c ON c.id=wo.customer_id
      JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
      LEFT JOIN work_order_assignments woa ON woa.work_order_id=wo.id
      LEFT JOIN users u ON u.id=woa.user_id
      WHERE wo.scheduled_start_at::date > current_date AND wo.scheduled_start_at::date <= current_date + interval '14 days' AND wos.code='open'
      GROUP BY wo.id,wo.title,wo.scheduled_start_at,c.display_name,wos.name
      ORDER BY wo.scheduled_start_at ASC LIMIT 6`),
    pool.query(`SELECT i.id,i.invoice_number,i.total_amount,i.due_date,c.display_name customer,s.name status,COALESCE(SUM(p.amount),0) paid_amount,
        GREATEST(0, COALESCE(i.total_amount,0) - COALESCE(SUM(p.amount),0)) remaining_amount
      FROM invoices i
      JOIN customers c ON c.id=i.customer_id
      JOIN invoice_statuses s ON s.id=i.invoice_status_id
      LEFT JOIN payments p ON p.invoice_id=i.id
      WHERE s.code NOT IN ('paid','void')
      GROUP BY i.id,i.invoice_number,i.total_amount,i.due_date,c.display_name,s.name
      HAVING GREATEST(0, COALESCE(i.total_amount,0) - COALESCE(SUM(p.amount),0)) > 0
      ORDER BY i.due_date ASC NULLS LAST, i.created_at DESC LIMIT 6`),
    pool.query(`SELECT * FROM activity_events ORDER BY created_at DESC LIMIT 6`),
    pool.query(`SELECT
      (SELECT count(*) FROM leads WHERE status='new')::int AS new_lead_count,
      (SELECT count(*) FROM leads WHERE status IN ('new','contacted'))::int AS open_lead_count,
      (SELECT count(*) FROM work_orders wo JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id WHERE wos.code='open')::int AS open_work_order_count,
      (SELECT count(*) FROM work_orders wo LEFT JOIN work_order_assignments woa ON woa.work_order_id=wo.id JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id WHERE woa.id IS NULL AND wos.code='open')::int AS unassigned_work_order_count,
      (SELECT count(*) FROM invoices i JOIN invoice_statuses s ON s.id=i.invoice_status_id WHERE s.code NOT IN ('paid','void'))::int AS unpaid_invoice_count,
      (SELECT count(*) FROM invoices i JOIN invoice_statuses s ON s.id=i.invoice_status_id WHERE s.code NOT IN ('paid','void') AND i.due_date IS NOT NULL AND i.due_date < current_date)::int AS overdue_invoice_count,
      (SELECT count(*) FROM payment_attempts WHERE status='failed')::int AS failed_payment_count,
      (SELECT COALESCE(SUM(amount),0) FROM payments WHERE created_at >= date_trunc('month', current_date))::numeric AS revenue_this_month,
      (SELECT count(*) FROM work_orders wo JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id WHERE wo.scheduled_start_at::date = current_date AND wos.code='open')::int AS today_work_count`),
    pool.query(`WITH days AS (
        SELECT generate_series(current_date, current_date + interval '6 days', interval '1 day')::date AS day
      ), jobs AS (
        SELECT wo.scheduled_start_at::date AS day, COUNT(*)::int AS job_count
        FROM work_orders wo
        JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
        WHERE wo.scheduled_start_at::date BETWEEN current_date AND current_date + interval '6 days'
          AND wos.code <> 'cancelled'
        GROUP BY wo.scheduled_start_at::date
      ), closures AS (
        SELECT closure_date::date AS day, string_agg(reason, ', ') AS reason
        FROM business_closures
        WHERE closure_date BETWEEN current_date AND current_date + interval '6 days'
        GROUP BY closure_date
      )
      SELECT d.day, COALESCE(j.job_count,0)::int AS job_count, c.reason AS closure_reason
      FROM days d
      LEFT JOIN jobs j ON j.day=d.day
      LEFT JOIN closures c ON c.day=d.day
      ORDER BY d.day`),
    pool.query(`SELECT s.code, s.name, COUNT(i.id)::int AS count
      FROM invoice_statuses s
      LEFT JOIN invoices i ON i.invoice_status_id=s.id
      GROUP BY s.code,s.name
      HAVING COUNT(i.id) > 0
      ORDER BY COUNT(i.id) DESC`),
    pool.query(`WITH days AS (
        SELECT generate_series(current_date - interval '29 days', current_date, interval '1 day')::date AS day
      ), paid AS (
        SELECT created_at::date AS day, SUM(amount)::numeric AS amount
        FROM payments
        WHERE created_at::date >= current_date - interval '29 days'
        GROUP BY created_at::date
      )
      SELECT d.day, COALESCE(p.amount,0)::numeric AS amount
      FROM days d
      LEFT JOIN paid p ON p.day=d.day
      ORDER BY d.day`),
    pool.query(`WITH invoice_balances AS (
        SELECT i.id, i.total_amount, i.due_date, s.code, COALESCE(paid.amount,0)::numeric AS paid_amount
        FROM invoices i
        JOIN invoice_statuses s ON s.id=i.invoice_status_id
        LEFT JOIN (SELECT invoice_id, SUM(amount)::numeric AS amount FROM payments GROUP BY invoice_id) paid ON paid.invoice_id=i.id
      )
      SELECT
        COALESCE((SELECT SUM(GREATEST(0, total_amount - paid_amount)) FROM invoice_balances WHERE code NOT IN ('paid','void')),0)::numeric AS outstanding_ar,
        COALESCE((SELECT SUM(GREATEST(0, total_amount - paid_amount)) FROM invoice_balances WHERE code NOT IN ('paid','void') AND due_date IS NOT NULL AND due_date < current_date),0)::numeric AS overdue_ar,
        COALESCE((SELECT SUM(amount) FROM payments WHERE created_at >= current_date - interval '7 days'),0)::numeric AS collected_7_days`),
    pool.query(`WITH days AS (
        SELECT generate_series(current_date - interval '13 days', current_date, interval '1 day')::date AS day
      ), lead_counts AS (
        SELECT created_at::date AS day, COUNT(*)::int AS count
        FROM leads
        WHERE created_at::date >= current_date - interval '13 days'
        GROUP BY created_at::date
      )
      SELECT d.day, COALESCE(l.count,0)::int AS count
      FROM days d
      LEFT JOIN lead_counts l ON l.day=d.day
      ORDER BY d.day`)
  ]);

  return {
    newLeads:newLeads.rows,
    attentionWorkOrders:attentionWorkOrders.rows,
    today:today.rows,
    upcoming:upcoming.rows,
    unpaidInvoices:unpaidInvoices.rows,
    recentActivity:recentActivity.rows,
    counts:counts.rows[0],
    charts:{
      workload:workload.rows,
      invoiceStatus:invoiceStatus.rows,
      revenueTrend:revenueTrend.rows,
      leadTrend:leadTrend.rows
    },
    money: moneyQueue.rows[0] || {}
  };
}

module.exports={getDashboard};
