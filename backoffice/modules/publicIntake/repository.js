const pool = require('../../db/pool');

async function findIdByCode(client, table, code) {
  const result = await client.query(`SELECT id FROM ${table} WHERE code = $1 AND is_active = true`, [code]);
  return result.rows[0]?.id || null;
}

async function findLeadSourceId(client, rawSource) {
  const normalized = normalizeText(rawSource);
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
  const normalized = normalizeText(rawServiceType);

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
    const normalizedPhone = normalizePhone(data.phone);
    const normalizedAddress = normalizeStreetAddress(data.address_line_1);
    const noteBody = buildLeadNote(data);

    let customerId = await findMatchingCustomer(client, {
      email: data.email,
      phone: data.phone,
      normalizedPhone,
      normalizedAddress
    });

    let matchedExistingCustomer = Boolean(customerId);

    if (!customerId) {
      const customerResult = await client.query(
        `INSERT INTO customers(display_name, customer_status_id, lead_source_id, notes_summary)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [displayName, prospectStatusId, leadSourceId, noteBody]
      );
      customerId = customerResult.rows[0].id;

      await client.query(
        `INSERT INTO customer_status_history(customer_id, to_status_id, reason)
         VALUES ($1, $2, $3)`,
        [customerId, prospectStatusId, 'Website lead intake']
      );
    } else {
      await client.query(
        `UPDATE customers
         SET lead_source_id = COALESCE(lead_source_id, $2),
             notes_summary = COALESCE(notes_summary, $3),
             updated_at = current_timestamp
         WHERE id = $1`,
        [customerId, leadSourceId, noteBody]
      );
    }

    await ensurePrimaryContact(client, customerId, {
      firstName: nameParts.firstName,
      lastName: nameParts.lastName,
      phone: data.phone || null,
      email: data.email || null,
      preferredContactMethod: data.preferred_contact_method || null
    });

    await ensurePrimaryLocation(client, customerId, {
      addressLine1: data.address_line_1 || null,
      city: data.city || null,
      state: data.state || 'GA',
      postalCode: data.postal_code || null,
      county: data.county || null,
      normalizedAddress
    });

    if (serviceLineId) {
      await client.query(
        `INSERT INTO customer_service_lines(customer_id, service_line_id)
         VALUES ($1, $2)
         ON CONFLICT DO NOTHING`,
        [customerId, serviceLineId]
      );
    }

    const leadResult = await client.query(
      `INSERT INTO leads(
         customer_id, service_line_id, lead_source_id, status, source,
         submitted_name, submitted_phone, submitted_email, preferred_contact_method,
         submitted_address_line_1, submitted_city, submitted_state, submitted_postal_code, submitted_county,
         normalized_street_address, requested_service_type, message
       ) VALUES (
         $1, $2, $3, 'new', 'website',
         $4, $5, $6, $7,
         $8, $9, $10, $11, $12,
         $13, $14, $15
       )
       RETURNING id`,
      [
        customerId,
        serviceLineId,
        leadSourceId,
        data.name || null,
        data.phone || null,
        data.email || null,
        data.preferred_contact_method || null,
        data.address_line_1 || null,
        data.city || null,
        data.state || 'GA',
        data.postal_code || null,
        data.county || null,
        normalizedAddress || null,
        data.service_type || null,
        data.message || null
      ]
    );

    const leadId = leadResult.rows[0].id;

    await client.query(
      `INSERT INTO lead_notes(lead_id, note_body)
       VALUES ($1, $2)`,
      [leadId, noteBody]
    );

    await client.query(
      `INSERT INTO customer_notes(customer_id, note_body)
       VALUES ($1, $2)`,
      [customerId, noteBody]
    );

    await client.query(
      `INSERT INTO activity_events(entity_type, entity_id, event_type, event_body, metadata)
       VALUES ('lead', $1, 'website_lead.received', $2, $3::jsonb)`,
      [
        leadId,
        matchedExistingCustomer ? 'Website lead attached to existing customer' : 'Website lead received',
        JSON.stringify({
          customerId,
          matchedExistingCustomer,
          serviceType: data.service_type || null,
          preferredContactMethod: data.preferred_contact_method || null,
          hearAboutUs: data.hear_about_us || null,
          sourceIp: data.source_ip || null,
          userAgent: data.user_agent || null
        })
      ]
    );

    await client.query('COMMIT');
    return { customerId, leadId, matchedExistingCustomer };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function findMatchingCustomer(client, { email, normalizedPhone, normalizedAddress }) {
  if (email) {
    const r = await client.query(
      `SELECT customer_id
       FROM customer_contacts
       WHERE lower(email) = lower($1)
       ORDER BY is_primary DESC, id ASC
       LIMIT 1`,
      [email]
    );
    if (r.rows[0]) return r.rows[0].customer_id;
  }

  if (normalizedPhone) {
    const r = await client.query(
      `SELECT customer_id
       FROM customer_contacts
       WHERE regexp_replace(coalesce(phone, ''), '\\D', '', 'g') = $1
       ORDER BY is_primary DESC, id ASC
       LIMIT 1`,
      [normalizedPhone]
    );
    if (r.rows[0]) return r.rows[0].customer_id;
  }

  if (normalizedAddress) {
    const r = await client.query(
      `SELECT customer_id
       FROM customer_locations
       WHERE coalesce(normalized_street_address, lower(regexp_replace(coalesce(address_line_1, ''), '[^a-zA-Z0-9]+', '', 'g'))) = $1
       ORDER BY is_primary DESC, id ASC
       LIMIT 1`,
      [normalizedAddress]
    );
    if (r.rows[0]) return r.rows[0].customer_id;
  }

  return null;
}

async function ensurePrimaryContact(client, customerId, contact) {
  const existing = await client.query(
    `SELECT id, phone, email
     FROM customer_contacts
     WHERE customer_id = $1 AND is_primary = true
     LIMIT 1`,
    [customerId]
  );

  if (!existing.rows.length) {
    await client.query(
      `INSERT INTO customer_contacts(customer_id, first_name, last_name, phone, email, preferred_contact_method, is_primary)
       VALUES ($1, $2, $3, $4, $5, $6, true)`,
      [customerId, contact.firstName, contact.lastName, contact.phone, contact.email, contact.preferredContactMethod]
    );
    return;
  }

  const row = existing.rows[0];
  await client.query(
    `UPDATE customer_contacts
     SET phone = COALESCE(NULLIF(phone, ''), $2),
         email = COALESCE(NULLIF(email, ''), $3),
         preferred_contact_method = COALESCE(preferred_contact_method, $4),
         updated_at = current_timestamp
     WHERE id = $1`,
    [row.id, contact.phone, contact.email, contact.preferredContactMethod]
  );
}

async function ensurePrimaryLocation(client, customerId, location) {
  const existing = await client.query(
    `SELECT id, address_line_1
     FROM customer_locations
     WHERE customer_id = $1 AND is_primary = true
     LIMIT 1`,
    [customerId]
  );

  if (!existing.rows.length) {
    await client.query(
      `INSERT INTO customer_locations(customer_id, label, address_line_1, city, state, postal_code, county, normalized_street_address, is_primary)
       VALUES ($1, 'Service Location', $2, $3, $4, $5, $6, $7, true)`,
      [customerId, location.addressLine1, location.city, location.state, location.postalCode, location.county, location.normalizedAddress || null]
    );
    return;
  }

  const row = existing.rows[0];
  await client.query(
    `UPDATE customer_locations
     SET address_line_1 = COALESCE(NULLIF(address_line_1, ''), $2),
         city = COALESCE(NULLIF(city, ''), $3),
         state = COALESCE(NULLIF(state, ''), $4),
         postal_code = COALESCE(NULLIF(postal_code, ''), $5),
         county = COALESCE(NULLIF(county, ''), $6),
         normalized_street_address = COALESCE(normalized_street_address, $7),
         updated_at = current_timestamp
     WHERE id = $1`,
    [row.id, location.addressLine1, location.city, location.state, location.postalCode, location.county, location.normalizedAddress || null]
  );
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

function normalizeText(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizePhone(value) {
  return String(value || '').replace(/\D/g, '') || null;
}

function normalizeStreetAddress(value) {
  return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '') || null;
}

module.exports = { createWebsiteLead, normalizeStreetAddress, normalizePhone };
