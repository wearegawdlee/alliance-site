const pool = require('../../db/pool');

async function findIdByCode(client, table, code) {
  const result = await client.query(`SELECT id FROM ${table} WHERE code = $1 AND is_active = true`, [code]);
  return result.rows[0]?.id || null;
}

async function findLeadSourceId(client, rawSource) {
  const normalized = normalize(rawSource);
  const mappings = [
    [/google|gbp|business profile|search/, 'google_business'],
    [/facebook|fb/, 'facebook'],
    [/thumbtack/, 'thumbtack'],
    [/angi|angie/, 'angi'],
    [/referral|friend|neighbor|word of mouth/, 'referral'],
    [/phone|call/, 'phone'],
    [/website|site|web/, 'website']
  ];

  const match = mappings.find(([pattern]) => pattern.test(normalized));
  return findIdByCode(client, 'lead_sources', match ? match[1] : 'website');
}

async function findServiceLineId(client, rawServiceType) {
  const normalized = normalize(rawServiceType);

  if (/pool/.test(normalized)) return findIdByCode(client, 'service_lines', 'pools');
  if (/screen/.test(normalized)) return findIdByCode(client, 'service_lines', 'motorized_screens');

  return findIdByCode(client, 'service_lines', 'garage_doors');
}

async function createWebsiteLead(data) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const prospectStatusId = await findIdByCode(client, 'customer_statuses', 'prospect');
    const leadSourceId = await findLeadSourceId(client, data.hear_about_us);
    const serviceLineId = await findServiceLineId(client, data.service_type);

    const displayName = data.name || data.email || data.phone || 'Website Prospect';
    const nameParts = splitName(data.name);
    const noteBody = buildLeadNote(data);

    const customerResult = await client.query(
      `INSERT INTO customers(display_name, customer_status_id, lead_source_id, notes_summary)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [displayName, prospectStatusId, leadSourceId, noteBody]
    );

    const customerId = customerResult.rows[0].id;

    await client.query(
      `INSERT INTO customer_status_history(customer_id, to_status_id, reason)
       VALUES ($1, $2, $3)`,
      [customerId, prospectStatusId, 'Website lead intake']
    );

    await client.query(
      `INSERT INTO customer_contacts(customer_id, first_name, last_name, phone, email, preferred_contact_method, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [
        customerId,
        nameParts.firstName,
        nameParts.lastName,
        data.phone || null,
        data.email || null,
        data.preferred_contact_method || null
      ]
    );

    await client.query(
      `INSERT INTO customer_locations(customer_id, label, address_line_1, city, state, postal_code, is_primary)
       VALUES ($1, 'Service Location', $2, $3, $4, $5, true)`,
      [
        customerId,
        data.address_line_1 || null,
        data.city || null,
        data.state || 'GA',
        data.postal_code || null
      ]
    );

    if (serviceLineId) {
      await client.query(
        `INSERT INTO customer_service_lines(customer_id, service_line_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [customerId, serviceLineId]
      );
    }

    await client.query(
      `INSERT INTO customer_notes(customer_id, note_body)
       VALUES ($1, $2)`,
      [customerId, noteBody]
    );

    await client.query(
      `INSERT INTO activity_events(entity_type, entity_id, event_type, event_body, metadata)
       VALUES ('customer', $1, 'website_lead.received', $2, $3::jsonb)`,
      [
        customerId,
        'Website lead received',
        JSON.stringify({
          serviceType: data.service_type || null,
          preferredContactMethod: data.preferred_contact_method || null,
          hearAboutUs: data.hear_about_us || null,
          sourceIp: data.source_ip || null,
          userAgent: data.user_agent || null
        })
      ]
    );

    await client.query('COMMIT');
    return { customerId };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

function splitName(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  return {
    firstName: parts[0] || null,
    lastName: parts.length > 1 ? parts.slice(1).join(' ') : null
  };
}

function buildLeadNote(data) {
  const lines = [
    'Website lead intake',
    data.service_type ? `Service Type: ${data.service_type}` : null,
    data.message ? `Message: ${data.message}` : null,
    data.preferred_contact_method ? `Preferred Contact: ${data.preferred_contact_method}` : null,
    data.hear_about_us ? `Heard About Us: ${data.hear_about_us}` : null
  ].filter(Boolean);

  return lines.join('\n');
}

function normalize(value) {
  return String(value || '').trim().toLowerCase();
}

module.exports = { createWebsiteLead };
