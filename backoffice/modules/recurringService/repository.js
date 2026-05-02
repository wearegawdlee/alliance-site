const pool = require('../../db/pool');

function clean(value) { const s = String(value || '').trim(); return s || null; }
function bool(value) { return value === true || value === 'on' || value === 'true' || value === '1'; }

async function listPlans(filters = {}) {
  const params = [];
  const where = [];
  if (filters.service_line_id) { params.push(Number(filters.service_line_id)); where.push(`rsp.service_line_id=$${params.length}`); }
  if (filters.active === 'inactive') where.push(`rsp.is_active=false`);
  else if (filters.active !== 'all') where.push(`rsp.is_active=true`);
  if (filters.search) { params.push(`%${filters.search}%`); where.push(`(rsp.title ILIKE $${params.length} OR c.display_name ILIKE $${params.length} OR cl.city ILIKE $${params.length})`); }
  const result = await pool.query(`
    SELECT rsp.*, c.display_name customer, sl.name service_line, cl.city, cl.state, u.display_name assigned_to,
      COALESCE(run_counts.run_count,0)::int run_count
    FROM recurring_service_plans rsp
    JOIN customers c ON c.id=rsp.customer_id
    JOIN customer_locations cl ON cl.id=rsp.customer_location_id
    JOIN service_lines sl ON sl.id=rsp.service_line_id
    LEFT JOIN users u ON u.id=rsp.assigned_user_id
    LEFT JOIN (SELECT recurring_service_plan_id, COUNT(*) run_count FROM recurring_service_plan_runs GROUP BY recurring_service_plan_id) run_counts ON run_counts.recurring_service_plan_id=rsp.id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    ORDER BY rsp.is_active DESC, rsp.next_run_date ASC, rsp.created_at DESC
  `, params);
  return result.rows;
}

async function getOptions() {
  const [customers, serviceLines, users] = await Promise.all([
    pool.query(`SELECT id, display_name FROM customers ORDER BY display_name`),
    pool.query(`SELECT id, code, name FROM service_lines WHERE is_active=true ORDER BY name`),
    pool.query(`SELECT id, display_name FROM users WHERE is_active=true ORDER BY display_name`)
  ]);
  return { customers: customers.rows, serviceLines: serviceLines.rows, users: users.rows };
}

async function getCustomerLocations(customerId) {
  const result = await pool.query(`SELECT id, label, address_line_1, city, state, postal_code FROM customer_locations WHERE customer_id=$1 ORDER BY is_primary DESC, id`, [customerId]);
  return result.rows;
}

async function getWorkOrderTypeId(client, serviceLineId, code = 'maintenance') {
  const result = await client.query(`SELECT id FROM work_order_types WHERE service_line_id=$1 AND code=$2 LIMIT 1`, [serviceLineId, code]);
  return result.rows[0]?.id || null;
}
async function getOpenStatusId(client) { return (await client.query(`SELECT id FROM work_order_statuses WHERE code='open'`)).rows[0].id; }
async function getCustomerStatusId(client, code) { return (await client.query(`SELECT id FROM customer_statuses WHERE code=$1`, [code])).rows[0]?.id; }

async function getPlan(id) {
  const plan = (await pool.query(`
    SELECT rsp.*, c.display_name customer, sl.name service_line, cl.address_line_1, cl.city, cl.state, cl.postal_code, u.display_name assigned_to
    FROM recurring_service_plans rsp
    JOIN customers c ON c.id=rsp.customer_id
    JOIN service_lines sl ON sl.id=rsp.service_line_id
    JOIN customer_locations cl ON cl.id=rsp.customer_location_id
    LEFT JOIN users u ON u.id=rsp.assigned_user_id
    WHERE rsp.id=$1
  `, [id])).rows[0];
  if (!plan) return null;
  const runs = await pool.query(`
    SELECT rspr.*, wo.title work_order_title, wos.name work_order_status, wos.code work_order_status_code
    FROM recurring_service_plan_runs rspr
    JOIN work_orders wo ON wo.id=rspr.work_order_id
    JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
    WHERE rspr.recurring_service_plan_id=$1
    ORDER BY rspr.scheduled_for DESC, rspr.id DESC
  `, [id]);
  return { ...plan, runs: runs.rows };
}

async function createPlan(data) {
  const result = await pool.query(`
    INSERT INTO recurring_service_plans(customer_id,customer_location_id,service_line_id,work_order_type_id,assigned_user_id,title,description,frequency,interval_count,day_of_week,day_of_month,next_run_date,is_active)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
    RETURNING id
  `, [data.customer_id, data.customer_location_id, data.service_line_id, data.work_order_type_id || null, data.assigned_user_id || null, data.title, data.description || null, data.frequency || 'weekly', data.interval_count || 1, data.day_of_week || null, data.day_of_month || null, data.next_run_date, data.is_active !== false]);
  return result.rows[0].id;
}

async function updatePlan(id, data) {
  await pool.query(`
    UPDATE recurring_service_plans SET customer_id=$1,customer_location_id=$2,service_line_id=$3,work_order_type_id=$4,assigned_user_id=$5,title=$6,description=$7,frequency=$8,interval_count=$9,day_of_week=$10,day_of_month=$11,next_run_date=$12,is_active=$13,updated_at=current_timestamp
    WHERE id=$14
  `, [data.customer_id, data.customer_location_id, data.service_line_id, data.work_order_type_id || null, data.assigned_user_id || null, data.title, data.description || null, data.frequency || 'weekly', data.interval_count || 1, data.day_of_week || null, data.day_of_month || null, data.next_run_date, data.is_active !== false, id]);
}

function normalizeDate(value) {
  if (!value) return null;
  if (value instanceof Date) return new Date(value.getTime());
  return new Date(value);
}
function dateOnly(value) {
  const d = normalizeDate(value);
  if (!d || Number.isNaN(d.getTime())) throw new Error(`Invalid date value: ${value}`);
  return d.toISOString().slice(0, 10);
}
function addDays(value, days) {
  const d = normalizeDate(value);
  if (!d || Number.isNaN(d.getTime())) throw new Error(`Invalid date value: ${value}`);
  d.setUTCDate(d.getUTCDate() + Number(days));
  return dateOnly(d);
}
function addMonths(value, months) {
  const d = normalizeDate(value);
  if (!d || Number.isNaN(d.getTime())) throw new Error(`Invalid date value: ${value}`);
  d.setUTCMonth(d.getUTCMonth() + Number(months));
  return dateOnly(d);
}
function nextRunDate(plan) {
  const n = Math.max(1, Number(plan.interval_count || 1));
  if (plan.frequency === 'monthly') return addMonths(plan.next_run_date, n);
  if (plan.frequency === 'biweekly') return addDays(plan.next_run_date, 14 * n);
  return addDays(plan.next_run_date, 7 * n);
}


async function recordExistingWorkOrderRun(planId, workOrderId, scheduledFor, userId) {
  const scheduledDate = dateOnly(scheduledFor);
  await pool.query(
    `INSERT INTO recurring_service_plan_runs(recurring_service_plan_id,work_order_id,scheduled_for,created_by_user_id)
     VALUES($1,$2,$3,$4)
     ON CONFLICT (work_order_id) DO NOTHING`,
    [planId, workOrderId, scheduledDate, userId || null]
  );
}

async function generateNextWorkOrder(planId, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const plan = (await client.query(`SELECT * FROM recurring_service_plans WHERE id=$1 FOR UPDATE`, [planId])).rows[0];
    if (!plan) throw new Error('Recurring service plan not found');
    if (!plan.is_active) throw new Error('Recurring service plan is inactive');
    const existing = await client.query(`SELECT work_order_id FROM recurring_service_plan_runs WHERE recurring_service_plan_id=$1 AND scheduled_for=$2`, [planId, plan.next_run_date]);
    if (existing.rows[0]) { await client.query('COMMIT'); return existing.rows[0].work_order_id; }
    const openStatusId = await getOpenStatusId(client);
    const workOrderTypeId = plan.work_order_type_id || await getWorkOrderTypeId(client, plan.service_line_id, 'maintenance');
    const workOrder = await client.query(`
      INSERT INTO work_orders(customer_id,customer_location_id,service_line_id,work_order_type_id,work_order_status_id,title,description,scheduled_start_at)
      VALUES($1,$2,$3,$4,$5,$6,$7,$8::date)
      RETURNING id
    `, [plan.customer_id, plan.customer_location_id, plan.service_line_id, workOrderTypeId, openStatusId, plan.title, plan.description, plan.next_run_date]);
    const workOrderId = workOrder.rows[0].id;
    if (plan.assigned_user_id) await client.query(`INSERT INTO work_order_assignments(work_order_id,user_id,role_on_job) VALUES($1,$2,'technician') ON CONFLICT DO NOTHING`, [workOrderId, plan.assigned_user_id]);
    await client.query(`INSERT INTO work_order_status_history(work_order_id,to_status_id,changed_by_user_id,reason) VALUES($1,$2,$3,'Generated from recurring service plan')`, [workOrderId, openStatusId, userId || null]);
    await client.query(`INSERT INTO recurring_service_plan_runs(recurring_service_plan_id,work_order_id,scheduled_for,created_by_user_id) VALUES($1,$2,$3,$4)`, [planId, workOrderId, plan.next_run_date, userId || null]);
    const customerStatus = await client.query(`SELECT cs.code FROM customers c JOIN customer_statuses cs ON cs.id=c.customer_status_id WHERE c.id=$1`, [plan.customer_id]);
    if (customerStatus.rows[0]?.code === 'prospect') {
      const customerId = await getCustomerStatusId(client, 'customer');
      await client.query(`UPDATE customers SET customer_status_id=$1,updated_at=current_timestamp WHERE id=$2`, [customerId, plan.customer_id]);
      await client.query(`INSERT INTO customer_status_history(customer_id,to_status_id,changed_by_user_id,reason) VALUES($1,$2,$3,'Recurring service plan generated first work order')`, [plan.customer_id, customerId, userId || null]);
    }
    await client.query(`UPDATE recurring_service_plans SET next_run_date=$1,updated_at=current_timestamp WHERE id=$2`, [nextRunDate(plan), planId]);
    await client.query('COMMIT');
    return workOrderId;
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

module.exports = { listPlans, getOptions, getCustomerLocations, getPlan, createPlan, updatePlan, generateNextWorkOrder, recordExistingWorkOrderRun, nextRunDate, dateOnly };
