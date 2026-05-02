const db = require('./helpers/db');
const billing = require('../modules/billing/service');
const workOrders = require('../modules/workOrders/service');
const recurringService = require('../modules/recurringService/service');

async function createInvoice({ status = 'created', serviceLineCode = 'garage_doors', title = 'Billing Batch Test' } = {}) {
  const userId = await db.firstActiveUserId();
  const prospect = await db.createProspect({ serviceLineCode, displayName: `${title} ${Date.now()}` });
  const workOrderId = await db.createOpenWorkOrder({
    customerId: prospect.customerId,
    serviceLineId: prospect.serviceLineId,
    title,
    userId,
  });

  await workOrders.addLineItem(workOrderId, {
    description: 'Billable service',
    quantity: 1,
    unit_price: 100,
  });

  const invoiceId = await workOrders.transition(workOrderId, { action: 'complete' }, { id: userId });
  expect(invoiceId).toBeTruthy();

  if (status === 'submitted' || status === 'paid') {
    await billing.submitInvoice(invoiceId);
  }

  if (status === 'paid') {
    const paymentMethodId = await db.getId('payment_methods', 'cash');
    const invoice = await db.invoiceForWorkOrder(workOrderId);
    await billing.recordPayment(invoiceId, {
      payment_method_id: paymentMethodId,
      amount: Number(invoice.balance_due || invoice.total_amount),
    });
  }

  return { invoiceId, workOrderId };
}

describe('billing batch workflow', () => {
  test('billing list defaults to unpaid invoices and can filter paid/all', async () => {
    const created = await createInvoice({ status: 'created', title: 'Created Invoice Filter Test' });
    const paid = await createInvoice({ status: 'paid', title: 'Paid Invoice Filter Test' });

    const unpaidInvoices = await billing.listInvoices();
    expect(unpaidInvoices.some(i => Number(i.id) === created.invoiceId)).toBe(true);
    expect(unpaidInvoices.some(i => Number(i.id) === paid.invoiceId)).toBe(false);

    const paidInvoices = await billing.listInvoices({ status: 'paid' });
    expect(paidInvoices.some(i => Number(i.id) === paid.invoiceId)).toBe(true);
    expect(paidInvoices.every(i => i.status_code === 'paid')).toBe(true);

    const allInvoices = await billing.listInvoices({ status: 'all' });
    expect(allInvoices.some(i => Number(i.id) === created.invoiceId)).toBe(true);
    expect(allInvoices.some(i => Number(i.id) === paid.invoiceId)).toBe(true);
  });

  test('batch submit marks selected created invoices as submitted', async () => {
    const first = await createInvoice({ status: 'created', title: 'Batch Submit First' });
    const second = await createInvoice({ status: 'created', title: 'Batch Submit Second' });

    await billing.batchSubmitInvoices([first.invoiceId, second.invoiceId]);

    const statuses = await db.query(
      `SELECT i.id, s.code
       FROM invoices i
       JOIN invoice_statuses s ON s.id=i.invoice_status_id
       WHERE i.id = ANY($1::int[])
       ORDER BY i.id`,
      [[first.invoiceId, second.invoiceId]],
    );

    expect(statuses.rows).toHaveLength(2);
    expect(statuses.rows.every(row => row.code === 'submitted')).toBe(true);
  });

  test('completed recurring-generated work order creates invoice but does not submit it', async () => {
    const userId = await db.firstActiveUserId();
    const prospect = await db.createProspect({ serviceLineCode: 'pools', displayName: 'Recurring Billing Customer' });

    const planId = await recurringService.createPlan({
      customer_id: prospect.customerId,
      customer_location_id: prospect.locationId,
      service_line_id: prospect.serviceLineId,
      title: 'Monthly Pool Maintenance',
      description: 'Recurring billing test visit',
      frequency: 'monthly',
      interval_count: 1,
      next_run_date: '2026-05-04',
      is_active: true,
    });

    const workOrderId = await recurringService.generateNextWorkOrder(planId, { id: userId });

    await workOrders.addLineItem(workOrderId, {
      description: 'Monthly maintenance',
      quantity: 1,
      unit_price: 125,
    });

    const invoiceId = await workOrders.transition(workOrderId, { action: 'complete' }, { id: userId });
    expect(invoiceId).toBeTruthy();

    const invoice = await db.invoiceForWorkOrder(workOrderId);
    expect(invoice.status_code).toBe('created');
  });
});
