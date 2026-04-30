const pool = require('../../db/pool');

async function query(sql, params = []) {
  return pool.query(sql, params);
}

async function getId(table, code) {
  const result = await pool.query(`SELECT id FROM ${table} WHERE code=$1`, [code]);
  if (!result.rows[0]) throw new Error(`Missing ${table}.${code}`);
  return result.rows[0].id;
}

async function firstActiveUserId() {
  const result = await pool.query(`SELECT id FROM users WHERE is_active=true ORDER BY id LIMIT 1`);
  return result.rows[0]?.id || null;
}

async function createProspect(overrides = {}) {
  const customerStatusId = await getId('customer_statuses', 'prospect');
  const leadSourceId = await getId('lead_sources', overrides.leadSourceCode || 'website');
  const propertyTypeId = await getId('property_types', 'single_family');
  const serviceLineId = await getId('service_lines', overrides.serviceLineCode || 'garage_doors');

  const customer = await pool.query(
    `INSERT INTO customers(display_name, customer_status_id, lead_source_id)
     VALUES($1,$2,$3)
     RETURNING id`,
    [overrides.displayName || `Test Prospect ${Date.now()}`, customerStatusId, leadSourceId],
  );
  const customerId = customer.rows[0].id;

  await pool.query(
    `INSERT INTO customer_status_history(customer_id,to_status_id,reason)
     VALUES($1,$2,'Test prospect created')`,
    [customerId, customerStatusId],
  );

  await pool.query(
    `INSERT INTO customer_contacts(customer_id,first_name,last_name,phone,email,is_primary)
     VALUES($1,$2,$3,$4,$5,true)`,
    [customerId, overrides.firstName || 'Test', overrides.lastName || 'Customer', overrides.phone || '404-555-1212', overrides.email || `test-${customerId}@example.com`],
  );

  const location = await pool.query(
    `INSERT INTO customer_locations(customer_id,property_type_id,label,address_line_1,city,state,postal_code,county,is_primary)
     VALUES($1,$2,'Primary','123 Test Lane',$3,'GA',$4,$5,true)
     RETURNING id`,
    [customerId, propertyTypeId, overrides.city || 'Roswell', overrides.postalCode || '30075', overrides.county || 'Fulton'],
  );

  await pool.query(
    `INSERT INTO customer_service_lines(customer_id,service_line_id)
     VALUES($1,$2)`,
    [customerId, serviceLineId],
  );

  return { customerId, locationId: location.rows[0].id, serviceLineId };
}

async function createOpenWorkOrder({ customerId, serviceLineId, title = 'Test Work Order', userId = null }) {
  const customers = require('../../modules/customers/service');
  return customers.createWorkOrderFromCustomer(
    customerId,
    {
      title,
      description: 'Integration test work order',
      service_line_id: serviceLineId,
    },
    userId ? { id: userId } : null,
  );
}

async function invoiceForWorkOrder(workOrderId) {
  const result = await pool.query(
    `SELECT i.*, s.code status_code
     FROM invoices i
     JOIN invoice_statuses s ON s.id=i.invoice_status_id
     WHERE i.work_order_id=$1`,
    [workOrderId],
  );
  return result.rows[0] || null;
}

async function close() {
  await pool.end();
}

module.exports = {
  pool,
  getId,
  firstActiveUserId,
  createProspect,
  createOpenWorkOrder,
  invoiceForWorkOrder,
};
