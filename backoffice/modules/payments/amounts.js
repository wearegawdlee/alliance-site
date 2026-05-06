function money(value) {
  return Number(Number(value || 0).toFixed(2));
}

function payableBase(invoice) {
  if (!invoice) return 0;
  if (invoice.status_code === 'paid') return 0;
  const storedBalance = money(invoice.balance_due);
  const total = money(invoice.total_amount);
  const deposit = money(invoice.deposit_amount);
  const computedBalance = money(Math.max(0, total - deposit));
  return money(Math.max(storedBalance, computedBalance));
}

function amountPaid(paidAmount) {
  return money(paidAmount);
}

function amountDue(invoice, paidAmount = 0) {
  if (!invoice || invoice.status_code === 'paid') return 0;
  return money(Math.max(0, payableBase(invoice) - amountPaid(paidAmount)));
}

function hasAmountDue(invoice, paidAmount = 0) {
  return amountDue(invoice, paidAmount) > 0;
}

module.exports = { money, payableBase, amountDue, hasAmountDue };
