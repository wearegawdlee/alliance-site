const pool = require('../../db/pool');

function normalizeLike(value) {
  const q = String(value || '').trim();
  return q ? `%${q}%` : null;
}

async function listWorkOrders(filters = {}) {
  const params = [];
  const where = [];
  const search = normalizeLike(filters.search);
  if (search) {
    params.push(search);
    where.push(`(
      wo.title ILIKE $${params.length}
      OR wo.description ILIKE $${params.length}
      OR c.display_name ILIKE $${params.length}
      OR cl.city ILIKE $${params.length}
      OR cl.state ILIKE $${params.length}
      OR sl.name ILIKE $${params.length}
      OR wot.name ILIKE $${params.length}
      OR a.name ILIKE $${params.length}
    )`);
  }
  if (filters.status_id) { params.push(Number(filters.status_id)); where.push(`wo.work_order_status_id = $${params.length}`); }
  if (filters.service_line_id) { params.push(Number(filters.service_line_id)); where.push(`wo.service_line_id = $${params.length}`); }
  if (filters.service_line_ids && filters.service_line_ids.length) { params.push(filters.service_line_ids.map(Number)); where.push(`wo.service_line_id = ANY($${params.length}::int[])`); }
  if (filters.assigned_user_id) {
    if (filters.assigned_user_id === 'unassigned') where.push(`NOT EXISTS (SELECT 1 FROM work_order_assignments ax WHERE ax.work_order_id = wo.id)`);
    else { params.push(Number(filters.assigned_user_id)); where.push(`EXISTS (SELECT 1 FROM work_order_assignments ax WHERE ax.work_order_id = wo.id AND ax.user_id = $${params.length})`); }
  }
  const r = await pool.query(`
    SELECT wo.id,wo.title,wo.scheduled_start_at,wo.quoted_price,wo.final_price,
      c.display_name customer,wos.code status_code,wos.name status,sl.name service_line,wot.name work_order_type,
      cl.city,cl.state,a.name asset,
      string_agg(DISTINCT u.display_name, ', ' ORDER BY u.display_name) assigned_to,
      COALESCE(li.item_count,0)::int item_count,COALESCE(li.item_total,0)::numeric(10,2) item_total,
      inv.id invoice_id, inv.invoice_number, invs.code invoice_status_code, invs.name invoice_status
    FROM work_orders wo
    JOIN customers c ON c.id=wo.customer_id
    JOIN customer_locations cl ON cl.id=wo.customer_location_id
    JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
    JOIN service_lines sl ON sl.id=wo.service_line_id
    LEFT JOIN work_order_types wot ON wot.id=wo.work_order_type_id
    LEFT JOIN assets a ON a.id=wo.asset_id
    LEFT JOIN work_order_assignments woa ON woa.work_order_id=wo.id
    LEFT JOIN users u ON u.id=woa.user_id
    LEFT JOIN invoices inv ON inv.work_order_id=wo.id
    LEFT JOIN invoice_statuses invs ON invs.id=inv.invoice_status_id
    LEFT JOIN (SELECT work_order_id, COUNT(*)::int item_count, SUM(line_total)::numeric(10,2) item_total FROM work_order_line_items GROUP BY work_order_id) li ON li.work_order_id=wo.id
    ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
    GROUP BY wo.id,wo.title,wo.scheduled_start_at,wo.quoted_price,wo.final_price,c.display_name,wos.code,wos.name,sl.name,wot.name,cl.city,cl.state,a.name,li.item_count,li.item_total,inv.id,inv.invoice_number,invs.code,invs.name
    ORDER BY COALESCE(wo.scheduled_start_at,wo.created_at) DESC`, params);
  return r.rows;
}

async function getWorkOrderFilters() {
  const [statuses, serviceLines, users] = await Promise.all([
    pool.query(`SELECT id, code, name FROM work_order_statuses WHERE is_active=true ORDER BY sort_order`),
    pool.query(`SELECT id, name FROM service_lines WHERE is_active=true ORDER BY name`),
    pool.query(`SELECT id, display_name FROM users WHERE is_active=true ORDER BY display_name`)
  ]);
  return { statuses: statuses.rows, serviceLines: serviceLines.rows, users: users.rows };
}

async function getWorkOrderDetail(id) {
  const wr = await pool.query(`
    SELECT wo.*,c.display_name customer,wos.code status_code,wos.name status,sl.name service_line,wot.name work_order_type,
      cl.label location_label,cl.address_line_1,cl.city,cl.state,cl.postal_code,a.name asset,
      inv.id invoice_id, inv.invoice_number, invs.code invoice_status_code, invs.name invoice_status
    FROM work_orders wo
    JOIN customers c ON c.id=wo.customer_id
    JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
    JOIN service_lines sl ON sl.id=wo.service_line_id
    JOIN customer_locations cl ON cl.id=wo.customer_location_id
    LEFT JOIN work_order_types wot ON wot.id=wo.work_order_type_id
    LEFT JOIN assets a ON a.id=wo.asset_id
    LEFT JOIN invoices inv ON inv.work_order_id=wo.id
    LEFT JOIN invoice_statuses invs ON invs.id=inv.invoice_status_id
    WHERE wo.id=$1`, [id]);
  if (!wr.rows[0]) return null;
  const serviceLineId = wr.rows[0].service_line_id;
  const [statuses, users, assignments, notes, history, invoices, lineItems, catalogItems, catalogCategories] = await Promise.all([
    pool.query(`SELECT id,code,name FROM work_order_statuses WHERE is_active=true ORDER BY sort_order`),
    pool.query(`SELECT DISTINCT u.id,u.display_name FROM users u JOIN user_roles ur ON ur.user_id=u.id JOIN roles r ON r.id=ur.role_id LEFT JOIN user_service_lines usl ON usl.user_id=u.id WHERE u.is_active=true AND r.code IN ('technician','garage_technician','pool_technician','screen_technician') AND (usl.service_line_id=$1 OR NOT EXISTS (SELECT 1 FROM user_service_lines x WHERE x.user_id=u.id)) ORDER BY u.display_name`, [serviceLineId]),
    pool.query(`SELECT woa.*,u.display_name FROM work_order_assignments woa JOIN users u ON u.id=woa.user_id WHERE woa.work_order_id=$1 ORDER BY woa.id`, [id]),
    pool.query(`SELECT won.*,u.display_name author FROM work_order_notes won LEFT JOIN users u ON u.id=won.author_user_id WHERE won.work_order_id=$1 ORDER BY won.created_at DESC`, [id]),
    pool.query(`SELECT h.*,fs.name from_status,ts.name to_status,u.display_name changed_by FROM work_order_status_history h LEFT JOIN work_order_statuses fs ON fs.id=h.from_status_id JOIN work_order_statuses ts ON ts.id=h.to_status_id LEFT JOIN users u ON u.id=h.changed_by_user_id WHERE h.work_order_id=$1 ORDER BY h.created_at DESC`, [id]),
    pool.query(`SELECT i.*,s.code status_code,s.name status FROM invoices i JOIN invoice_statuses s ON s.id=i.invoice_status_id WHERE i.work_order_id=$1 ORDER BY i.created_at DESC`, [id]),
    pool.query(`SELECT woli.*, ci.sku, ci.name catalog_name, ci.item_type, cc.name category_name FROM work_order_line_items woli LEFT JOIN catalog_items ci ON ci.id=woli.catalog_item_id LEFT JOIN catalog_categories cc ON cc.id=ci.catalog_category_id WHERE woli.work_order_id=$1 ORDER BY woli.sort_order, woli.id`, [id]),
    pool.query(`SELECT ci.id, ci.sku, ci.name, ci.item_type, ci.unit_price, COALESCE(cp.override_unit_price, ci.unit_price) effective_unit_price, (cp.id IS NOT NULL) has_customer_price, cp.reason customer_price_reason, ci.catalog_category_id, cc.name category_name, sl.name service_line FROM catalog_items ci LEFT JOIN catalog_categories cc ON cc.id=ci.catalog_category_id LEFT JOIN service_lines sl ON sl.id=ci.service_line_id LEFT JOIN customer_pricing cp ON cp.catalog_item_id=ci.id AND cp.customer_id=$2 AND cp.is_active=true WHERE ci.is_active=true AND (ci.service_line_id=$1 OR ci.service_line_id IS NULL) AND (ci.catalog_category_id IS NULL OR cc.is_active=true) ORDER BY cc.sort_order NULLS LAST, cc.name NULLS LAST, ci.name`, [serviceLineId, wr.rows[0].customer_id]),
    pool.query(`SELECT id, service_line_id, code, name FROM catalog_categories WHERE is_active=true AND service_line_id=$1 ORDER BY sort_order, name`, [serviceLineId])
  ]);
  const lineItemTotal = lineItems.rows.reduce((sum, item) => sum + Number(item.line_total || 0), 0);
  return { ...wr.rows[0], statuses: statuses.rows, users: users.rows, assignments: assignments.rows, notes: notes.rows, history: history.rows, invoices: invoices.rows, lineItems: lineItems.rows, catalogItems: catalogItems.rows, catalogCategories: catalogCategories.rows, lineItemTotal, isLocked: invoices.rows.some((i) => i.status_code === 'paid') };
}

async function getStatusId(client, code) { const r = await client.query(`SELECT id FROM work_order_statuses WHERE code=$1`, [code]); return r.rows[0]?.id; }
async function getInvoiceStatusId(client, code) { const r = await client.query(`SELECT id FROM invoice_statuses WHERE code=$1`, [code]); return r.rows[0]?.id; }
async function assertWorkOrderMutable(client, id) {
  const paid = await client.query(`SELECT 1 FROM invoices i JOIN invoice_statuses s ON s.id=i.invoice_status_id WHERE i.work_order_id=$1 AND s.code='paid' LIMIT 1`, [id]);
  if (paid.rows[0]) throw new Error('This work order is locked because the invoice has been paid.');
}

async function updateWorkOrder(id, data, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assertWorkOrderMutable(client, id);
    const cur = await client.query(`SELECT work_order_status_id FROM work_orders WHERE id=$1`, [id]);
    if (!cur.rows[0]) throw new Error('Work order not found');
    await client.query(`
      UPDATE work_orders
      SET scheduled_start_at=$1,
          scheduled_end_at=$2,
          quoted_price=$3,
          final_price=$4,
          discount_type=$5,
          discount_value_type=$6,
          discount_percent=$7,
          discount_amount=$8,
          discount_reason=$9,
          deposit_amount=$10,
          deposit_note=$11,
          updated_at=current_timestamp
      WHERE id=$12
    `, [
      data.scheduled_start_at || null,
      data.scheduled_end_at || null,
      data.quoted_price || null,
      data.final_price || null,
      data.discount_type || null,
      data.discount_value_type || 'flat',
      data.discount_percent || 0,
      data.discount_amount || 0,
      data.discount_reason || null,
      data.deposit_amount || 0,
      data.deposit_note || null,
      id,
    ]);
    await client.query(`DELETE FROM work_order_assignments WHERE work_order_id=$1`, [id]);
    if (data.assigned_user_id) await client.query(`INSERT INTO work_order_assignments(work_order_id,user_id,role_on_job) VALUES($1,$2,'technician')`, [id, data.assigned_user_id]);
    if (data.reason) await client.query(`INSERT INTO work_order_notes(work_order_id,author_user_id,note_body) VALUES($1,$2,$3)`, [id, userId || null, data.reason]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function transition(id, action, userId, reason) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assertWorkOrderMutable(client, id);
    const cur = await client.query(`SELECT wo.work_order_status_id,wos.code status_code FROM work_orders wo JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id WHERE wo.id=$1`, [id]);
    if (!cur.rows[0]) throw new Error('Work order not found');
    const current = cur.rows[0].status_code;
    let code = null;
    if (action === 'complete' && (current === 'open' || current === 'completed')) code = 'completed';
    if (action === 'cancel' && current === 'open') code = 'cancelled';
    if (!code) throw new Error(`Invalid work order transition: ${current} -> ${action}`);
    const toId = await getStatusId(client, code);
    await client.query(`UPDATE work_orders SET work_order_status_id=$1,updated_at=current_timestamp WHERE id=$2`, [toId, id]);
    await client.query(`INSERT INTO work_order_status_history(work_order_id,from_status_id,to_status_id,changed_by_user_id,reason) VALUES($1,$2,$3,$4,$5)`, [id, cur.rows[0].work_order_status_id, toId, userId || null, reason || `Workflow transition: ${action}`]);
    let invoiceId = null;
    if (action === 'complete') invoiceId = await syncInvoiceForWorkOrder(client, id, userId, reason);
    await client.query('COMMIT');
    return invoiceId;
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function addNote(id, userId, note) { await pool.query(`INSERT INTO work_order_notes(work_order_id,author_user_id,note_body) VALUES($1,$2,$3)`, [id, userId || null, note]); }

async function addLineItem(id, data) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assertWorkOrderMutable(client, id);
    const qty = Number(data.quantity || 1);
    let description = data.description || null;
    let unitPrice = data.unit_price === undefined || data.unit_price === null || data.unit_price === '' ? null : Number(data.unit_price);
    const catalogItemId = data.catalog_item_id || null;

    if (catalogItemId) {
      const item = (await client.query(`
        SELECT ci.name, ci.unit_price, COALESCE(cp.override_unit_price, ci.unit_price) effective_unit_price
        FROM catalog_items ci
        JOIN work_orders wo ON wo.id=$1
        LEFT JOIN customer_pricing cp
          ON cp.catalog_item_id=ci.id
         AND cp.customer_id=wo.customer_id
         AND cp.is_active=true
        WHERE ci.id=$2
      `, [id, catalogItemId])).rows[0];
      if (!item) throw new Error('Catalog item not found.');
      description = description || item.name;
      if (unitPrice === null) unitPrice = Number(item.effective_unit_price || 0);
    }

    description = description || 'Custom item';
    unitPrice = unitPrice === null ? 0 : unitPrice;
    const lineTotal = Number((qty * unitPrice).toFixed(2));

    await client.query(`
      INSERT INTO work_order_line_items(work_order_id,catalog_item_id,description,quantity,unit_price,line_total,sort_order)
      VALUES($1,$2,$3,$4,$5,$6,COALESCE((SELECT MAX(sort_order)+1 FROM work_order_line_items WHERE work_order_id=$1),0))
    `, [id, catalogItemId, description, qty, unitPrice, lineTotal]);
    await client.query('COMMIT');
  } catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

async function deleteLineItem(workOrderId, lineItemId) {
  const client = await pool.connect();
  try { await client.query('BEGIN'); await assertWorkOrderMutable(client, workOrderId); await client.query(`DELETE FROM work_order_line_items WHERE id=$1 AND work_order_id=$2`, [lineItemId, workOrderId]); await client.query('COMMIT'); }
  catch (e) { await client.query('ROLLBACK'); throw e; } finally { client.release(); }
}

function roundMoney(value) {
  return Number(Number(value || 0).toFixed(2));
}

function calculateDiscount(wo, subtotal) {
  const type = wo.discount_type || null;
  const valueType = wo.discount_value_type === 'percent' ? 'percent' : 'flat';
  const percent = Number(wo.discount_percent || 0);
  const flatAmount = Number(wo.discount_amount || 0);

  if (!type || type === 'none') {
    return { discountType: null, discountValueType: 'flat', discountPercent: 0, discountAmount: 0 };
  }

  if (valueType === 'percent') {
    const safePercent = Math.max(0, Math.min(100, percent));
    return {
      discountType: type,
      discountValueType: 'percent',
      discountPercent: safePercent,
      discountAmount: roundMoney(subtotal * (safePercent / 100)),
    };
  }

  return {
    discountType: type,
    discountValueType: 'flat',
    discountPercent: 0,
    discountAmount: roundMoney(Math.max(0, Math.min(subtotal, flatAmount))),
  };
}

async function findTaxRateForWorkOrder(client, workOrderId) {
  const result = await client.query(`
    SELECT tr.*
    FROM work_orders wo
    JOIN customer_locations cl ON cl.id=wo.customer_location_id
    JOIN tax_rates tr
      ON tr.state=UPPER(COALESCE(NULLIF(cl.state,''),'GA'))
     AND tr.is_active=true
     AND tr.effective_start_date <= current_date
     AND (tr.effective_end_date IS NULL OR tr.effective_end_date >= current_date)
    WHERE wo.id=$1
      AND (
        (tr.postal_code IS NOT NULL AND cl.postal_code IS NOT NULL AND tr.postal_code=cl.postal_code)
        OR (tr.city IS NOT NULL AND cl.city IS NOT NULL AND lower(tr.city)=lower(cl.city) AND (cl.county IS NULL OR tr.county IS NULL OR lower(tr.county)=lower(cl.county)))
        OR (tr.city IS NULL AND tr.postal_code IS NULL AND cl.county IS NOT NULL AND lower(tr.county)=lower(cl.county))
        OR (tr.county='Default')
      )
    ORDER BY
      CASE
        WHEN tr.postal_code IS NOT NULL AND cl.postal_code IS NOT NULL AND tr.postal_code=cl.postal_code THEN 4
        WHEN tr.city IS NOT NULL AND cl.city IS NOT NULL AND lower(tr.city)=lower(cl.city) THEN 3
        WHEN tr.city IS NULL AND tr.postal_code IS NULL AND cl.county IS NOT NULL AND lower(tr.county)=lower(cl.county) THEN 2
        WHEN tr.county='Default' THEN 1
        ELSE 0
      END DESC,
      tr.effective_start_date DESC,
      tr.id DESC
    LIMIT 1
  `, [workOrderId]);

  return result.rows[0] || null;
}

async function syncInvoiceForWorkOrder(client, id, userId, notes) {
  const wo = (await client.query(`SELECT * FROM work_orders WHERE id=$1`, [id])).rows[0];
  const lineItems = (await client.query(`SELECT * FROM work_order_line_items WHERE work_order_id=$1 ORDER BY sort_order, id`, [id])).rows;
  if (!lineItems.length) return null;

  const subtotal = roundMoney(lineItems.reduce((sum, item) => sum + Number(item.line_total || 0), 0));
  const created = await getInvoiceStatusId(client, 'created');
  let inv = (await client.query(`SELECT i.*,s.code status_code FROM invoices i JOIN invoice_statuses s ON s.id=i.invoice_status_id WHERE i.work_order_id=$1`, [id])).rows[0];
  if (inv?.status_code === 'paid') throw new Error('Paid invoices cannot be regenerated.');

  const discount = calculateDiscount(wo, subtotal);
  const discountAmount = discount.discountAmount;
  const depositAmount = roundMoney(Math.max(0, Number(wo.deposit_amount || 0)));
  const taxableAmount = roundMoney(Math.max(0, subtotal - discountAmount));
  const taxRate = await findTaxRateForWorkOrder(client, id);
  const rate = Number(taxRate?.rate || 0);
  const taxAmount = roundMoney(taxableAmount * rate);
  const totalAmount = roundMoney(taxableAmount + taxAmount);
  const balanceDue = roundMoney(Math.max(0, totalAmount - depositAmount));

  if (!inv) {
    inv = (await client.query(`
      INSERT INTO invoices(
        customer_id,customer_location_id,work_order_id,invoice_status_id,tax_rate_id,
        invoice_number,issue_date,due_date,
        discount_type,discount_value_type,discount_percent,discount_reason,deposit_amount,deposit_note,
        subtotal,discount_amount,taxable_amount,tax_rate,tax_amount,total_amount,balance_due,notes
      )
      VALUES($1,$2,$3,$4,$5,$6,current_date,current_date + interval '14 days',$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20)
      RETURNING *
    `, [
      wo.customer_id,
      wo.customer_location_id,
      id,
      created,
      taxRate?.id || null,
      `INV-${Date.now()}`,
      discount.discountType,
      discount.discountValueType,
      discount.discountPercent,
      wo.discount_reason || null,
      depositAmount,
      wo.deposit_note || null,
      subtotal,
      discountAmount,
      taxableAmount,
      rate,
      taxAmount,
      totalAmount,
      balanceDue,
      notes || null,
    ])).rows[0];
  } else {
    await client.query(`
      UPDATE invoices
      SET tax_rate_id=$1,
          discount_type=$2,
          discount_value_type=$3,
          discount_percent=$4,
          discount_reason=$5,
          deposit_amount=$6,
          deposit_note=$7,
          subtotal=$8,
          discount_amount=$9,
          taxable_amount=$10,
          tax_rate=$11,
          tax_amount=$12,
          total_amount=$13,
          balance_due=$14,
          notes=COALESCE($15,notes),
          updated_at=current_timestamp
      WHERE id=$16
    `, [taxRate?.id || null, discount.discountType, discount.discountValueType, discount.discountPercent, wo.discount_reason || null, depositAmount, wo.deposit_note || null, subtotal, discountAmount, taxableAmount, rate, taxAmount, totalAmount, balanceDue, notes || null, inv.id]);
    await client.query(`DELETE FROM invoice_line_items WHERE invoice_id=$1`, [inv.id]);
  }

  for (const item of lineItems) {
    await client.query(`INSERT INTO invoice_line_items(invoice_id,catalog_item_id,description,quantity,unit_price,line_total) VALUES($1,$2,$3,$4,$5,$6)`, [inv.id, item.catalog_item_id, item.description, item.quantity, item.unit_price, item.line_total]);
  }

  await client.query(`UPDATE work_orders SET final_price=$1,updated_at=current_timestamp WHERE id=$2`, [totalAmount, id]);
  await client.query(`INSERT INTO activity_events(entity_type,entity_id,actor_user_id,event_type,event_body,metadata) VALUES('work_order',$1,$2,'invoice.synced','Invoice synchronized from completed work order',$3)`, [id, userId || null, JSON.stringify({ invoiceId: inv.id, subtotal, discountAmount, depositAmount, taxRateId: taxRate?.id || null, taxRate: rate, taxAmount, totalAmount, balanceDue })]);
  return inv.id;
}


async function ensureInvoiceForWorkOrder(id, userId, notes) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await assertWorkOrderMutable(client, id);
    const invoiceId = await syncInvoiceForWorkOrder(client, id, userId || null, notes || 'Invoice prepared for field payment collection');
    await client.query('COMMIT');
    return invoiceId;
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { listWorkOrders, getWorkOrderFilters, getWorkOrderDetail, updateWorkOrder, transition, addNote, addLineItem, deleteLineItem, ensureInvoiceForWorkOrder };

