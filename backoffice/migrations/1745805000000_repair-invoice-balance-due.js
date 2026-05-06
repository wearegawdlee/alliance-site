exports.up = async (pgm) => {
  pgm.sql(`
    UPDATE invoices
    SET balance_due = GREATEST(0, total_amount - COALESCE(deposit_amount, 0)),
        updated_at = current_timestamp
    WHERE COALESCE(balance_due, 0) = 0
      AND COALESCE(total_amount, 0) > 0
      AND COALESCE(deposit_amount, 0) < COALESCE(total_amount, 0)
      AND invoice_status_id <> (SELECT id FROM invoice_statuses WHERE code='paid');
  `);
};

exports.down = async () => {};
