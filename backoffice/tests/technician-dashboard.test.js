const db = require('./helpers/db');
const techService = require('../modules/tech/service');

async function roleUser(roleCode) {
  const result = await db.query(`
    SELECT u.id, u.email, COALESCE(array_agg(r.code ORDER BY r.code) FILTER (WHERE r.code IS NOT NULL), '{}') roles
    FROM users u
    JOIN user_roles ur ON ur.user_id=u.id
    JOIN roles r ON r.id=ur.role_id
    WHERE r.code=$1
    GROUP BY u.id
    ORDER BY u.id
    LIMIT 1
  `, [roleCode]);
  return result.rows[0];
}

describe('technician dashboard', () => {
  test('technician sees assigned work orders only', async () => {
    const tech = await roleUser('technician');
    const workOrders = await db.query('SELECT id FROM work_orders ORDER BY id LIMIT 2');
    expect(workOrders.rows.length).toBeGreaterThanOrEqual(2);

    await db.query('DELETE FROM work_order_assignments WHERE user_id=$1', [tech.id]);
    await db.query('INSERT INTO work_order_assignments(work_order_id,user_id,role_on_job) VALUES($1,$2,$3)', [workOrders.rows[0].id, tech.id, 'technician']);

    const dashboard = await techService.getTechnicianDashboard(tech.id);
    const ids = dashboard.jobs.map((job) => job.id);

    expect(ids).toContain(workOrders.rows[0].id);
    expect(ids).not.toContain(workOrders.rows[1].id);
  });

  test('technician cannot open an unassigned work order through tech service', async () => {
    const tech = await roleUser('technician');
    const workOrder = await db.query('SELECT id FROM work_orders ORDER BY id DESC LIMIT 1');
    await db.query('DELETE FROM work_order_assignments WHERE work_order_id=$1 AND user_id=$2', [workOrder.rows[0].id, tech.id]);

    const detail = await techService.getAssignedWorkOrderDetail(workOrder.rows[0].id, { id: tech.id, roles: ['technician'] });
    expect(detail).toBeNull();
  });
});
