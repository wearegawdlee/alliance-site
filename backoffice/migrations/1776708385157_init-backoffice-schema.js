/* eslint-disable camelcase */

exports.up = (pgm) => {
  pgm.createTable('users', {
    id: 'id',
    email: { type: 'varchar(255)', notNull: true, unique: true },
    password_hash: { type: 'text', notNull: true },
    first_name: { type: 'varchar(100)' },
    last_name: { type: 'varchar(100)' },
    display_name: { type: 'varchar(150)', notNull: true },
    role: { type: 'varchar(50)', notNull: true, default: 'user' },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createTable('contacts', {
    id: 'id',
    first_name: { type: 'varchar(100)' },
    last_name: { type: 'varchar(100)' },
    phone: { type: 'varchar(50)' },
    email: { type: 'varchar(255)' },
    preferred_contact_method: { type: 'varchar(50)' },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createTable('addresses', {
    id: 'id',
    address_line_1: { type: 'varchar(255)' },
    address_line_2: { type: 'varchar(255)' },
    city: { type: 'varchar(100)' },
    state: { type: 'varchar(50)' },
    postal_code: { type: 'varchar(20)' },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createTable('lead_sources', {
    id: 'id',
    code: { type: 'varchar(50)', notNull: true, unique: true },
    name: { type: 'varchar(100)', notNull: true },
    is_active: { type: 'boolean', notNull: true, default: true },
  });

  pgm.createTable('lead_statuses', {
    id: 'id',
    code: { type: 'varchar(50)', notNull: true, unique: true },
    name: { type: 'varchar(100)', notNull: true },
    sort_order: { type: 'integer', notNull: true },
    is_terminal: { type: 'boolean', notNull: true, default: false },
  });

  pgm.createTable('service_types', {
    id: 'id',
    code: { type: 'varchar(80)', notNull: true, unique: true },
    name: { type: 'varchar(120)', notNull: true },
    is_active: { type: 'boolean', notNull: true, default: true },
  });

  pgm.createTable('leads', {
    id: 'id',
    primary_contact_id: {
      type: 'integer',
      notNull: true,
      references: 'contacts',
      onDelete: 'restrict',
    },
    service_address_id: {
      type: 'integer',
      references: 'addresses',
      onDelete: 'set null',
    },
    lead_source_id: {
      type: 'integer',
      notNull: true,
      references: 'lead_sources',
      onDelete: 'restrict',
    },
    lead_status_id: {
      type: 'integer',
      notNull: true,
      references: 'lead_statuses',
      onDelete: 'restrict',
    },
    assigned_user_id: {
      type: 'integer',
      references: 'users',
      onDelete: 'set null',
    },
    service_type_id: {
      type: 'integer',
      notNull: true,
      references: 'service_types',
      onDelete: 'restrict',
    },
    description: { type: 'text' },
    quoted_price: { type: 'numeric(10,2)' },
    next_action: { type: 'text' },
    next_action_due_at: { type: 'timestamp with time zone' },
    closed_lost_reason: { type: 'text' },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createTable('lead_notes', {
    id: 'id',
    lead_id: {
      type: 'integer',
      notNull: true,
      references: 'leads',
      onDelete: 'cascade',
    },
    author_user_id: {
      type: 'integer',
      references: 'users',
      onDelete: 'set null',
    },
    note_body: { type: 'text', notNull: true },
    created_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
    updated_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createTable('lead_status_history', {
    id: 'id',
    lead_id: {
      type: 'integer',
      notNull: true,
      references: 'leads',
      onDelete: 'cascade',
    },
    from_status_id: {
      type: 'integer',
      references: 'lead_statuses',
      onDelete: 'set null',
    },
    to_status_id: {
      type: 'integer',
      notNull: true,
      references: 'lead_statuses',
      onDelete: 'restrict',
    },
    changed_by_user_id: {
      type: 'integer',
      references: 'users',
      onDelete: 'set null',
    },
    changed_at: {
      type: 'timestamp with time zone',
      notNull: true,
      default: pgm.func('current_timestamp'),
    },
  });

  pgm.createIndex('contacts', 'phone');
  pgm.createIndex('contacts', 'email');
  pgm.createIndex('leads', 'assigned_user_id');
  pgm.createIndex('leads', 'lead_status_id');
  pgm.createIndex('leads', 'lead_source_id');
  pgm.createIndex('leads', 'service_type_id');
  pgm.createIndex('leads', 'next_action_due_at');
  pgm.createIndex('lead_notes', 'lead_id');
  pgm.createIndex('lead_status_history', 'lead_id');

  pgm.sql(`
    INSERT INTO lead_sources (code, name, is_active) VALUES
      ('website', 'Website', true),
      ('phone', 'Phone', true),
      ('google_business', 'Google Business', true),
      ('facebook', 'Facebook', true),
      ('thumbtack', 'Thumbtack', true),
      ('angi', 'Angi', true),
      ('referral', 'Referral', true),
      ('other', 'Other', true);
  `);

  pgm.sql(`
    INSERT INTO lead_statuses (code, name, sort_order, is_terminal) VALUES
      ('new', 'New Lead', 1, false),
      ('contacted', 'Contacted', 2, false),
      ('waiting_customer', 'Waiting on Customer', 3, false),
      ('scheduled', 'Scheduled', 4, false),
      ('completed', 'Completed', 5, false),
      ('paid', 'Paid', 6, true),
      ('closed_lost', 'Closed Lost', 7, true);
  `);

  pgm.sql(`
    INSERT INTO service_types (code, name, is_active) VALUES
      ('opener_install', 'Opener Install', true),
      ('opener_programming', 'Opener Programming', true),
      ('keypad_remote_programming', 'Keypad / Remote Programming', true),
      ('troubleshooting', 'Troubleshooting', true),
      ('general_service', 'General Service', true),
      ('garage_door_repair', 'Garage Door Repair', true),
      ('unknown', 'Unknown', true);
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('lead_status_history');
  pgm.dropTable('lead_notes');
  pgm.dropTable('leads');
  pgm.dropTable('service_types');
  pgm.dropTable('lead_statuses');
  pgm.dropTable('lead_sources');
  pgm.dropTable('addresses');
  pgm.dropTable('contacts');
  pgm.dropTable('users');
};