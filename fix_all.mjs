import fs from 'fs';
let content = fs.readFileSync('src/pages/ToursManagement.tsx', 'utf8');

// I will output the section to see what happened.
let lines = content.split('\n');
console.log(lines.slice(1445, 1465).join('\n'));
