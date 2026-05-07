require('dotenv').config();
const pool = require('../db/pool');

async function id(table, code) {
  const r = await pool.query(`SELECT id FROM ${table} WHERE code=$1`, [code]);
  if (!r.rows[0]) throw new Error(`Missing ${table}.${code}`);
  return r.rows[0].id;
}

async function run() {
  const c = await pool.connect();
  try {
    await c.query('BEGIN');
    await c.query(`TRUNCATE activity_events,payments,invoice_line_items,invoices,estimate_line_items,estimates,work_order_status_history,work_order_assignments,work_order_line_items,work_order_notes,work_orders,assets,customer_notes,customer_service_lines,customer_locations,customer_contacts,customer_status_history,customers,catalog_items RESTART IDENTITY CASCADE`);

    const statuses = {
      prospect: await id('customer_statuses', 'prospect'),
      qualified: await id('customer_statuses', 'qualified_lead'),
      customer: await id('customer_statuses', 'customer')
    };
    const services = {
      garage: await id('service_lines', 'garage_doors'),
      pool: await id('service_lines', 'pools'),
      screens: await id('service_lines', 'motorized_screens')
    };
    const assetTypes = {
      garageDoor: await id('asset_types', 'garage_door'),
      opener: await id('asset_types', 'garage_opener'),
      pump: await id('asset_types', 'pool_pump'),
      screenMotor: await id('asset_types', 'screen_motor')
    };
    const propertyType = await id('property_types', 'single_family');
    const woStatus = await id('work_order_statuses', 'open');
    const estimateStatus = await id('estimate_statuses', 'sent');
    const invStatus = await id('invoice_statuses', 'submitted');
    const website = await id('lead_sources', 'website');

    const demo = [
      ['John Carter', statuses.customer, [services.garage], '404-555-1101', 'john@example.com', assetTypes.garageDoor, 'Garage Door'],
      ['Melissa Dean', statuses.qualified, [services.garage, services.screens], '404-555-1102', 'melissa@example.com', assetTypes.screenMotor, 'Patio Screen Motor'],
      ['North Ridge HOA', statuses.customer, [services.pool], '404-555-1103', 'hoa@example.com', assetTypes.pump, 'Community Pool Pump'],
      ['Robert Hayes', statuses.prospect, [services.garage], '404-555-1104', 'robert@example.com', assetTypes.opener, 'Garage Door Opener']
    ];

    for (const d of demo) {
      const r = await c.query(`INSERT INTO customers(display_name,customer_status_id,lead_source_id) VALUES($1,$2,$3) RETURNING id`, [d[0], d[1], website]);
      const customerId = r.rows[0].id;
      await c.query(`INSERT INTO customer_status_history(customer_id,to_status_id,reason) VALUES($1,$2,'Seeded initial status')`, [customerId, d[1]]);
      await c.query(`INSERT INTO customer_contacts(customer_id,first_name,phone,email,is_primary) VALUES($1,$2,$3,$4,true)`, [customerId, d[0].split(' ')[0], d[3], d[4]]);
      const loc = await c.query(`INSERT INTO customer_locations(customer_id,property_type_id,address_line_1,city,state,postal_code,county,is_primary,access_notes) VALUES($1,$2,'123 Demo Street','Roswell','GA','30075','Fulton',true,'Seeded location') RETURNING id`, [customerId, propertyType]);
      const locationId = loc.rows[0].id;
      for (const s of d[2]) await c.query(`INSERT INTO customer_service_lines(customer_id,service_line_id) VALUES($1,$2)`, [customerId, s]);
      await c.query(`INSERT INTO customer_notes(customer_id,note_body) VALUES($1,'Seeded demo customer record.')`, [customerId]);
      const asset = await c.query(`INSERT INTO assets(customer_id,customer_location_id,service_line_id,asset_type_id,name,notes) VALUES($1,$2,$3,$4,$5,'Seeded demo asset') RETURNING id`, [customerId, locationId, d[2][0], d[5], d[6]]);
      if (d[1] !== statuses.prospect) {
        const type = await c.query(`SELECT id FROM work_order_types WHERE service_line_id=$1 AND code='repair'`, [d[2][0]]);
        const wo = await c.query(`INSERT INTO work_orders(customer_id,customer_location_id,asset_id,service_line_id,work_order_type_id,work_order_status_id,title,description,quoted_price) VALUES($1,$2,$3,$4,$5,$6,'Service Call','Demo seeded work order',325) RETURNING id`, [customerId, locationId, asset.rows[0].id, d[2][0], type.rows[0]?.id || null, woStatus]);
        await c.query(`INSERT INTO work_order_status_history(work_order_id,to_status_id,reason) VALUES($1,$2,'Seeded initial status')`, [wo.rows[0].id, woStatus]);
        await c.query(`INSERT INTO work_order_line_items(work_order_id,description,quantity,unit_price,line_total) VALUES($1,'Service Labor',1,325,325)`, [wo.rows[0].id]);
        const est = await c.query(`INSERT INTO estimates(customer_id,customer_location_id,work_order_id,estimate_status_id,estimate_number,subtotal,total_amount) VALUES($1,$2,$3,$4,$5,325,325) RETURNING id`, [customerId, locationId, wo.rows[0].id, estimateStatus, `EST-${1000 + customerId}`]);
        await c.query(`INSERT INTO estimate_line_items(estimate_id,description,quantity,unit_price,line_total) VALUES($1,'Service Labor',1,325,325)`, [est.rows[0].id]);
        const inv = await c.query(`INSERT INTO invoices(customer_id,customer_location_id,work_order_id,estimate_id,invoice_status_id,invoice_number,subtotal,total_amount) VALUES($1,$2,$3,$4,$5,$6,325,325) RETURNING id`, [customerId, locationId, wo.rows[0].id, est.rows[0].id, invStatus, `INV-${1000 + customerId}`]);
        await c.query(`INSERT INTO invoice_line_items(invoice_id,description,quantity,unit_price,line_total) VALUES($1,'Service Labor',1,325,325)`, [inv.rows[0].id]);
      }
    }

    const categoryIds = {};
    for (const [key, serviceId, code] of [
      ['garageSprings', services.garage, 'springs'],
      ['garageOpeners', services.garage, 'openers'],
      ['poolCleaning', services.pool, 'cleaning'],
      ['screenMotors', services.screens, 'motors']
    ]) {
      const cr = await c.query(`SELECT id FROM catalog_categories WHERE service_line_id=$1 AND code=$2`, [serviceId, code]);
      categoryIds[key] = cr.rows[0]?.id || null;
    }

    await c.query(`INSERT INTO catalog_items(sku,name,item_type,unit_price,service_line_id,catalog_category_id) VALUES
      ('SPRING-001','Torsion Spring','part',149,$1,$4),
      ('OPEN-100','Garage Opener Install','service',399,$1,$5),
      ('POOL-CLN','Monthly Pool Maintenance','service',75,$2,$6),
      ('SCREEN-MOTOR','Motorized Screen Motor','part',525,$3,$7)
      ON CONFLICT DO NOTHING`, [services.garage, services.pool, services.screens, categoryIds.garageSprings, categoryIds.garageOpeners, categoryIds.poolCleaning, categoryIds.screenMotors]);

    await c.query(`UPDATE catalog_items SET name='Monthly Pool Maintenance', unit_price=75 WHERE sku='POOL-CLN'`);

    const poolCleaningCatalog = (await c.query(`SELECT id, unit_price FROM catalog_items WHERE sku='POOL-CLN'`)).rows[0];
    if (!poolCleaningCatalog) throw new Error('Missing catalog item POOL-CLN');

    const poolGuy = (await c.query(`SELECT id FROM users WHERE email=$1`, ['zundra.daniel@gmail.com'])).rows[0];
    if (!poolGuy) throw new Error('Missing seed user zundra.daniel@gmail.com. Run db:seed:users before db:seed:domain.');

    const completedStatus = await id('work_order_statuses', 'completed');
    const poolMaintenanceType = (await c.query(`SELECT id FROM work_order_types WHERE service_line_id=$1 AND code='maintenance'`, [services.pool])).rows[0];
    const poolPumpAssetType = assetTypes.pump;
    const seededPoolCustomers = [
      { name: 'Pool Customer 1', email: 'daniel.zundra@gmail.com', phone: '404-555-2101', invoice: 'INV-POOL-1001', estimate: 'EST-POOL-1001', address: '101 Pool Route' },
      { name: 'Pool Customer 2', email: 'danieldobalina@gmail.com', phone: '404-555-2102', invoice: 'INV-POOL-1002', estimate: 'EST-POOL-1002', address: '102 Pool Route' },
      { name: 'Pool Customer 3', email: 'daniel.beezie@gmail.com', phone: '404-555-2103', invoice: 'INV-POOL-1003', estimate: 'EST-POOL-1003', address: '103 Pool Route' }
    ];
    const poolInvoiceItems = [
      { description: '4/24 - Monthly Pool Service', quantity: 1, unitPrice: 75.00, lineTotal: 75.00 },
      { description: '1 lb. Alkalinity Increaser (sodium bicarbonate)', quantity: 12, unitPrice: 1.50, lineTotal: 18.00 },
      { description: '1 lb. Calcium Chloride Flake Prill', quantity: 14, unitPrice: 2.15, lineTotal: 30.10 },
      { description: '3\" Chlorine Tablet', quantity: 4, unitPrice: 2.50, lineTotal: 10.00 },
      { description: 'Muriatic Acid - 1 gal.', quantity: 1, unitPrice: 8.00, lineTotal: 8.00 },
      { description: 'Muriatic Acid - 1 cup', quantity: 5, unitPrice: 0.00, lineTotal: 0.00 }
    ];
    const poolInvoiceTotal = poolInvoiceItems.reduce((sum, item) => sum + item.lineTotal, 0);


    for (const seeded of seededPoolCustomers) {
      const customer = await c.query(
        `INSERT INTO customers(display_name,customer_status_id,lead_source_id,assigned_user_id,notes_summary)
         VALUES($1,$2,$3,$4,'Seeded recurring pool-maintenance payment baseline customer')
         RETURNING id`,
        [seeded.name, statuses.customer, website, poolGuy.id]
      );
      const customerId = customer.rows[0].id;

      await c.query(
        `INSERT INTO customer_status_history(customer_id,to_status_id,changed_by_user_id,reason)
         VALUES($1,$2,$3,'Seeded as active customer for recurring pool-maintenance baseline')`,
        [customerId, statuses.customer, poolGuy.id]
      );
      await c.query(
        `INSERT INTO customer_contacts(customer_id,first_name,phone,email,preferred_contact_method,is_primary)
         VALUES($1,$2,$3,$4,'email',true)`,
        [customerId, seeded.name, seeded.phone, seeded.email]
      );
      const location = await c.query(
        `INSERT INTO customer_locations(customer_id,property_type_id,label,address_line_1,city,state,postal_code,county,is_primary,access_notes)
         VALUES($1,$2,'Primary Pool',$3,'Roswell','GA','30075','Fulton',true,'Seeded pool maintenance route stop')
         RETURNING id`,
        [customerId, propertyType, seeded.address]
      );
      const locationId = location.rows[0].id;

      await c.query(
        `INSERT INTO customer_service_lines(customer_id,service_line_id)
         VALUES($1,$2)
         ON CONFLICT DO NOTHING`,
        [customerId, services.pool]
      );
      await c.query(
        `INSERT INTO customer_notes(customer_id,author_user_id,note_body)
         VALUES($1,$2,'Seeded baseline: recurring pool maintenance customer with completed work order and unpaid invoice.')`,
        [customerId, poolGuy.id]
      );
      const asset = await c.query(
        `INSERT INTO assets(customer_id,customer_location_id,service_line_id,asset_type_id,name,notes)
         VALUES($1,$2,$3,$4,'Residential Pool','Seeded recurring pool maintenance asset')
         RETURNING id`,
        [customerId, locationId, services.pool, poolPumpAssetType]
      );

      const plan = await c.query(
        `INSERT INTO recurring_service_plans(customer_id,customer_location_id,service_line_id,work_order_type_id,assigned_user_id,title,description,frequency,interval_count,day_of_week,next_run_date,is_active)
         VALUES($1,$2,$3,$4,$5,'Weekly Pool Maintenance','Seeded weekly pool maintenance baseline','weekly',1,1,current_date + interval '7 days',true)
         RETURNING id`,
        [customerId, locationId, services.pool, poolMaintenanceType?.id || null, poolGuy.id]
      );

      const workOrder = await c.query(
        `INSERT INTO work_orders(customer_id,customer_location_id,asset_id,service_line_id,work_order_type_id,work_order_status_id,title,description,scheduled_start_at,scheduled_end_at,quoted_price,final_price)
         VALUES($1,$2,$3,$4,$5,$6,'Monthly Pool Maintenance','Seeded completed monthly pool maintenance visit',current_timestamp - interval '1 day',current_timestamp - interval '23 hours',$7,$7)
         RETURNING id`,
        [customerId, locationId, asset.rows[0].id, services.pool, poolMaintenanceType?.id || null, completedStatus, poolInvoiceTotal]
      );
      const workOrderId = workOrder.rows[0].id;

      await c.query(`INSERT INTO work_order_assignments(work_order_id,user_id) VALUES($1,$2)`, [workOrderId, poolGuy.id]);
      await c.query(
        `INSERT INTO work_order_status_history(work_order_id,to_status_id,changed_by_user_id,reason)
         VALUES($1,$2,$3,'Seeded completed status for pool-maintenance payment baseline')`,
        [workOrderId, completedStatus, poolGuy.id]
      );
      for (const [index, item] of poolInvoiceItems.entries()) {
        await c.query(
          `INSERT INTO work_order_line_items(work_order_id,catalog_item_id,description,quantity,unit_price,line_total,sort_order)
           VALUES($1,$2,$3,$4,$5,$6,$7)`,
          [workOrderId, index === 0 ? poolCleaningCatalog.id : null, item.description, item.quantity, item.unitPrice, item.lineTotal, index + 1]
        );
      }
      await c.query(
        `INSERT INTO recurring_service_plan_runs(recurring_service_plan_id,work_order_id,scheduled_for,created_by_user_id)
         VALUES($1,$2,current_date,$3)`,
        [plan.rows[0].id, workOrderId, poolGuy.id]
      );

      const estimate = await c.query(
        `INSERT INTO estimates(customer_id,customer_location_id,work_order_id,estimate_status_id,estimate_number,issue_date,subtotal,taxable_amount,tax_rate,tax_amount,total_amount,notes)
         VALUES($1,$2,$3,$4,$5,current_date,$6,0,0,0,$6,'Seeded baseline estimate for recurring pool maintenance')
         RETURNING id`,
        [customerId, locationId, workOrderId, estimateStatus, seeded.estimate, poolInvoiceTotal]
      );
      for (const [index, item] of poolInvoiceItems.entries()) {
        await c.query(
          `INSERT INTO estimate_line_items(estimate_id,catalog_item_id,description,quantity,unit_price,line_total)
           VALUES($1,$2,$3,$4,$5,$6)`,
          [estimate.rows[0].id, index === 0 ? poolCleaningCatalog.id : null, item.description, item.quantity, item.unitPrice, item.lineTotal]
        );
      }

      const invoice = await c.query(
        `INSERT INTO invoices(customer_id,customer_location_id,work_order_id,estimate_id,invoice_status_id,invoice_number,issue_date,due_date,submitted_at,subtotal,taxable_amount,tax_rate,tax_amount,total_amount,balance_due,notes)
         VALUES($1,$2,$3,$4,$5,$6,current_date,current_date + interval '14 days',current_timestamp,$7,0,0,0,$7,$7,'Seeded unpaid invoice for recurring pool maintenance payment testing')
         RETURNING id`,
        [customerId, locationId, workOrderId, estimate.rows[0].id, invStatus, seeded.invoice, poolInvoiceTotal]
      );
      for (const [index, item] of poolInvoiceItems.entries()) {
        await c.query(
          `INSERT INTO invoice_line_items(invoice_id,catalog_item_id,description,quantity,unit_price,line_total)
           VALUES($1,$2,$3,$4,$5,$6)`,
          [invoice.rows[0].id, index === 0 ? poolCleaningCatalog.id : null, item.description, item.quantity, item.unitPrice, item.lineTotal]
        );
      }
      await c.query(
        `INSERT INTO activity_events(entity_type,entity_id,actor_user_id,event_type,event_body,metadata)
         VALUES('work_order',$1,$2,'seed.pool_baseline','Seeded completed recurring pool maintenance work order',$3)`,
        [workOrderId, poolGuy.id, JSON.stringify({ customer: seeded.name, invoice: seeded.invoice, catalogSku: 'POOL-CLN' })]
      );
    }

    await c.query('COMMIT');
    console.log('Domain seed complete');
  } catch(e) {
    await c.query('ROLLBACK');
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}
run().catch(e => { console.error(e); process.exit(1); });
