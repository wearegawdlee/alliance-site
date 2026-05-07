const pool = require('../../db/pool');

async function listProspects(filters = {}) {
  const values = [];
  const where = [`l.status IN ('new', 'contacted')`];

  if (filters.q) {
    values.push(`%${String(filters.q).trim()}%`);
    const idx = values.length;
    where.push(`(
      c.display_name ILIKE $${idx}
      OR c.company_name ILIKE $${idx}
      OR l.submitted_name ILIKE $${idx}
      OR l.submitted_phone ILIKE $${idx}
      OR l.submitted_email ILIKE $${idx}
      OR l.submitted_address_line_1 ILIKE $${idx}
      OR l.submitted_city ILIKE $${idx}
      OR pc.first_name ILIKE $${idx}
      OR pc.last_name ILIKE $${idx}
      OR pc.phone ILIKE $${idx}
      OR pc.email ILIKE $${idx}
      OR pl.address_line_1 ILIKE $${idx}
      OR pl.city ILIKE $${idx}
    )`);
  }

  if (filters.assigned_user_id) {
    values.push(Number(filters.assigned_user_id));
    where.push(`l.assigned_user_id = $${values.length}`);
  }

  const r = await pool.query(`
    SELECT
      l.id lead_id,
      l.customer_id,
      l.status lead_status,
      l.source,
      l.requested_service_type,
      l.message,
      l.created_at lead_created_at,
      l.updated_at lead_updated_at,
      l.submitted_name,
      l.submitted_phone,
      l.submitted_email,
      l.submitted_address_line_1,
      l.submitted_city,
      l.submitted_state,
      l.contacted_at,
      l.contact_note,
      c.id,
      c.display_name,
      c.company_name,
      c.created_at customer_created_at,
      cs.code customer_status_code,
      ls.name lead_source,
      sl.name service_line,
      owner.display_name assigned_to,
      contacted_by.display_name contacted_by,
      pc.first_name,
      pc.last_name,
      pc.phone,
      pc.email,
      pl.address_line_1,
      pl.city,
      pl.state,
      last_note.note_body latest_note,
      last_note.created_at latest_note_at,
      last_note.author latest_note_author,
      EXISTS (
        SELECT 1
        FROM work_orders wo
        JOIN work_order_statuses wos ON wos.id = wo.work_order_status_id
        WHERE wo.customer_id = c.id
          AND wos.code = 'completed'
      ) has_completed_work,
      EXISTS (
        SELECT 1
        FROM invoices i
        JOIN invoice_statuses ist ON ist.id = i.invoice_status_id
        WHERE i.customer_id = c.id
          AND ist.code = 'paid'
      ) has_paid_invoice
    FROM leads l
    JOIN customers c ON c.id = l.customer_id
    JOIN customer_statuses cs ON cs.id = c.customer_status_id
    LEFT JOIN lead_sources ls ON ls.id = l.lead_source_id
    LEFT JOIN service_lines sl ON sl.id = l.service_line_id
    LEFT JOIN users owner ON owner.id = l.assigned_user_id
    LEFT JOIN users contacted_by ON contacted_by.id = l.contacted_by_user_id
    LEFT JOIN customer_contacts pc ON pc.customer_id = c.id AND pc.is_primary = true
    LEFT JOIN customer_locations pl ON pl.customer_id = c.id AND pl.is_primary = true
    LEFT JOIN LATERAL (
      SELECT ln.note_body, ln.created_at, u.display_name author
      FROM lead_notes ln
      LEFT JOIN users u ON u.id = ln.author_user_id
      WHERE ln.lead_id = l.id
      ORDER BY ln.created_at DESC
      LIMIT 1
    ) last_note ON true
    WHERE ${where.join(' AND ')}
    ORDER BY
      CASE WHEN l.contacted_at IS NULL THEN 0 ELSE 1 END,
      l.created_at DESC,
      l.id DESC
  `, values);
  return r.rows;
}

async function getUsers() {
  const r = await pool.query(`SELECT id,display_name FROM users WHERE is_active=true ORDER BY display_name`);
  return r.rows;
}

async function claimProspect(leadId, userId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(`
      UPDATE leads
      SET assigned_user_id=$1, updated_at=current_timestamp
      WHERE id=$2
        AND status IN ('new', 'contacted')
      RETURNING id, customer_id
    `, [userId || null, leadId]);

    const lead = r.rows[0];
    if (lead) {
      await client.query(`
        UPDATE customers
        SET assigned_user_id=COALESCE(assigned_user_id,$1), updated_at=current_timestamp
        WHERE id=$2
      `, [userId || null, lead.customer_id]);
      await client.query(`
        INSERT INTO activity_events(entity_type,entity_id,actor_user_id,event_type,event_body,metadata)
        VALUES('lead',$1,$2,'lead.claimed','Lead claimed',$3::jsonb)
      `, [lead.id, userId || null, JSON.stringify({ customerId: lead.customer_id })]);
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function markContacted(leadId, userId, note) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const r = await client.query(`
      UPDATE leads
      SET assigned_user_id=COALESCE(assigned_user_id,$1),
          status='contacted',
          contacted_at=COALESCE(contacted_at,current_timestamp),
          contacted_by_user_id=COALESCE(contacted_by_user_id,$1),
          contact_note=COALESCE($3, contact_note),
          updated_at=current_timestamp
      WHERE id=$2
        AND status IN ('new', 'contacted')
      RETURNING id, customer_id
    `, [userId || null, leadId, note || null]);

    const lead = r.rows[0];
    if (lead) {
      await client.query(`
        UPDATE customers
        SET assigned_user_id=COALESCE(assigned_user_id,$1), updated_at=current_timestamp
        WHERE id=$2
      `, [userId || null, lead.customer_id]);
      await client.query(`
        INSERT INTO activity_events(entity_type,entity_id,actor_user_id,event_type,event_body,metadata)
        VALUES('lead',$1,$2,'lead.contacted',$3,$4::jsonb)
      `, [lead.id, userId || null, note || 'Lead contacted', JSON.stringify({ customerId: lead.customer_id })]);
      if (note) {
        await client.query(`
          INSERT INTO lead_notes(lead_id,author_user_id,note_body)
          VALUES($1,$2,$3)
        `, [lead.id, userId || null, note]);
        await client.query(`
          INSERT INTO customer_notes(customer_id,author_user_id,note_body)
          VALUES($1,$2,$3)
        `, [lead.customer_id, userId || null, note]);
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { listProspects, getUsers, claimProspect, markContacted };
