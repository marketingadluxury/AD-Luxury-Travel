import fs from 'fs';

let content = fs.readFileSync('src/pages/VisaServices.tsx', 'utf8');

// Also fix the visa file which has different structure now since I replaced some parts.
content = content.replace(
  /\{\/\* Dynamic Tour Type Specific Fields \*\/\}.*?\{tourType !== 'internal' && \(/s,
  `{/* Dynamic Tour Type Specific Fields */}`
);

fs.writeFileSync('src/pages/VisaServices.tsx', content);
