import fs from 'fs';

function fixFile(file) {
  let content = fs.readFileSync(file, 'utf8');

  // Fix the stray brackets left by sed using regex to ignore exact whitespace
  content = content.replace(
    /\s*<\/div>\s*\}\)\s*<\/div>\s*\}\)\s*<\/div>\s*\}\)\s*<div className="grid grid-cols-1 md:grid-cols-4 gap-6">/g,
    `
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">`
  );

  fs.writeFileSync(file, content);
  console.log(`Fixed ${file}`);
}

fixFile('src/pages/ToursManagement.tsx');
fixFile('src/pages/VisaServices.tsx');
