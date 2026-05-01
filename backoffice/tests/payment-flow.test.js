const db = require('./helpers/db');
const billingService = require('../modules/billing/service');
const workOrdersService = require('../modules/workOrders/service');

async function createSubmittedInvoice({ lineItemAmount = 100 } = {}) {
  const userId = await db.firstActiveUserId();

  const prospect = await db.createProspect();

  const workOrderId = await db.createOpenWorkOrder({
    customerId: prospect.customerId,
    serviceLineId: prospect.serviceLineId,
    userId,
  });

  await workOrdersService.addLineItem(workOrderId, {
    description: 'Test Item',
    quantity: 1,
    unit_price: lineItemAmount,
  });

  const invoiceId = await workOrdersService.transition(
    workOrderId,
    { action: 'complete' },
    { id: userId }
  );

  expect(invoiceId).toBeTruthy();

  await billingService.submitInvoice(invoiceId);

  const invoice = await db.query(
    `
    SELECT
      i.id,
      i.total_amount,
      COALESCE(i.balance_due, i.total_amount) balance_due,
      s.code status_code
    FROM invoices i
    JOIN invoice_statuses s
      ON s.id = i.invoice_status_id
    WHERE i.id = $1
    `,
    [invoiceId]
  );

  expect(invoice.rows[0].status_code).toBe('submitted');

  return invoice.rows[0];
}
describe('payment flow', () => {
  test('partial payment keeps invoice submitted and overpayment is rejected', async () => {
    const invoice = await createSubmittedInvoice({ lineItemAmount: 100 });
    expect(Number(invoice.balance_due)).toBeGreaterThan(50);

    await billingService.recordPayment(invoice.id, { amount: 50 });

    const status = await db.query(
      `
      SELECT s.code
      FROM invoices i
      JOIN invoice_statuses s
        ON s.id = i.invoice_status_id
      WHERE i.id = $1
      `,
      [invoice.id],
    );

    expect(status.rows[0].code).toBe('submitted');

    const refreshed = await db.query(
      `
      SELECT COALESCE(balance_due, total_amount) balance_due
      FROM invoices
      WHERE id = $1
      `,
      [invoice.id],
    );

    await expect(
      billingService.recordPayment(invoice.id, {
        amount: Number(refreshed.rows[0].balance_due) + 1,
      }),
    ).rejects.toThrow(/cannot exceed remaining balance/i);
  });

  test('payment of remaining balance marks invoice paid', async () => {
    const invoice = await createSubmittedInvoice({ lineItemAmount: 100 });
    await billingService.recordPayment(invoice.id, {
      amount: Number(invoice.balance_due),
    });

    const status = await db.query(
      `
      SELECT s.code
      FROM invoices i
      JOIN invoice_statuses s
        ON s.id = i.invoice_status_id
      WHERE i.id = $1
      `,
      [invoice.id],
    );

    expect(status.rows[0].code).toBe('paid');
  });
});