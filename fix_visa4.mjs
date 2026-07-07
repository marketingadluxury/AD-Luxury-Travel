import fs from 'fs';
let content = fs.readFileSync('src/pages/VisaServices.tsx', 'utf8');

// Export name fix
content = content.replace("export default function ToursManagement() {", "export default function VisaServices() {");

// We should also change filter in VisaServices.tsx so it ONLY shows visa
content = content.replace(
  "const filteredTours = activeTab === 'all' ? tours : tours.filter(t => t.status === activeTab);",
  "const filteredTours = (activeTab === 'all' ? tours : tours.filter(t => t.status === activeTab)).filter(t => t.tour_type === 'visa');"
);

fs.writeFileSync('src/pages/VisaServices.tsx', content);
