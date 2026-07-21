const fs = require('fs');
let code = fs.readFileSync('src/pages/AccountingInvoice.tsx', 'utf8');

// The incorrect part:
// <Upload,
//   Search className="w-3.5 h-3.5" />
code = code.replace(
  /<Upload,[\s\S]*?Search className=/g,
  "<Upload className="
);

// We need to make sure the import is correct.
if (!code.includes("  Search\n} from 'lucide-react';")) {
  code = code.replace("} from 'lucide-react';", "  Search\n} from 'lucide-react';");
}

fs.writeFileSync('src/pages/AccountingInvoice.tsx', code);
