const db = require('./helpers/db');
const recurringService = require('../modules/recurringService/service');

function dateString(value) {
  return new Date(value).toISOString().slice(0, 10);
}

describe('recurring service plans', () => {
  test('manual generation creates a normal work order and advances the next run date', async () => {
    const userId = await db.firstActiveUserId();
    const prospect = await db.createProspect({ serviceLineCode: 'pools', displayName: 'Recurring Pool Customer' });
    const tech = await db.query(`SELECT id FROM users WHERE is_active=true ORDER BY id LIMIT 1`);

    const planId = await recurringService.createPlan({
      customer_id: prospect.customerId,
      customer_location_id: prospect.locationId,
      service_line_id: prospect.serviceLineId,
      assigned_user_id: tech.rows[0].id,
      title: 'Weekly Pool Maintenance',
      description: 'Recurring pool service visit',
      frequency: 'weekly',
      interval_count: 1,
      next_run_date: '2026-05-04',
      is_active: true,
    });

    const workOrderId = await recurringService.generateNextWorkOrder(planId, { id: userId });
    expect(workOrderId).toBeTruthy();

    const workOrder = await db.query(
      `SELECT wo.id, wo.title, wo.scheduled_start_at, wos.code status_code, sl.code service_line_code
       FROM work_orders wo
       JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
       JOIN service_lines sl ON sl.id=wo.service_line_id
       WHERE wo.id=$1`,
      [workOrderId],
    );
    expect(workOrder.rows[0].title).toBe('Weekly Pool Maintenance');
    expect(workOrder.rows[0].status_code).toBe('open');
    expect(workOrder.rows[0].service_line_code).toBe('pools');
    expect(dateString(workOrder.rows[0].scheduled_start_at)).toBe('2026-05-04');

    const run = await db.query(`SELECT * FROM recurring_service_plan_runs WHERE recurring_service_plan_id=$1`, [planId]);
    expect(run.rows).toHaveLength(1);
    expect(Number(run.rows[0].work_order_id)).toBe(workOrderId);

    const plan = await recurringService.getPlan(planId);
    expect(dateString(plan.next_run_date)).toBe('2026-05-11');

    const customer = await db.query(`SELECT cs.code FROM customers c JOIN customer_statuses cs ON cs.id=c.customer_status_id WHERE c.id=$1`, [prospect.customerId]);
    expect(customer.rows[0].code).toBe('customer');
  });
});
