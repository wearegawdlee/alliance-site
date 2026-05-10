const pool = require('../../db/pool');

function dateOnly(value) {
  const d = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${value}`);
  return d.toISOString().slice(0, 10);
}

function monthBounds(month) {
  const base = month ? new Date(`${month}-01T00:00:00Z`) : new Date();
  if (Number.isNaN(base.getTime())) throw new Error('Invalid month');
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1));
  const end = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth() + 1, 1));
  return { start: dateOnly(start), end: dateOnly(end), month: start.toISOString().slice(0, 7) };
}


function weekBounds(week) {
  const base = week ? new Date(`${week}T00:00:00Z`) : new Date();
  if (Number.isNaN(base.getTime())) throw new Error('Invalid week');
  const start = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate()));
  start.setUTCDate(start.getUTCDate() - start.getUTCDay());
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 7);
  return { start: dateOnly(start), end: dateOnly(end), week: dateOnly(start) };
}

async function getDispatchBoard(week) {
  const bounds = weekBounds(week);
  const [workOrders, closures, technicians, capacities] = await Promise.all([
    pool.query(`
      SELECT wo.id, wo.title, wo.scheduled_start_at::date scheduled_date,
        to_char(wo.scheduled_start_at, 'HH24:MI') scheduled_time,
        c.display_name customer, sl.id service_line_id, sl.name service_line, sl.code service_line_code,
        wos.name status, wos.code status_code,
        u.id assigned_user_id, u.display_name assigned_to
      FROM work_orders wo
      JOIN customers c ON c.id=wo.customer_id
      JOIN service_lines sl ON sl.id=wo.service_line_id
      JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
      LEFT JOIN work_order_assignments woa ON woa.work_order_id=wo.id AND woa.role_on_job='technician'
      LEFT JOIN users u ON u.id=woa.user_id
      WHERE wo.scheduled_start_at::date >= $1::date
        AND wo.scheduled_start_at::date < $2::date
        AND wos.code <> 'cancelled'
      ORDER BY wo.scheduled_start_at ASC, wo.id ASC
    `, [bounds.start, bounds.end]),
    pool.query(`
      SELECT bc.*, sl.name service_line
      FROM business_closures bc
      LEFT JOIN service_lines sl ON sl.id=bc.service_line_id
      WHERE bc.closure_date >= $1::date AND bc.closure_date < $2::date
      ORDER BY bc.closure_date ASC, bc.service_line_id NULLS FIRST
    `, [bounds.start, bounds.end]),
    pool.query(`
      SELECT DISTINCT u.id, u.display_name
      FROM users u
      JOIN user_roles ur ON ur.user_id=u.id
      JOIN roles r ON r.id=ur.role_id
      WHERE u.is_active=true
        AND r.code IN ('technician','garage_technician','pool_technician','screen_technician')
      ORDER BY u.display_name
    `),
    pool.query(`
      SELECT tdc.*, u.display_name user_name, sl.name service_line
      FROM technician_daily_capacities tdc
      JOIN users u ON u.id=tdc.user_id
      LEFT JOIN service_lines sl ON sl.id=tdc.service_line_id
      ORDER BY u.display_name, sl.name NULLS FIRST
    `)
  ]);
  return { ...bounds, workOrders: workOrders.rows, closures: closures.rows, technicians: technicians.rows, capacities: capacities.rows };
}

async function updateWorkOrderSchedule(workOrderId, data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query(`
      SELECT wo.id, wo.scheduled_start_at, wo.service_line_id, wos.code status_code,
        EXISTS (
          SELECT 1 FROM invoices i
          JOIN invoice_statuses invs ON invs.id=i.invoice_status_id
          WHERE i.work_order_id=wo.id AND invs.code='paid'
        ) has_paid_invoice
      FROM work_orders wo
      JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
      WHERE wo.id=$1
      FOR UPDATE
    `, [workOrderId]);
    const row = current.rows[0];
    if (!row) throw new Error('Work order not found.');
    if (row.has_paid_invoice) throw new Error('Paid work orders cannot be rescheduled from the dispatch board.');
    if (row.status_code === 'cancelled') throw new Error('Cancelled work orders cannot be rescheduled.');

    const scheduledDate = String(data.scheduled_date || '').slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(scheduledDate)) throw new Error('Scheduled date is required.');

    const oldDate = row.scheduled_start_at ? dateOnly(row.scheduled_start_at) : null;
    const oldTime = row.scheduled_start_at ? new Date(row.scheduled_start_at).toISOString().slice(11, 16) : '09:00';
    const scheduledAt = `${scheduledDate} ${oldTime}:00`;
    const assignedUserId = data.assigned_user_id === undefined || data.assigned_user_id === null || data.assigned_user_id === '' || data.assigned_user_id === 'unassigned'
      ? null
      : Number(data.assigned_user_id);

    if (assignedUserId) {
      const tech = await client.query(`
        SELECT 1
        FROM users u
        JOIN user_roles ur ON ur.user_id=u.id
        JOIN roles r ON r.id=ur.role_id
        LEFT JOIN user_service_lines usl ON usl.user_id=u.id
        WHERE u.id=$1
          AND u.is_active=true
          AND r.code IN ('technician','garage_technician','pool_technician','screen_technician')
          AND (usl.service_line_id=$2 OR NOT EXISTS (SELECT 1 FROM user_service_lines x WHERE x.user_id=u.id))
        LIMIT 1
      `, [assignedUserId, row.service_line_id]);
      if (!tech.rows[0]) throw new Error('Selected technician cannot be assigned to this service line.');
    }

    await client.query(`UPDATE work_orders SET scheduled_start_at=$1::timestamp, updated_at=current_timestamp WHERE id=$2`, [scheduledAt, workOrderId]);
    await client.query(`DELETE FROM work_order_assignments WHERE work_order_id=$1 AND role_on_job='technician'`, [workOrderId]);
    if (assignedUserId) {
      await client.query(`
        INSERT INTO work_order_assignments(work_order_id,user_id,role_on_job)
        VALUES($1,$2,'technician')
        ON CONFLICT DO NOTHING
      `, [workOrderId, assignedUserId]);
    }
    await client.query(
      `INSERT INTO work_order_notes(work_order_id,author_user_id,note_body) VALUES($1,$2,$3)`,
      [workOrderId, userId || null, `Dispatch board update: scheduled ${oldDate || 'unscheduled'} → ${scheduledDate}; assigned technician ${assignedUserId || 'unassigned'}.`]
    );
    await client.query('COMMIT');
    return { id: Number(workOrderId), scheduled_date: scheduledDate, assigned_user_id: assignedUserId };
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function getCalendar(month) {
  const bounds = monthBounds(month);
  const [workOrders, closures, capacities] = await Promise.all([
    pool.query(`
      SELECT wo.id, wo.title, wo.scheduled_start_at::date scheduled_date,
        c.display_name customer, sl.name service_line, sl.code service_line_code,
        wos.name status, wos.code status_code,
        string_agg(DISTINCT u.display_name, ', ' ORDER BY u.display_name) assigned_to,
        string_agg(DISTINCT u.id::text, ',' ORDER BY u.id::text) assigned_user_ids
      FROM work_orders wo
      JOIN customers c ON c.id=wo.customer_id
      JOIN service_lines sl ON sl.id=wo.service_line_id
      JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
      LEFT JOIN work_order_assignments woa ON woa.work_order_id=wo.id
      LEFT JOIN users u ON u.id=woa.user_id
      WHERE wo.scheduled_start_at::date >= $1::date
        AND wo.scheduled_start_at::date < $2::date
      GROUP BY wo.id, wo.title, wo.scheduled_start_at, c.display_name, sl.name, sl.code, wos.name, wos.code
      ORDER BY wo.scheduled_start_at ASC, wo.id ASC
    `, [bounds.start, bounds.end]),
    pool.query(`
      SELECT bc.*, sl.name service_line
      FROM business_closures bc
      LEFT JOIN service_lines sl ON sl.id=bc.service_line_id
      WHERE bc.closure_date >= $1::date AND bc.closure_date < $2::date
      ORDER BY bc.closure_date ASC, bc.service_line_id NULLS FIRST
    `, [bounds.start, bounds.end]),
    pool.query(`
      SELECT tdc.*, u.display_name user_name, sl.name service_line
      FROM technician_daily_capacities tdc
      JOIN users u ON u.id=tdc.user_id
      LEFT JOIN service_lines sl ON sl.id=tdc.service_line_id
      ORDER BY u.display_name, sl.name NULLS FIRST
    `)
  ]);
  return { ...bounds, workOrders: workOrders.rows, closures: closures.rows, capacities: capacities.rows };
}

async function getOptions() {
  const [users, serviceLines] = await Promise.all([
    pool.query(`SELECT id, display_name FROM users WHERE is_active=true ORDER BY display_name`),
    pool.query(`SELECT id, name FROM service_lines WHERE is_active=true ORDER BY name`)
  ]);
  return { users: users.rows, serviceLines: serviceLines.rows };
}

async function listClosures() {
  const result = await pool.query(`
    SELECT bc.*, sl.name service_line
    FROM business_closures bc
    LEFT JOIN service_lines sl ON sl.id=bc.service_line_id
    ORDER BY bc.closure_date DESC, bc.service_line_id NULLS FIRST
  `);
  return result.rows;
}

async function createClosure(data) {
  await pool.query(`
    INSERT INTO business_closures(closure_date, reason, closure_type, service_line_id)
    VALUES($1,$2,$3,$4)
    ON CONFLICT(closure_date, service_line_id)
    DO UPDATE SET reason=EXCLUDED.reason, closure_type=EXCLUDED.closure_type, updated_at=current_timestamp
  `, [data.closure_date, data.reason, data.closure_type || 'holiday', data.service_line_id || null]);
}

async function deleteClosure(id) {
  await pool.query(`DELETE FROM business_closures WHERE id=$1`, [id]);
}

async function listCapacities() {
  const result = await pool.query(`
    SELECT tdc.*, u.display_name user_name, sl.name service_line
    FROM technician_daily_capacities tdc
    JOIN users u ON u.id=tdc.user_id
    LEFT JOIN service_lines sl ON sl.id=tdc.service_line_id
    ORDER BY u.display_name, sl.name NULLS FIRST
  `);
  return result.rows;
}

async function upsertCapacity(data) {
  await pool.query(`
    INSERT INTO technician_daily_capacities(user_id, service_line_id, max_jobs_per_day)
    VALUES($1,$2,$3)
    ON CONFLICT(user_id, service_line_id)
    DO UPDATE SET max_jobs_per_day=EXCLUDED.max_jobs_per_day, updated_at=current_timestamp
  `, [data.user_id, data.service_line_id || null, Number(data.max_jobs_per_day || 8)]);
}

async function deleteCapacity(id) {
  await pool.query(`DELETE FROM technician_daily_capacities WHERE id=$1`, [id]);
}

module.exports = { getCalendar, getDispatchBoard, updateWorkOrderSchedule, getOptions, listClosures, createClosure, deleteClosure, listCapacities, upsertCapacity, deleteCapacity, monthBounds, weekBounds };
