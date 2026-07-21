const fs = require('fs');
let code = fs.readFileSync('src/pages/AccountingInvoice.tsx', 'utf8');

code = code.replace(
  "  const [searchParams, setSearchParams] = useSearchParams();",
  "  const [searchParams, setSearchParams] = useSearchParams();\n  const location = useLocation();\n  const [searchTerm, setSearchTerm] = useState('');\n\n  // Handle click from notifications\n  useEffect(() => {\n    if (location.state?.searchTarget) {\n      setSearchTerm(location.state.searchTarget);\n      setFilterReceiptStatus('all');\n      setFilterPaymentStatus('all');\n      window.history.replaceState({}, document.title);\n    }\n  }, [location.state]);"
);

// Add search term filtering to receiptInvoices
code = code.replace(
  "    .filter(inv => {",
  "    .filter(inv => {\n      if (searchTerm && (!inv.order_id || !inv.order_id.includes(searchTerm))) return false;"
);

fs.writeFileSync('src/pages/AccountingInvoice.tsx', code);
