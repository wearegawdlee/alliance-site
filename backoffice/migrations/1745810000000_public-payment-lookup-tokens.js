exports.up = (pgm) => {
  pgm.sql(`
    CREATE TABLE IF NOT EXISTS public_payment_lookups (
      id serial PRIMARY KEY,
      token varchar(80) NOT NULL UNIQUE,
      identity_value varchar(255) NOT NULL,
      phone_digits varchar(32),
      invoice_number varchar(100),
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT current_timestamp
    );
    CREATE INDEX IF NOT EXISTS public_payment_lookups_expires_at_idx ON public_payment_lookups(expires_at);
  `);
};

exports.down = (pgm) => {
  pgm.sql(`DROP TABLE IF EXISTS public_payment_lookups;`);
};
