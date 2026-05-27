const customers = require('../modules/customers/service');
const workOrders = require('../modules/workOrders/service');
const billing = require('../modules/billing/service');
const {
  pool,
  getId,
  firstActiveUserId,
  createProspect,
  createOpenWorkOrder,
  invoiceForWorkOrder,
} = require('./helpers/db');

function n(value) {
  return Number(value);
}

describe('customer → work order → invoice flow', () => {
  test('creating a work order converts a prospect to a customer and does not require scheduling', async () => {
    const userId = await firstActiveUserId();
    const { customerId, serviceLineId } = await createProspect({ displayName: 'Prospect Conversion Test' });

    const workOrderId = await createOpenWorkOrder({ customerId, serviceLineId, userId });

    const customer = await pool.query(
      `SELECT cs.code
       FROM customers c
       JOIN customer_statuses cs ON cs.id=c.customer_status_id
       WHERE c.id=$1`,
      [customerId],
    );
    const workOrder = await workOrders.getWorkOrderDetail(workOrderId);

    expect(customer.rows[0].code).toBe('customer');
    expect(workOrder.status_code).toBe('open');
    expect(workOrder.scheduled_start_at).toBeNull();
  });

  test('completing a work order without line items does not create an invoice', async () => {
    const userId = await firstActiveUserId();
    const { customerId, serviceLineId } = await createProspect({ displayName: 'No Line Items Test' });
    const workOrderId = await createOpenWorkOrder({ customerId, serviceLineId, userId });

    const invoiceId = await workOrders.transition(workOrderId, { action: 'complete' }, { id: userId });
    const invoice = await invoiceForWorkOrder(workOrderId);
    const detail = await workOrders.getWorkOrderDetail(workOrderId);

    expect(invoiceId).toBeNull();
    expect(invoice).toBeNull();
    expect(detail.status_code).toBe('completed');
  });

  test('completing a work order creates one invoice and completing again regenerates the same invoice', async () => {
    const userId = await firstActiveUserId();
    const { customerId, serviceLineId } = await createProspect({ displayName: 'Single Invoice Test' });
    const workOrderId = await createOpenWorkOrder({ customerId, serviceLineId, userId });

    await workOrders.addLineItem(workOrderId, {
      description: 'Initial labor',
      quantity: 1,
      unit_price: 100,
    });

    const firstInvoiceId = await workOrders.transition(workOrderId, { action: 'complete' }, { id: userId });
    expect(firstInvoiceId).toBeTruthy();

    await workOrders.addLineItem(workOrderId, {
      description: 'Additional part',
      quantity: 1,
      unit_price: 50,
    });

    const secondInvoiceId = await workOrders.transition(workOrderId, { action: 'complete' }, { id: userId });
    const count = await pool.query(`SELECT COUNT(*)::int AS count FROM invoices WHERE work_order_id=$1`, [workOrderId]);
    const invoice = await invoiceForWorkOrder(workOrderId);

    expect(secondInvoiceId).toBe(firstInvoiceId);
    expect(count.rows[0].count).toBe(1);
    expect(n(invoice.subtotal)).toBe(150);
  });

  test('tax, percent discount, and deposit are snapshotted into invoice totals', async () => {
    const userId = await firstActiveUserId();
    const { customerId, serviceLineId } = await createProspect({ displayName: 'Invoice Math Test', county: 'Fulton', city: 'Roswell' });
    const workOrderId = await createOpenWorkOrder({ customerId, serviceLineId, userId });

    await workOrders.addLineItem(workOrderId, {
      description: 'Service package',
      quantity: 2,
      unit_price: 100,
    });

    await workOrders.updateWorkOrder(
      workOrderId,
      {
        discount_type: 'military',
        discount_value_type: 'percent',
        discount_percent: '10',
        deposit_amount: '50',
        deposit_note: 'Test deposit',
      },
      { id: userId },
    );

    const invoiceId = await workOrders.transition(workOrderId, { action: 'complete' }, { id: userId });
    const detail = await billing.getInvoiceDetail(invoiceId);
    const invoice = detail.invoice;

    expect(n(invoice.subtotal)).toBe(200);
    expect(n(invoice.discount_amount)).toBe(20);
    expect(n(invoice.taxable_amount)).toBe(180);
    expect(n(invoice.tax_rate)).toBe(0.0775);
    expect(n(invoice.tax_amount)).toBe(13.95);
    expect(n(invoice.total_amount)).toBe(193.95);
    expect(n(invoice.deposit_amount)).toBe(50);
    expect(n(invoice.balance_due)).toBe(143.95);
    expect(invoice.discount_type).toBe('military');
  });

  test('paid invoices lock both invoice and associated work order', async () => {
    const userId = await firstActiveUserId();
    const { customerId, serviceLineId } = await createProspect({ displayName: 'Paid Lock Test' });
    const workOrderId = await createOpenWorkOrder({ customerId, serviceLineId, userId });
    const paymentMethodId = await getId('payment_methods', 'cash');

    await workOrders.addLineItem(workOrderId, {
      description: 'Completed service',
      quantity: 1,
      unit_price: 100,
    });

    const invoiceId = await workOrders.transition(workOrderId, { action: 'complete' }, { id: userId });
    await billing.submitInvoice(invoiceId);
    const paidInvoice = await billing.recordPayment(invoiceId, {
      payment_method_id: paymentMethodId,
      amount: 107.75,
      notes: 'Paid in full test',
    });

    expect(paidInvoice.status_code).toBe('paid');
    await expect(
      workOrders.addLineItem(workOrderId, {
        description: 'Should fail',
        quantity: 1,
        unit_price: 1,
      }),
    ).rejects.toThrow(/locked|paid/i);
    await expect(
      workOrders.transition(workOrderId, { action: 'complete' }, { id: userId }),
    ).rejects.toThrow(/locked|paid/i);
  });

  test('cancelled work orders cannot be completed afterward', async () => {
    const userId = await firstActiveUserId();
    const { customerId, serviceLineId } = await createProspect({ displayName: 'Cancel Final Test' });
    const workOrderId = await createOpenWorkOrder({ customerId, serviceLineId, userId });

    await workOrders.transition(workOrderId, { action: 'cancel' }, { id: userId });

    await expect(
      workOrders.transition(workOrderId, { action: 'complete' }, { id: userId }),
    ).rejects.toThrow(/Invalid work order transition/i);
  });
});
