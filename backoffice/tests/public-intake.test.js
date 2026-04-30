const request = require('supertest');
const { app } = require('../app');
const { pool } = require('./helpers/db');

describe('public intake API', () => {
  test('website form intake creates a prospect customer only', async () => {
    const response = await request(app)
      .post('/backoffice/api/public/leads')
      .send({
        name: 'Website Lead Test',
        phone: '404-555-0100',
        email: 'website-lead@example.com',
        service_type: 'Garage Doors',
        city: 'Roswell',
        state: 'GA',
        postal_code: '30075',
        county: 'Fulton',
        message: 'Need help with a noisy garage door.',
      });

    expect(response.status).toBe(201);
    expect(response.body.ok).toBe(true);

    const customer = await pool.query(
      `SELECT c.id, cs.code status_code
       FROM customers c
       JOIN customer_statuses cs ON cs.id=c.customer_status_id
       WHERE c.id=$1`,
      [response.body.customerId],
    );
    const workOrders = await pool.query(`SELECT COUNT(*)::int AS count FROM work_orders WHERE customer_id=$1`, [response.body.customerId]);

    expect(customer.rows[0].status_code).toBe('prospect');
    expect(workOrders.rows[0].count).toBe(0);
  });
});
