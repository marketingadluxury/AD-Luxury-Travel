const fs = require('fs');
let code = fs.readFileSync('src/pages/Dashboard.tsx', 'utf8');

code = code.replace(
  'h3 className="text-2xl font-black text-gray-900 group-hover:text-blue-600 transition-colors break-words"',
  'h3 className="text-xl sm:text-2xl font-black text-gray-900 group-hover:text-blue-600 transition-colors break-words"'
);

// Do the same for others just in case
code = code.replace(
  'h3 className="text-2xl font-black text-gray-900 group-hover:text-emerald-600 transition-colors break-words"',
  'h3 className="text-xl sm:text-2xl font-black text-gray-900 group-hover:text-emerald-600 transition-colors break-words"'
);

code = code.replace(
  'h3 className="text-2xl font-black text-gray-900 group-hover:text-amber-600 transition-colors break-words"',
  'h3 className="text-xl sm:text-2xl font-black text-gray-900 group-hover:text-amber-600 transition-colors break-words"'
);

code = code.replace(
  'h3 className="text-2xl font-black text-gray-900 group-hover:text-emerald-600 transition-colors break-words"',
  'h3 className="text-xl sm:text-2xl font-black text-gray-900 group-hover:text-emerald-600 transition-colors break-words"'
);

fs.writeFileSync('src/pages/Dashboard.tsx', code);
