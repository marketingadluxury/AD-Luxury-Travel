const fs = require('fs');
let content = fs.readFileSync('src/pages/ToursManagement.tsx', 'utf8');

// The original file probably had 
// tourType === 'private' ...
// tourType === 'visa' ...

// I'll try to find the broken block and fix it.
