const fs = require('fs');

const context = fs.readFileSync('src/context/CRMContext.tsx', 'utf8');

// extract insert/update statements
const lines = context.split('\n');
let inInsert = false;
let table = '';

for (const line of lines) {
    if (line.includes('.from(')) {
        const match = line.match(/\.from\('([^']+)'\)/);
        if (match) {
            table = match[1];
        }
    }
}
