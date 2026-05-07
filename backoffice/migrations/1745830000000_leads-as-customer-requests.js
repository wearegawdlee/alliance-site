/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.addColumn('customer_locations', {
    normalized_street_address: { type: 'varchar(255)' }
  });

  pgm.sql(`
    UPDATE customer_locations
    SET normalized_street_address = lower(regexp_replace(coalesce(address_line_1, ''), '[^a-zA-Z0-9]+', '', 'g'))
    WHERE normalized_street_address IS NULL
      AND coalesce(address_line_1, '') <> ''
  `);

  pgm.createTable('leads', {
    id: 'id',
    customer_id: { type: 'integer', notNull: true, references: 'customers', onDelete: 'cascade' },
    service_line_id: { type: 'integer', references: 'service_lines', onDelete: 'set null' },
    lead_source_id: { type: 'integer', references: 'lead_sources', onDelete: 'set null' },
    assigned_user_id: { type: 'integer', references: 'users', onDelete: 'set null' },
    status: { type: 'varchar(40)', notNull: true, default: 'new' },
    source: { type: 'varchar(80)', notNull: true, default: 'website' },
    submitted_name: { type: 'varchar(255)' },
    submitted_phone: { type: 'varchar(50)' },
    submitted_email: { type: 'varchar(255)' },
    preferred_contact_method: { type: 'varchar(50)' },
    submitted_address_line_1: { type: 'varchar(255)' },
    submitted_city: { type: 'varchar(100)' },
    submitted_state: { type: 'varchar(50)' },
    submitted_postal_code: { type: 'varchar(20)' },
    submitted_county: { type: 'varchar(120)' },
    normalized_street_address: { type: 'varchar(255)' },
    requested_service_type: { type: 'varchar(160)' },
    message: { type: 'text' },
    contacted_at: { type: 'timestamptz' },
    contacted_by_user_id: { type: 'integer', references: 'users', onDelete: 'set null' },
    contact_note: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  });

  pgm.createIndex('leads', 'customer_id');
  pgm.createIndex('leads', 'service_line_id');
  pgm.createIndex('leads', 'lead_source_id');
  pgm.createIndex('leads', 'assigned_user_id');
  pgm.createIndex('leads', 'status');
  pgm.createIndex('leads', 'created_at');
  pgm.createIndex('leads', 'submitted_email');
  pgm.createIndex('leads', 'submitted_phone');
  pgm.createIndex('leads', 'normalized_street_address');
  pgm.addConstraint('leads', 'leads_status_valid', "CHECK (status IN ('new', 'contacted', 'closed'))");

  pgm.createTable('lead_notes', {
    id: 'id',
    lead_id: { type: 'integer', notNull: true, references: 'leads', onDelete: 'cascade' },
    author_user_id: { type: 'integer', references: 'users', onDelete: 'set null' },
    note_body: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('current_timestamp') }
  });
  pgm.createIndex('lead_notes', 'lead_id');
  pgm.createIndex('lead_notes', 'author_user_id');
};

exports.down = (pgm) => {
  pgm.dropTable('lead_notes', { ifExists: true, cascade: true });
  pgm.dropTable('leads', { ifExists: true, cascade: true });
  pgm.dropColumn('customer_locations', 'normalized_street_address', { ifExists: true });
};
