const fs = require('fs');
let code = fs.readFileSync('src/pages/AccountingInvoice.tsx', 'utf8');

// For paymentInvoices
code = code.replace(
  "  const paymentInvoices = invoices\n    .filter(inv => {\n      if (inv.type !== 'payment') return false;",
  "  const paymentInvoices = invoices\n    .filter(inv => {\n      if (inv.type !== 'payment') return false;\n      if (searchTerm && (!inv.order_id || !inv.order_id.includes(searchTerm))) return false;"
);

// For vatInvoices
code = code.replace(
  "  const vatInvoices = invoices\n    .filter(inv => {",
  "  const vatInvoices = invoices\n    .filter(inv => {\n      if (searchTerm && (!inv.order_id || !inv.order_id.includes(searchTerm))) return false;"
);

fs.writeFileSync('src/pages/AccountingInvoice.tsx', code);
