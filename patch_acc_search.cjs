const fs = require('fs');
let code = fs.readFileSync('src/pages/AccountingInvoice.tsx', 'utf8');

const searchHtml = `
      {/* Filters and Search */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-center bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Tìm kiếm theo mã đơn hàng hoặc mã phiếu..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-10 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all outline-none"
          />
          {searchTerm && (
            <button
              onClick={() => setSearchTerm('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1 rounded-full hover:bg-gray-200 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500 font-medium">
          <TrendingUp className="w-4 h-4" />
          <span>Theo dõi các luồng dòng tiền</span>
        </div>
      </div>
`;

code = code.replace(
  "{/* Stats summary */}",
  searchHtml + "\n      {/* Stats summary */}"
);

// We need to import Search
if (!code.includes('Search')) {
  code = code.replace('Receipt,', 'Receipt,\n  Search,');
}

// And check that searchTerm matches on invoice_code too
code = code.replace(
  "      if (searchTerm && (!inv.order_id || !inv.order_id.includes(searchTerm))) return false;",
  "      if (searchTerm && (!inv.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) && !inv.invoice_code?.toLowerCase().includes(searchTerm.toLowerCase()))) return false;"
);
// Replace it 3 times (for receipt, payment, vat)
code = code.replace(
  "      if (searchTerm && (!inv.order_id || !inv.order_id.includes(searchTerm))) return false;",
  "      if (searchTerm && (!inv.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) && !inv.invoice_code?.toLowerCase().includes(searchTerm.toLowerCase()))) return false;"
);
code = code.replace(
  "      if (searchTerm && (!inv.order_id || !inv.order_id.includes(searchTerm))) return false;",
  "      if (searchTerm && (!inv.order_id?.toLowerCase().includes(searchTerm.toLowerCase()) && !inv.invoice_code?.toLowerCase().includes(searchTerm.toLowerCase()))) return false;"
);

fs.writeFileSync('src/pages/AccountingInvoice.tsx', code);
