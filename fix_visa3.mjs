import fs from 'fs';
let content = fs.readFileSync('src/pages/VisaServices.tsx', 'utf8');

// 1. set default to 'visa'
content = content.replace(
  "const [tourType, setTourType] = useState<Tour['tour_type']>('internal');",
  "const [tourType, setTourType] = useState<Tour['tour_type']>('visa');"
);

// 2. Hide tour type selector and dynamic fields
let typeSelectRegex = /<div>\s*<label className="block text-sm font-medium text-gray-700 mb-1">Loại hình sản phẩm \*<\/label>\s*<select.*?<\/select>\s*<\/div>\s*<\/div>\s*\{\/\* Dynamic Tour Type Specific Fields \*\/\}.*?\{tourType !== 'internal' && \(/s;

content = content.replace(typeSelectRegex,
`<div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Loại hình sản phẩm *</label>
                      <div className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-gray-50 font-semibold text-slate-800">
                        🛂 Dịch vụ Visa lẻ
                      </div>
                    </div>
                  </div>
                  
                  {tourType !== 'internal' && (`);

fs.writeFileSync('src/pages/VisaServices.tsx', content);
