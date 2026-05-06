exports.up = (pgm) => {
  pgm.sql(`
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS public_payment_token varchar(80);
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS public_payment_token_expires_at timestamptz;
    ALTER TABLE invoices ADD COLUMN IF NOT EXISTS public_payment_last_viewed_at timestamptz;
    CREATE UNIQUE INDEX IF NOT EXISTS invoices_public_payment_token_unique
      ON invoices(public_payment_token)
      WHERE public_payment_token IS NOT NULL;
  `);
};

exports.down = (pgm) => {
  pgm.sql(`
    DROP INDEX IF EXISTS invoices_public_payment_token_unique;
    ALTER TABLE invoices DROP COLUMN IF EXISTS public_payment_last_viewed_at;
    ALTER TABLE invoices DROP COLUMN IF EXISTS public_payment_token_expires_at;
    ALTER TABLE invoices DROP COLUMN IF EXISTS public_payment_token;
  `);
};
