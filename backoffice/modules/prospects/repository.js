const pool = require('../../db/pool');

async function listProspects(filters = {}) {
  const values = [];
  const where = [`cs.code = 'prospect'`];

  if (filters.q) {
    values.push(`%${String(filters.q).trim()}%`);
    const idx = values.length;
    where.push(`(
      c.display_name ILIKE $${idx}
      OR c.company_name ILIKE $${idx}
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
    where.push(`c.assigned_user_id = $${values.length}`);
  }

  const r = await pool.query(`
    SELECT
      c.id,
      c.display_name,
      c.company_name,
      c.created_at,
      c.updated_at,
      ls.name lead_source,
      owner.display_name assigned_to,
      pc.first_name,
      pc.last_name,
      pc.phone,
      pc.email,
      pl.address_line_1,
      pl.city,
      pl.state,
      last_contact.created_at contacted_at,
      last_contact.actor contacted_by,
      last_contact.event_body contact_summary,
      last_note.note_body latest_note,
      last_note.created_at latest_note_at,
      last_note.author latest_note_author
    FROM customers c
    JOIN customer_statuses cs ON cs.id = c.customer_status_id
    LEFT JOIN lead_sources ls ON ls.id = c.lead_source_id
    LEFT JOIN users owner ON owner.id = c.assigned_user_id
    LEFT JOIN customer_contacts pc ON pc.customer_id = c.id AND pc.is_primary = true
    LEFT JOIN customer_locations pl ON pl.customer_id = c.id AND pl.is_primary = true
    LEFT JOIN LATERAL (
      SELECT ae.created_at, ae.event_body, u.display_name actor
      FROM activity_events ae
      LEFT JOIN users u ON u.id = ae.actor_user_id
      WHERE ae.entity_type='customer'
        AND ae.entity_id=c.id
        AND ae.event_type='lead.contacted'
      ORDER BY ae.created_at DESC
      LIMIT 1
    ) last_contact ON true
    LEFT JOIN LATERAL (
      SELECT cn.note_body, cn.created_at, u.display_name author
      FROM customer_notes cn
      LEFT JOIN users u ON u.id = cn.author_user_id
      WHERE cn.customer_id=c.id
      ORDER BY cn.created_at DESC
      LIMIT 1
    ) last_note ON true
    WHERE ${where.join(' AND ')}
    ORDER BY
      CASE WHEN last_contact.created_at IS NULL THEN 0 ELSE 1 END,
      c.created_at DESC,
      c.id DESC
  `, values);
  return r.rows;
}

async function getUsers() {
  const r = await pool.query(`SELECT id,display_name FROM users WHERE is_active=true ORDER BY display_name`);
  return r.rows;
}

async function claimProspect(customerId, userId) {
  await pool.query(`
    UPDATE customers
    SET assigned_user_id=$1, updated_at=current_timestamp
    WHERE id=$2
      AND customer_status_id=(SELECT id FROM customer_statuses WHERE code='prospect')
  `, [userId || null, customerId]);
  await pool.query(`
    INSERT INTO activity_events(entity_type,entity_id,actor_user_id,event_type,event_body)
    VALUES('customer',$1,$2,'lead.claimed','Prospect claimed')
  `, [customerId, userId || null]);
}

async function markContacted(customerId, userId, note) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(`
      UPDATE customers
      SET assigned_user_id=COALESCE(assigned_user_id,$1), updated_at=current_timestamp
      WHERE id=$2
        AND customer_status_id=(SELECT id FROM customer_statuses WHERE code='prospect')
    `, [userId || null, customerId]);
    await client.query(`
      INSERT INTO activity_events(entity_type,entity_id,actor_user_id,event_type,event_body)
      VALUES('customer',$1,$2,'lead.contacted',$3)
    `, [customerId, userId || null, note || 'Prospect contacted']);
    if (note) {
      await client.query(`
        INSERT INTO customer_notes(customer_id,author_user_id,note_body)
        VALUES($1,$2,$3)
      `, [customerId, userId || null, note]);
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
