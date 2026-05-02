const db = require('./helpers/db');
const customers = require('../modules/customers/service');
const recurringService = require('../modules/recurringService/service');

function dateString(value) {
  return new Date(value).toISOString().slice(0, 10);
}

describe('recurring work from customer work order creation', () => {
  test('unchecked repeat creates a normal work order without a recurring plan', async () => {
    const userId = await db.firstActiveUserId();
    const prospect = await db.createProspect({ serviceLineCode: 'garage_doors', displayName: 'One Time Work Customer' });

    const workOrderId = await customers.createWorkOrderFromCustomer(
      prospect.customerId,
      {
        title: 'One Time Garage Repair',
        service_line_id: prospect.serviceLineId,
        customer_location_id: prospect.locationId,
        description: 'One time repair',
      },
      { id: userId },
    );

    const runs = await db.query(`SELECT COUNT(*)::int count FROM recurring_service_plan_runs WHERE work_order_id=$1`, [workOrderId]);
    expect(runs.rows[0].count).toBe(0);
  });

  test('checked repeat creates a recurring plan and first generated work order', async () => {
    const userId = await db.firstActiveUserId();
    const prospect = await db.createProspect({ serviceLineCode: 'pools', displayName: 'Repeat Work Customer' });

    const workOrderId = await customers.createWorkOrderFromCustomer(
      prospect.customerId,
      {
        title: 'Weekly Pool Maintenance',
        service_line_id: prospect.serviceLineId,
        customer_location_id: prospect.locationId,
        assigned_user_id: userId,
        description: 'Weekly recurring pool visit',
        is_recurring: '1',
        frequency: 'weekly',
        interval_count: '1',
        next_run_date: '2026-05-04',
      },
      { id: userId },
    );

    const run = await db.query(
      `SELECT rspr.*, rsp.title, rsp.frequency, rsp.next_run_date
       FROM recurring_service_plan_runs rspr
       JOIN recurring_service_plans rsp ON rsp.id=rspr.recurring_service_plan_id
       WHERE rspr.work_order_id=$1`,
      [workOrderId],
    );

    expect(run.rows).toHaveLength(1);
    expect(run.rows[0].title).toBe('Weekly Pool Maintenance');
    expect(run.rows[0].frequency).toBe('weekly');
    expect(dateString(run.rows[0].scheduled_for)).toBe('2026-05-04');
    expect(dateString(run.rows[0].next_run_date)).toBe('2026-05-11');

    const workOrder = await db.query(
      `SELECT wo.*, wos.code status_code
       FROM work_orders wo
       JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
       WHERE wo.id=$1`,
      [workOrderId],
    );

    expect(workOrder.rows[0].status_code).toBe('open');
    expect(dateString(workOrder.rows[0].scheduled_start_at)).toBe('2026-05-04');
  });

  test('recurring work can use scheduled start date as the first run date', async () => {
    const userId = await db.firstActiveUserId();
    const prospect = await db.createProspect({ serviceLineCode: 'pools', displayName: 'Scheduled Repeat Work Customer' });

    const workOrderId = await customers.createWorkOrderFromCustomer(
      prospect.customerId,
      {
        title: 'Biweekly Pool Maintenance',
        service_line_id: prospect.serviceLineId,
        customer_location_id: prospect.locationId,
        description: 'Biweekly recurring pool visit',
        scheduled_start_at: '2026-06-03T09:30',
        is_recurring: 'on',
        frequency: 'biweekly',
        interval_count: '1',
      },
      { id: userId },
    );

    const run = await db.query(
      `SELECT rspr.scheduled_for, rsp.next_run_date
       FROM recurring_service_plan_runs rspr
       JOIN recurring_service_plans rsp ON rsp.id=rspr.recurring_service_plan_id
       WHERE rspr.work_order_id=$1`,
      [workOrderId],
    );

    expect(dateString(run.rows[0].scheduled_for)).toBe('2026-06-03');
    expect(dateString(run.rows[0].next_run_date)).toBe('2026-06-17');
  });
});
