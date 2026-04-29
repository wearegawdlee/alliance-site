const pool = require("../../db/pool");

function normalizeLike(value) {
  const q = String(value || "").trim();
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

  if (filters.status_id) {
    params.push(Number(filters.status_id));
    where.push(`wo.work_order_status_id = $${params.length}`);
  }
  if (filters.service_line_id) {
    params.push(Number(filters.service_line_id));
    where.push(`wo.service_line_id = $${params.length}`);
  }
  if (filters.assigned_user_id) {
    if (filters.assigned_user_id === "unassigned") {
      where.push(
        `NOT EXISTS (SELECT 1 FROM work_order_assignments ax WHERE ax.work_order_id = wo.id)`,
      );
    } else {
      params.push(Number(filters.assigned_user_id));
      where.push(
        `EXISTS (SELECT 1 FROM work_order_assignments ax WHERE ax.work_order_id = wo.id AND ax.user_id = $${params.length})`,
      );
    }
  }

  const sql = `
    SELECT
      wo.id,
      wo.title,
      wo.scheduled_start_at,
      wo.quoted_price,
      wo.final_price,
      c.display_name customer,
      wos.code status_code,
      wos.name status,
      sl.name service_line,
      wot.name work_order_type,
      cl.city,
      cl.state,
      a.name asset,
      string_agg(DISTINCT u.display_name, ', ' ORDER BY u.display_name) assigned_to,
      COALESCE(li.item_count, 0)::int item_count,
      COALESCE(li.item_total, 0)::numeric(10,2) item_total
    FROM work_orders wo
    JOIN customers c ON c.id=wo.customer_id
    JOIN customer_locations cl ON cl.id=wo.customer_location_id
    JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id
    JOIN service_lines sl ON sl.id=wo.service_line_id
    LEFT JOIN work_order_types wot ON wot.id=wo.work_order_type_id
    LEFT JOIN assets a ON a.id=wo.asset_id
    LEFT JOIN work_order_assignments woa ON woa.work_order_id=wo.id
    LEFT JOIN users u ON u.id=woa.user_id
    LEFT JOIN (
      SELECT work_order_id, COUNT(*)::int item_count, SUM(line_total)::numeric(10,2) item_total
      FROM work_order_line_items
      GROUP BY work_order_id
    ) li ON li.work_order_id=wo.id
    ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
    GROUP BY wo.id,wo.title,wo.scheduled_start_at,wo.quoted_price,wo.final_price,c.display_name,wos.code,wos.name,sl.name,wot.name,cl.city,cl.state,a.name,li.item_count,li.item_total
    ORDER BY COALESCE(wo.scheduled_start_at,wo.created_at) DESC`;
  const r = await pool.query(sql, params);
  return r.rows;
}

async function getWorkOrderFilters() {
  const [statuses, serviceLines, users] = await Promise.all([
    pool.query(
      `SELECT id, code, name FROM work_order_statuses WHERE is_active=true ORDER BY sort_order`,
    ),
    pool.query(
      `SELECT id, name FROM service_lines WHERE is_active=true ORDER BY name`,
    ),
    pool.query(
      `SELECT id, display_name FROM users WHERE is_active=true ORDER BY display_name`,
    ),
  ]);
  return {
    statuses: statuses.rows,
    serviceLines: serviceLines.rows,
    users: users.rows,
  };
}

async function getWorkOrderDetail(id) {
  const wr = await pool.query(
    `SELECT wo.*,c.display_name customer,wos.code status_code,wos.name status,sl.name service_line,wot.name work_order_type,cl.label location_label,cl.address_line_1,cl.city,cl.state,cl.postal_code,a.name asset FROM work_orders wo JOIN customers c ON c.id=wo.customer_id JOIN work_order_statuses wos ON wos.id=wo.work_order_status_id JOIN service_lines sl ON sl.id=wo.service_line_id JOIN customer_locations cl ON cl.id=wo.customer_location_id LEFT JOIN work_order_types wot ON wot.id=wo.work_order_type_id LEFT JOIN assets a ON a.id=wo.asset_id WHERE wo.id=$1`,
    [id],
  );
  if (!wr.rows[0]) return null;
  const [
    statuses,
    users,
    assignments,
    notes,
    history,
    invoices,
    lineItems,
    catalogItems,
  ] = await Promise.all([
    pool.query(
      `SELECT id,code,name FROM work_order_statuses WHERE is_active=true ORDER BY sort_order`,
    ),
    pool.query(
      `SELECT id,display_name FROM users WHERE is_active=true ORDER BY display_name`,
    ),
    pool.query(
      `SELECT woa.*,u.display_name FROM work_order_assignments woa JOIN users u ON u.id=woa.user_id WHERE woa.work_order_id=$1 ORDER BY woa.id`,
      [id],
    ),
    pool.query(
      `SELECT won.*,u.display_name author FROM work_order_notes won LEFT JOIN users u ON u.id=won.author_user_id WHERE won.work_order_id=$1 ORDER BY won.created_at DESC`,
      [id],
    ),
    pool.query(
      `SELECT h.*,fs.name from_status,ts.name to_status,u.display_name changed_by FROM work_order_status_history h LEFT JOIN work_order_statuses fs ON fs.id=h.from_status_id JOIN work_order_statuses ts ON ts.id=h.to_status_id LEFT JOIN users u ON u.id=h.changed_by_user_id WHERE h.work_order_id=$1 ORDER BY h.created_at DESC`,
      [id],
    ),
    pool.query(
      `SELECT i.*,s.name status FROM invoices i JOIN invoice_statuses s ON s.id=i.invoice_status_id WHERE i.work_order_id=$1 ORDER BY i.created_at DESC`,
      [id],
    ),
    pool.query(
      `SELECT woli.*, ci.sku, ci.name catalog_name, ci.item_type FROM work_order_line_items woli LEFT JOIN catalog_items ci ON ci.id=woli.catalog_item_id WHERE woli.work_order_id=$1 ORDER BY woli.sort_order, woli.id`,
      [id],
    ),
    pool.query(
      `SELECT ci.id, ci.sku, ci.name, ci.item_type, ci.unit_price, sl.name service_line FROM catalog_items ci LEFT JOIN service_lines sl ON sl.id=ci.service_line_id WHERE ci.is_active=true ORDER BY sl.name NULLS LAST, ci.name`,
    ),
  ]);
  return {
    ...wr.rows[0],
    statuses: statuses.rows,
    users: users.rows,
    assignments: assignments.rows,
    notes: notes.rows,
    history: history.rows,
    invoices: invoices.rows,
    lineItems: lineItems.rows,
    catalogItems: catalogItems.rows,
    lineItemTotal: lineItems.rows.reduce(
      (sum, item) => sum + Number(item.line_total || 0),
      0,
    ),
  };
}

async function getStatusId(client, code) {
  const r = await client.query(
    `SELECT id FROM work_order_statuses WHERE code=$1`,
    [code],
  );
  return r.rows[0]?.id;
}
async function getInvoiceStatusId(client, code) {
  const r = await client.query(
    `SELECT id FROM invoice_statuses WHERE code=$1`,
    [code],
  );
  return r.rows[0]?.id;
}

async function updateWorkOrder(id, data, userId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query(
      `SELECT work_order_status_id FROM work_orders WHERE id=$1`,
      [id],
    );
    if (!cur.rows[0]) throw new Error("Work order not found");
    await client.query(
      `UPDATE work_orders SET work_order_status_id=$1,scheduled_start_at=$2,quoted_price=$3,final_price=$4,updated_at=current_timestamp WHERE id=$5`,
      [
        data.work_order_status_id,
        data.scheduled_start_at || null,
        data.quoted_price || null,
        data.final_price || null,
        id,
      ],
    );
    if (
      Number(cur.rows[0].work_order_status_id) !==
      Number(data.work_order_status_id)
    ) {
      await client.query(
        `INSERT INTO work_order_status_history(work_order_id,from_status_id,to_status_id,changed_by_user_id,reason) VALUES($1,$2,$3,$4,$5)`,
        [
          id,
          cur.rows[0].work_order_status_id,
          data.work_order_status_id,
          userId || null,
          data.reason || "Manual work order update",
        ],
      );
    }
    await client.query(
      `DELETE FROM work_order_assignments WHERE work_order_id=$1`,
      [id],
    );
    if (data.assigned_user_id) {
      await client.query(
        `INSERT INTO work_order_assignments(work_order_id,user_id,role_on_job) VALUES($1,$2,'technician')`,
        [id, data.assigned_user_id],
      );
    }
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function transition(id, action, userId, reason) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const cur = await client.query(
      `SELECT work_order_status_id FROM work_orders WHERE id=$1`,
      [id],
    );
    if (!cur.rows[0]) throw new Error("Work order not found");
    const map = {
      contact: "contacted",
      schedule: "scheduled",
      assign: "assigned",
      evaluate: "in_evaluation",
      estimate: "estimate_pending",
      approve: "approved",
      start: "in_progress",
      complete: "completed",
      invoice: "invoiced",
      close: "closed",
      cancel: "cancelled",
    };
    const code = map[action] || null;
    if (!code) throw new Error("Unknown work order transition");
    const toId = await getStatusId(client, code);
    await client.query(
      `UPDATE work_orders SET work_order_status_id=$1,updated_at=current_timestamp WHERE id=$2`,
      [toId, id],
    );
    await client.query(
      `INSERT INTO work_order_status_history(work_order_id,from_status_id,to_status_id,changed_by_user_id,reason) VALUES($1,$2,$3,$4,$5)`,
      [
        id,
        cur.rows[0].work_order_status_id,
        toId,
        userId || null,
        reason || `Workflow transition: ${action}`,
      ],
    );
    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

async function addNote(id, userId, note) {
  await pool.query(
    `INSERT INTO work_order_notes(work_order_id,author_user_id,note_body) VALUES($1,$2,$3)`,
    [id, userId || null, note],
  );
}

async function addLineItem(id, data) {
  await pool.query(
    `INSERT INTO work_order_line_items(work_order_id,catalog_item_id,description,quantity,unit_price,line_total,sort_order) VALUES($1,$2,COALESCE($3,(SELECT name FROM catalog_items WHERE id=$2),'Custom item'),$4,COALESCE($5,(SELECT unit_price FROM catalog_items WHERE id=$2),0),$4*COALESCE($5,(SELECT unit_price FROM catalog_items WHERE id=$2),0),COALESCE((SELECT MAX(sort_order)+1 FROM work_order_line_items WHERE work_order_id=$1),0))`,
    [
      id,
      data.catalog_item_id || null,
      data.description,
      data.quantity,
      data.unit_price,
    ],
  );
}

async function deleteLineItem(workOrderId, lineItemId) {
  await pool.query(
    `DELETE FROM work_order_line_items WHERE id=$1 AND work_order_id=$2`,
    [lineItemId, workOrderId],
  );
}

async function generateInvoice(id, userId, data) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const wo = (
      await client.query(`SELECT * FROM work_orders WHERE id=$1`, [id])
    ).rows[0];
    if (!wo) throw new Error("Work order not found");
    const draft = await getInvoiceStatusId(client, "draft");
    const lineItems = (
      await client.query(
        `SELECT * FROM work_order_line_items WHERE work_order_id=$1 ORDER BY sort_order, id`,
        [id],
      )
    ).rows;
    const lineTotal = lineItems.reduce(
      (sum, item) => sum + Number(item.line_total || 0),
      0,
    );
    const manualTotal = Number(
      data.total_amount || wo.final_price || wo.quoted_price || 0,
    );
    const total = lineItems.length ? lineTotal : manualTotal;
    const inv = await client.query(
      `INSERT INTO invoices(customer_id,customer_location_id,work_order_id,invoice_status_id,invoice_number,issue_date,due_date,subtotal,total_amount,notes) VALUES($1,$2,$3,$4,$5,current_date,current_date + interval '14 days',$6,$6,$7) RETURNING id`,
      [
        wo.customer_id,
        wo.customer_location_id,
        id,
        draft,
        `INV-${Date.now()}`,
        total,
        data.notes || null,
      ],
    );
    if (lineItems.length) {
      for (const item of lineItems) {
        await client.query(
          `INSERT INTO invoice_line_items(invoice_id,catalog_item_id,description,quantity,unit_price,line_total) VALUES($1,$2,$3,$4,$5,$6)`,
          [
            inv.rows[0].id,
            item.catalog_item_id,
            item.description,
            item.quantity,
            item.unit_price,
            item.line_total,
          ],
        );
      }
    } else {
      await client.query(
        `INSERT INTO invoice_line_items(invoice_id,description,quantity,unit_price,line_total) VALUES($1,$2,1,$3,$3)`,
        [inv.rows[0].id, data.description || wo.title, total],
      );
    }
    if (data.mark_completed) {
      const invoiced = await getStatusId(client, "invoiced");
      await client.query(
        `UPDATE work_orders SET work_order_status_id=$1,final_price=COALESCE(final_price,$2),updated_at=current_timestamp WHERE id=$3`,
        [invoiced, total, id],
      );
      await client.query(
        `INSERT INTO work_order_status_history(work_order_id,to_status_id,changed_by_user_id,reason) VALUES($1,$2,$3,'Invoice generated')`,
        [id, invoiced, userId || null],
      );
    }
    await client.query("COMMIT");
    return inv.rows[0].id;
  } catch (e) {
    await client.query("ROLLBACK");
    throw e;
  } finally {
    client.release();
  }
}

module.exports = {
  listWorkOrders,
  getWorkOrderFilters,
  getWorkOrderDetail,
  updateWorkOrder,
  transition,
  addNote,
  addLineItem,
  deleteLineItem,
  generateInvoice,
};
