const db = require('./helpers/db');
const techService = require('../modules/tech/service');

async function createServiceLineTechnician({ email, roleCode, serviceLineCode }) {
  const roleId = await db.getId('roles', roleCode);
  const serviceLineId = await db.getId('service_lines', serviceLineCode);
  const user = await db.query(
    `INSERT INTO users(email,password_hash,display_name,position,role,is_active)
     VALUES($1,'test-hash',$2,$3,$3,true)
     RETURNING id`,
    [email, `${roleCode} Test`, roleCode],
  );
  const userId = user.rows[0].id;
  await db.query(`INSERT INTO user_roles(user_id,role_id) VALUES($1,$2)`, [userId, roleId]);
  await db.query(`INSERT INTO user_service_lines(user_id,service_line_id) VALUES($1,$2)`, [userId, serviceLineId]);
  return { userId, serviceLineId };
}

async function assign(workOrderId, userId) {
  await db.query(`INSERT INTO work_order_assignments(work_order_id,user_id,role_on_job) VALUES($1,$2,'technician') ON CONFLICT DO NOTHING`, [workOrderId, userId]);
}

describe('technician service-line filtering', () => {
  test('technician dashboard only shows assigned work orders for technician service lines', async () => {
    const userId = await db.firstActiveUserId();
    const poolTech = await createServiceLineTechnician({ email: `pool-tech-${Date.now()}@example.com`, roleCode: 'pool_technician', serviceLineCode: 'pools' });

    const garage = await db.createProspect({ serviceLineCode: 'garage_doors', displayName: 'Garage Tech Filter Customer' });
    const pool = await db.createProspect({ serviceLineCode: 'pools', displayName: 'Pool Tech Filter Customer' });
    const garageWorkOrderId = await db.createOpenWorkOrder({ customerId: garage.customerId, serviceLineId: garage.serviceLineId, title: 'Garage Assigned But Wrong Service', userId });
    const poolWorkOrderId = await db.createOpenWorkOrder({ customerId: pool.customerId, serviceLineId: pool.serviceLineId, title: 'Pool Assigned Correct Service', userId });

    await assign(garageWorkOrderId, poolTech.userId);
    await assign(poolWorkOrderId, poolTech.userId);

    const dashboard = await techService.getTechnicianDashboard(poolTech.userId);
    const ids = dashboard.jobs.map((j) => Number(j.id));

    expect(ids).toContain(poolWorkOrderId);
    expect(ids).not.toContain(garageWorkOrderId);
  });
});
