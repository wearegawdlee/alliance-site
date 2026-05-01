const db = require('./helpers/db');
const catalogService = require('../modules/catalog/service');
const workOrderRepository = require('../modules/workOrders/repository');

describe('catalog categories', () => {
  async function serviceLine(code) {
    const result = await db.query('SELECT id FROM service_lines WHERE code=$1', [code]);
    return result.rows[0].id;
  }

  async function firstWorkOrderForServiceLine(serviceLineId) {
    const result = await db.query(
      'SELECT id FROM work_orders WHERE service_line_id=$1 ORDER BY id LIMIT 1',
      [serviceLineId],
    );
    return result.rows[0].id;
  }

  test('category can be created under a service line', async () => {
    const garageId = await serviceLine('garage_doors');
    const categoryId = await catalogService.createCatalogCategory({
      service_line_id: garageId,
      code: 'test_accessories',
      name: 'Test Accessories',
      description: 'Test category',
      sort_order: 999,
      is_active: '1',
    });

    const result = await db.query(
      'SELECT * FROM catalog_categories WHERE id=$1',
      [categoryId],
    );

    expect(result.rows[0]).toMatchObject({
      service_line_id: garageId,
      code: 'test_accessories',
      name: 'Test Accessories',
      is_active: true,
    });
  });

  test('catalog item can be assigned to a category and filtered by category', async () => {
    const garageId = await serviceLine('garage_doors');
    const categoryId = await catalogService.createCatalogCategory({
      service_line_id: garageId,
      code: 'test_springs',
      name: 'Test Springs',
      sort_order: 1000,
      is_active: '1',
    });

    const itemId = await catalogService.createCatalogItem({
      service_line_id: garageId,
      catalog_category_id: categoryId,
      sku: 'TEST-SPRING-001',
      name: 'Test Spring Replacement',
      item_type: 'part',
      unit_price: 199,
      cost: 50,
      is_active: '1',
    });

    const items = await catalogService.listCatalogItems({ catalog_category_id: categoryId });

    expect(items.map((i) => i.id)).toContain(itemId);
    expect(items.find((i) => i.id === itemId).category_name).toBe('Test Springs');
  });

  test('work order catalog picker includes matching service-line category items and uncategorized items', async () => {
    const garageId = await serviceLine('garage_doors');
    const workOrderId = await firstWorkOrderForServiceLine(garageId);

    const categoryId = await catalogService.createCatalogCategory({
      service_line_id: garageId,
      code: 'test_wo_picker',
      name: 'Test WO Picker',
      sort_order: 1001,
      is_active: '1',
    });

    const categorizedItemId = await catalogService.createCatalogItem({
      service_line_id: garageId,
      catalog_category_id: categoryId,
      sku: 'TEST-WO-CAT',
      name: 'Categorized Work Order Item',
      item_type: 'service',
      unit_price: 125,
      is_active: '1',
    });

    const uncategorizedItemId = await catalogService.createCatalogItem({
      service_line_id: garageId,
      catalog_category_id: '',
      sku: 'TEST-WO-UNCAT',
      name: 'Uncategorized Work Order Item',
      item_type: 'service',
      unit_price: 75,
      is_active: '1',
    });

    const detail = await workOrderRepository.getWorkOrderDetail(workOrderId);
    const pickerIds = detail.catalogItems.map((i) => i.id);

    expect(pickerIds).toContain(categorizedItemId);
    expect(pickerIds).toContain(uncategorizedItemId);
    expect(detail.catalogCategories.map((c) => c.id)).toContain(categoryId);
  });

  test('inactive categories hide their items from work order picker', async () => {
    const garageId = await serviceLine('garage_doors');
    const workOrderId = await firstWorkOrderForServiceLine(garageId);

    const categoryId = await catalogService.createCatalogCategory({
      service_line_id: garageId,
      code: 'test_inactive_category',
      name: 'Test Inactive Category',
      sort_order: 1002,
      is_active: '1',
    });

    const itemId = await catalogService.createCatalogItem({
      service_line_id: garageId,
      catalog_category_id: categoryId,
      sku: 'TEST-HIDDEN-CAT',
      name: 'Hidden Category Item',
      item_type: 'part',
      unit_price: 33,
      is_active: '1',
    });

    await catalogService.updateCatalogCategory(categoryId, {
      service_line_id: garageId,
      code: 'test_inactive_category',
      name: 'Test Inactive Category',
      sort_order: 1002,
      is_active: '',
    });

    const detail = await workOrderRepository.getWorkOrderDetail(workOrderId);
    expect(detail.catalogItems.map((i) => i.id)).not.toContain(itemId);
    expect(detail.catalogCategories.map((c) => c.id)).not.toContain(categoryId);
  });

  test('inactive items are excluded from work order picker', async () => {
    const garageId = await serviceLine('garage_doors');
    const workOrderId = await firstWorkOrderForServiceLine(garageId);

    const categoryId = await catalogService.createCatalogCategory({
      service_line_id: garageId,
      code: 'test_inactive_item_category',
      name: 'Test Inactive Item Category',
      sort_order: 1003,
      is_active: '1',
    });

    const itemId = await catalogService.createCatalogItem({
      service_line_id: garageId,
      catalog_category_id: categoryId,
      sku: 'TEST-HIDDEN-ITEM',
      name: 'Hidden Inactive Item',
      item_type: 'part',
      unit_price: 44,
      is_active: '',
    });

    const detail = await workOrderRepository.getWorkOrderDetail(workOrderId);
    expect(detail.catalogItems.map((i) => i.id)).not.toContain(itemId);
  });
});
