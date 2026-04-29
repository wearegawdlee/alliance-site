require("dotenv").config();
const pool = require("../db/pool");

async function id(table, code) {
  const r = await pool.query(`SELECT id FROM ${table} WHERE code=$1`, [code]);
  if (!r.rows[0]) throw new Error(`Missing ${table}.${code}`);
  return r.rows[0].id;
}

async function run() {
  const c = await pool.connect();
  try {
    await c.query("BEGIN");
    await c.query(
      `TRUNCATE activity_events,payments,invoice_line_items,invoices,estimate_line_items,estimates,work_order_status_history,work_order_assignments,work_order_line_items,work_order_notes,work_orders,assets,customer_notes,customer_service_lines,customer_locations,customer_contacts,customer_status_history,customers,catalog_items RESTART IDENTITY CASCADE`,
    );

    const statuses = {
      prospect: await id("customer_statuses", "prospect"),
      qualified: await id("customer_statuses", "qualified_lead"),
      customer: await id("customer_statuses", "customer"),
    };
    const services = {
      garage: await id("service_lines", "garage_doors"),
      pool: await id("service_lines", "pools"),
      screens: await id("service_lines", "motorized_screens"),
    };
    const assetTypes = {
      garageDoor: await id("asset_types", "garage_door"),
      opener: await id("asset_types", "garage_opener"),
      pump: await id("asset_types", "pool_pump"),
      screenMotor: await id("asset_types", "screen_motor"),
    };
    const propertyType = await id("property_types", "single_family");
    const woStatus = await id("work_order_statuses", "scheduled");
    const estimateStatus = await id("estimate_statuses", "sent");
    const invStatus = await id("invoice_statuses", "sent");
    const website = await id("lead_sources", "website");

    const demo = [
      [
        "John Carter",
        statuses.customer,
        [services.garage],
        "404-555-1101",
        "john@example.com",
        assetTypes.garageDoor,
        "Garage Door",
      ],
      [
        "Melissa Dean",
        statuses.qualified,
        [services.garage, services.screens],
        "404-555-1102",
        "melissa@example.com",
        assetTypes.screenMotor,
        "Patio Screen Motor",
      ],
      [
        "North Ridge HOA",
        statuses.customer,
        [services.pool],
        "404-555-1103",
        "hoa@example.com",
        assetTypes.pump,
        "Community Pool Pump",
      ],
      [
        "Robert Hayes",
        statuses.prospect,
        [services.garage],
        "404-555-1104",
        "robert@example.com",
        assetTypes.opener,
        "Garage Door Opener",
      ],
    ];

    for (const d of demo) {
      const r = await c.query(
        `INSERT INTO customers(display_name,customer_status_id,lead_source_id) VALUES($1,$2,$3) RETURNING id`,
        [d[0], d[1], website],
      );
      const customerId = r.rows[0].id;
      await c.query(
        `INSERT INTO customer_status_history(customer_id,to_status_id,reason) VALUES($1,$2,'Seeded initial status')`,
        [customerId, d[1]],
      );
      await c.query(
        `INSERT INTO customer_contacts(customer_id,first_name,phone,email,is_primary) VALUES($1,$2,$3,$4,true)`,
        [customerId, d[0].split(" ")[0], d[3], d[4]],
      );
      const loc = await c.query(
        `INSERT INTO customer_locations(customer_id,property_type_id,address_line_1,city,state,postal_code,is_primary,access_notes) VALUES($1,$2,'123 Demo Street','Roswell','GA','30075',true,'Seeded location') RETURNING id`,
        [customerId, propertyType],
      );
      const locationId = loc.rows[0].id;
      for (const s of d[2])
        await c.query(
          `INSERT INTO customer_service_lines(customer_id,service_line_id) VALUES($1,$2)`,
          [customerId, s],
        );
      await c.query(
        `INSERT INTO customer_notes(customer_id,note_body) VALUES($1,'Seeded demo customer record.')`,
        [customerId],
      );
      const asset = await c.query(
        `INSERT INTO assets(customer_id,customer_location_id,service_line_id,asset_type_id,name,notes) VALUES($1,$2,$3,$4,$5,'Seeded demo asset') RETURNING id`,
        [customerId, locationId, d[2][0], d[5], d[6]],
      );
      if (d[1] !== statuses.prospect) {
        const type = await c.query(
          `SELECT id FROM work_order_types WHERE service_line_id=$1 AND code='repair'`,
          [d[2][0]],
        );
        const wo = await c.query(
          `INSERT INTO work_orders(customer_id,customer_location_id,asset_id,service_line_id,work_order_type_id,work_order_status_id,title,description,quoted_price) VALUES($1,$2,$3,$4,$5,$6,'Service Call','Demo seeded work order',325) RETURNING id`,
          [
            customerId,
            locationId,
            asset.rows[0].id,
            d[2][0],
            type.rows[0]?.id || null,
            woStatus,
          ],
        );
        await c.query(
          `INSERT INTO work_order_status_history(work_order_id,to_status_id,reason) VALUES($1,$2,'Seeded initial status')`,
          [wo.rows[0].id, woStatus],
        );
        await c.query(
          `INSERT INTO work_order_line_items(work_order_id,description,quantity,unit_price,line_total) VALUES($1,'Service Labor',1,325,325)`,
          [wo.rows[0].id],
        );
        const est = await c.query(
          `INSERT INTO estimates(customer_id,customer_location_id,work_order_id,estimate_status_id,estimate_number,subtotal,total_amount) VALUES($1,$2,$3,$4,$5,325,325) RETURNING id`,
          [
            customerId,
            locationId,
            wo.rows[0].id,
            estimateStatus,
            `EST-${1000 + customerId}`,
          ],
        );
        await c.query(
          `INSERT INTO estimate_line_items(estimate_id,description,quantity,unit_price,line_total) VALUES($1,'Service Labor',1,325,325)`,
          [est.rows[0].id],
        );
        const inv = await c.query(
          `INSERT INTO invoices(customer_id,customer_location_id,work_order_id,estimate_id,invoice_status_id,invoice_number,subtotal,total_amount) VALUES($1,$2,$3,$4,$5,$6,325,325) RETURNING id`,
          [
            customerId,
            locationId,
            wo.rows[0].id,
            est.rows[0].id,
            invStatus,
            `INV-${1000 + customerId}`,
          ],
        );
        await c.query(
          `INSERT INTO invoice_line_items(invoice_id,description,quantity,unit_price,line_total) VALUES($1,'Service Labor',1,325,325)`,
          [inv.rows[0].id],
        );
      }
    }

    await c.query(
      `INSERT INTO catalog_items(sku,name,item_type,unit_price,service_line_id) VALUES
      ('SPRING-001','Torsion Spring','part',149,$1),
      ('OPEN-100','Garage Opener Install','service',399,$1),
      ('POOL-CLN','Pool Cleaning Visit','service',95,$2),
      ('SCREEN-MOTOR','Motorized Screen Motor','part',525,$3)
      ON CONFLICT DO NOTHING`,
      [services.garage, services.pool, services.screens],
    );
    await c.query("COMMIT");
    console.log("Domain seed complete");
  } catch (e) {
    await c.query("ROLLBACK");
    throw e;
  } finally {
    c.release();
    await pool.end();
  }
}
run().catch((e) => {
  console.error(e);
  process.exit(1);
});
