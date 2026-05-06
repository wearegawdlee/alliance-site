const db = require('./helpers/db');
const workOrders = require('../modules/workOrders/service');
const customers = require('../modules/customers/service');

async function createCatalogItem(serviceLineId, { name = 'Weekly Pool Service', price = 70 } = {}) {
  const result = await db.query(
    `INSERT INTO catalog_items(service_line_id,sku,name,item_type,unit_price,is_active)
     VALUES($1,$2,$3,'service',$4,true)
     RETURNING id`,
    [serviceLineId, `TEST-${Date.now()}-${Math.floor(Math.random() * 10000)}`, name, price],
  );
  return result.rows[0].id;
}

describe('customer pricing overrides', () => {
  test('work order line item uses customer-specific price when present', async () => {
    const userId = await db.firstActiveUserId();
    const prospect = await db.createProspect({ serviceLineCode: 'pools', displayName: 'Customer Pricing Override Test' });
    const catalogItemId = await createCatalogItem(prospect.serviceLineId, { price: 70 });

    await customers.upsertCustomerPricing(
      prospect.customerId,
      { catalog_item_id: catalogItemId, override_unit_price: 55, reason: 'Existing agreed weekly pool rate' },
      { id: userId },
    );

    const workOrderId = await db.createOpenWorkOrder({ customerId: prospect.customerId, serviceLineId: prospect.serviceLineId, userId });
    await workOrders.addLineItem(workOrderId, { catalog_item_id: catalogItemId, quantity: 1 });

    const item = await db.query(
      `SELECT unit_price,line_total FROM work_order_line_items WHERE work_order_id=$1 AND catalog_item_id=$2`,
      [workOrderId, catalogItemId],
    );

    expect(Number(item.rows[0].unit_price)).toBe(55);
    expect(Number(item.rows[0].line_total)).toBe(55);
  });

  test('work order line item falls back to catalog price without override', async () => {
    const userId = await db.firstActiveUserId();
    const prospect = await db.createProspect({ serviceLineCode: 'pools', displayName: 'Catalog Price Fallback Test' });
    const catalogItemId = await createCatalogItem(prospect.serviceLineId, { price: 70 });

    const workOrderId = await db.createOpenWorkOrder({ customerId: prospect.customerId, serviceLineId: prospect.serviceLineId, userId });
    await workOrders.addLineItem(workOrderId, { catalog_item_id: catalogItemId, quantity: 1 });

    const item = await db.query(
      `SELECT unit_price,line_total FROM work_order_line_items WHERE work_order_id=$1 AND catalog_item_id=$2`,
      [workOrderId, catalogItemId],
    );

    expect(Number(item.rows[0].unit_price)).toBe(70);
    expect(Number(item.rows[0].line_total)).toBe(70);
  });

  test('work order detail exposes effective customer price to the picker', async () => {
    const userId = await db.firstActiveUserId();
    const prospect = await db.createProspect({ serviceLineCode: 'pools', displayName: 'Picker Pricing Test' });
    const catalogItemId = await createCatalogItem(prospect.serviceLineId, { price: 70 });

    await customers.upsertCustomerPricing(
      prospect.customerId,
      { catalog_item_id: catalogItemId, override_unit_price: 55, reason: 'Existing agreed weekly pool rate' },
      { id: userId },
    );

    const workOrderId = await db.createOpenWorkOrder({ customerId: prospect.customerId, serviceLineId: prospect.serviceLineId, userId });
    const detail = await workOrders.getWorkOrderDetail(workOrderId);
    const pickerItem = detail.catalogItems.find((item) => Number(item.id) === Number(catalogItemId));

    expect(pickerItem).toBeTruthy();
    expect(Number(pickerItem.unit_price)).toBe(70);
    expect(Number(pickerItem.effective_unit_price)).toBe(55);
    expect(pickerItem.has_customer_price).toBe(true);
  });
});
