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
    SELECT rspr.*, wo.title work_order_title, wo.scheduled_start_at, wos.name work_order_status, wos.code work_order_status_code
    FROM recurring_service_plan_runs rspr
    JOIN work_orders wo ON wo.id=rspr.work_order_id
    JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
    WHERE rspr.recurring_service_plan_id=$1
    ORDER BY rspr.scheduled_for DESC, rspr.id DESC
  `, [id]);
  return { ...plan, runs: runs.rows };
}


async function getPlanScheduleSnapshot(id) {
  const result = await pool.query(`
    SELECT id, frequency, interval_count, day_of_week, day_of_month, next_run_date
    FROM recurring_service_plans
    WHERE id=$1
  `, [id]);
  return result.rows[0] || null;
}

async function getLatestRunDate(planId) {
  const result = await pool.query(`
    SELECT scheduled_for
    FROM recurring_service_plan_runs
    WHERE recurring_service_plan_id=$1
    ORDER BY scheduled_for DESC, id DESC
    LIMIT 1
  `, [planId]);
  return result.rows[0]?.scheduled_for || null;
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
  return nextRunDateFromDate(plan, plan.next_run_date);
}

function nextRunDateFromDate(plan, fromDate) {
  const n = Math.max(1, Number(plan.interval_count || 1));
  if (plan.frequency === 'monthly') return addMonths(fromDate, n);
  if (plan.frequency === 'biweekly') return addDays(fromDate, 14 * n);
  return addDays(fromDate, 7 * n);
}


async function recordExistingWorkOrderRun(planId, workOrderId, scheduledFor, userId) {
  const scheduledDate = dateOnly(scheduledFor);
  await pool.query(
    `INSERT INTO recurring_service_plan_runs(recurring_service_plan_id,work_order_id,due_for,scheduled_for,created_by_user_id,generation_source)
     VALUES($1,$2,$3,$3,$4,'manual')
     ON CONFLICT (work_order_id) DO NOTHING`,
    [planId, workOrderId, scheduledDate, userId || null]
  );
}


function todayDate() {
  return dateOnly(new Date());
}

function isWeekend(dateValue) {
  const d = normalizeDate(`${dateOnly(dateValue)}T00:00:00Z`);
  const day = d.getUTCDay();
  return day === 0 || day === 6;
}

async function isBusinessClosure(client, dateValue, serviceLineId) {
  const result = await client.query(
    `SELECT reason
     FROM business_closures
     WHERE closure_date=$1::date
       AND (service_line_id IS NULL OR service_line_id=$2)
     ORDER BY service_line_id NULLS FIRST
     LIMIT 1`,
    [dateOnly(dateValue), serviceLineId]
  );
  return result.rows[0]?.reason || null;
}

async function getTechnicianCapacity(client, userId, serviceLineId) {
  if (!userId) return null;
  const result = await client.query(
    `SELECT max_jobs_per_day
     FROM technician_daily_capacities
     WHERE user_id=$1
       AND (service_line_id=$2 OR service_line_id IS NULL)
     ORDER BY service_line_id NULLS LAST
     LIMIT 1`,
    [userId, serviceLineId]
  );
  return result.rows[0] ? Number(result.rows[0].max_jobs_per_day || 0) : null;
}

async function countTechnicianJobsOnDate(client, userId, serviceLineId, scheduledDate) {
  if (!userId) return 0;
  const result = await client.query(
    `SELECT COUNT(*)::int count
     FROM work_orders wo
     JOIN work_order_assignments woa ON woa.work_order_id=wo.id AND woa.user_id=$1
     JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
     WHERE wo.service_line_id=$2
       AND wo.scheduled_start_at::date=$3::date
       AND wos.code <> 'cancelled'`,
    [userId, serviceLineId, dateOnly(scheduledDate)]
  );
  return Number(result.rows[0]?.count || 0);
}

async function chooseScheduledDate(client, plan, dueDate) {
  let scheduledDate = dateOnly(dueDate);
  const reasons = [];
  const capacity = await getTechnicianCapacity(client, plan.assigned_user_id, plan.service_line_id);

  for (let guard = 0; guard < 90; guard += 1) {
    let blockedReason = null;
    if (isWeekend(scheduledDate)) blockedReason = 'weekend';
    const closureReason = await isBusinessClosure(client, scheduledDate, plan.service_line_id);
    if (closureReason) blockedReason = closureReason;

    if (!blockedReason && capacity && capacity > 0) {
      const count = await countTechnicianJobsOnDate(client, plan.assigned_user_id, plan.service_line_id, scheduledDate);
      if (count >= capacity) blockedReason = `technician capacity (${count}/${capacity})`;
    }

    if (!blockedReason) {
      return { scheduledDate, adjustmentReason: reasons.length ? reasons.join('; ') : null };
    }

    reasons.push(`${scheduledDate}: ${blockedReason}`);
    scheduledDate = addDays(scheduledDate, 1);
  }

  throw new Error(`Could not find an available scheduled date for recurring plan ${plan.id}`);
}

async function createWorkOrderForRecurringRun(client, plan, dueDate, scheduledDate, adjustmentReason, userId, source = 'scheduler') {
  const dueFor = dateOnly(dueDate);
  const existing = await client.query(
    `SELECT work_order_id
     FROM recurring_service_plan_runs
     WHERE recurring_service_plan_id=$1 AND due_for=$2`,
    [plan.id, dueFor]
  );
  if (existing.rows[0]) return { workOrderId: existing.rows[0].work_order_id, created: false };

  const openStatusId = await getOpenStatusId(client);
  const workOrderTypeId = plan.work_order_type_id || await getWorkOrderTypeId(client, plan.service_line_id, 'maintenance');
  const workOrder = await client.query(`
    INSERT INTO work_orders(customer_id,customer_location_id,service_line_id,work_order_type_id,work_order_status_id,title,description,scheduled_start_at)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8::date)
    RETURNING id
  `, [plan.customer_id, plan.customer_location_id, plan.service_line_id, workOrderTypeId, openStatusId, plan.title, plan.description, scheduledDate]);
  const workOrderId = workOrder.rows[0].id;

  if (plan.assigned_user_id) {
    await client.query(
      `INSERT INTO work_order_assignments(work_order_id,user_id,role_on_job)
       VALUES($1,$2,'technician') ON CONFLICT DO NOTHING`,
      [workOrderId, plan.assigned_user_id]
    );
  }

  await client.query(
    `INSERT INTO work_order_status_history(work_order_id,to_status_id,changed_by_user_id,reason)
     VALUES($1,$2,$3,$4)`,
    [workOrderId, openStatusId, userId || null, adjustmentReason ? `Generated from recurring service plan. ${adjustmentReason}` : 'Generated from recurring service plan']
  );

  await client.query(
    `INSERT INTO recurring_service_plan_runs(recurring_service_plan_id,work_order_id,due_for,scheduled_for,adjustment_reason,created_by_user_id,generation_source)
     VALUES($1,$2,$3,$4,$5,$6,$7)`,
    [plan.id, workOrderId, dueFor, scheduledDate, adjustmentReason, userId || null, source]
  );

  const customerStatus = await client.query(`SELECT cs.code FROM customers c JOIN customer_statuses cs ON cs.id=c.customer_status_id WHERE c.id=$1`, [plan.customer_id]);
  if (customerStatus.rows[0]?.code === 'prospect') {
    const customerId = await getCustomerStatusId(client, 'customer');
    await client.query(`UPDATE customers SET customer_status_id=$1,updated_at=current_timestamp WHERE id=$2`, [customerId, plan.customer_id]);
    await client.query(`INSERT INTO customer_status_history(customer_id,to_status_id,changed_by_user_id,reason) VALUES($1,$2,$3,'Recurring service plan generated first work order')`, [plan.customer_id, customerId, userId || null]);
  }

  return { workOrderId, created: true };
}

async function generateNextWorkOrder(planId, userId, source = 'manual') {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const plan = (await client.query(`SELECT * FROM recurring_service_plans WHERE id=$1 FOR UPDATE`, [planId])).rows[0];
    if (!plan) throw new Error('Recurring service plan not found');
    if (!plan.is_active) throw new Error('Recurring service plan is inactive');

    const dueDate = dateOnly(plan.next_run_date);
    const schedule = await chooseScheduledDate(client, plan, dueDate);
    const result = await createWorkOrderForRecurringRun(client, plan, dueDate, schedule.scheduledDate, schedule.adjustmentReason, userId, source);
    await client.query(`UPDATE recurring_service_plans SET next_run_date=$1,updated_at=current_timestamp WHERE id=$2`, [nextRunDate(plan), planId]);
    await client.query('COMMIT');
    return result.workOrderId;
  } catch(e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function generateDueWorkOrders(options = {}) {
  const lookaheadDays = Math.max(0, Number(options.lookaheadDays ?? process.env.RECURRING_LOOKAHEAD_DAYS ?? 14));
  const userId = options.userId || null;
  const source = options.source || 'scheduler';
  const horizon = addDays(todayDate(), lookaheadDays);
  const generated = [];
  const skipped = [];
  const client = await pool.connect();

  try {
    const lock = await client.query(`SELECT pg_try_advisory_lock(774401) acquired`);
    if (!lock.rows[0]?.acquired) return { generated, skipped, locked: true, horizon };

    try {
      while (true) {
        await client.query('BEGIN');
        const plan = (await client.query(
          `SELECT *
           FROM recurring_service_plans
           WHERE is_active=true
             AND next_run_date <= $1::date
           ORDER BY next_run_date ASC, id ASC
           LIMIT 1
           FOR UPDATE SKIP LOCKED`,
          [horizon]
        )).rows[0];

        if (!plan) {
          await client.query('COMMIT');
          break;
        }

        try {
          const dueDate = dateOnly(plan.next_run_date);
          const schedule = await chooseScheduledDate(client, plan, dueDate);
          const result = await createWorkOrderForRecurringRun(client, plan, dueDate, schedule.scheduledDate, schedule.adjustmentReason, userId, source);
          const nextDate = nextRunDateFromDate(plan, dueDate);
          await client.query(`UPDATE recurring_service_plans SET next_run_date=$1,updated_at=current_timestamp WHERE id=$2`, [nextDate, plan.id]);
          await client.query('COMMIT');
          if (result.created) generated.push({ planId: plan.id, workOrderId: result.workOrderId, dueDate, scheduledDate: schedule.scheduledDate, adjustmentReason: schedule.adjustmentReason });
        } catch (e) {
          await client.query('ROLLBACK');
          skipped.push({ planId: plan.id, error: e.message });
          // Move this plan out of the current run loop to prevent one bad plan from spinning forever.
          await pool.query(`UPDATE recurring_service_plans SET updated_at=current_timestamp WHERE id=$1`, [plan.id]);
          break;
        }
      }
    } finally {
      await client.query(`SELECT pg_advisory_unlock(774401)`);
    }
  } finally {
    client.release();
  }

  return { generated, skipped, locked: false, horizon };
}

module.exports = { listPlans, getOptions, getCustomerLocations, getPlan, getPlanScheduleSnapshot, getLatestRunDate, createPlan, updatePlan, generateNextWorkOrder, generateDueWorkOrders, recordExistingWorkOrderRun, nextRunDate, nextRunDateFromDate, dateOnly, chooseScheduledDate };
