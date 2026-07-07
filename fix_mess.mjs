import fs from 'fs';

let content = fs.readFileSync('src/pages/ToursManagement.tsx', 'utf8');

// Find the index of "Yêu cầu đặc biệt (Gala, Teambuilding, v.v.)"
let idx1 = content.indexOf('Yêu cầu đặc biệt (Gala, Teambuilding, v.v.)');
if (idx1 !== -1) {
  let idx2 = content.indexOf('<div className="grid grid-cols-1 md:grid-cols-4 gap-6">', idx1);
  if (idx2 !== -1) {
    let before = content.substring(0, idx1);
    let after = content.substring(idx2);
    
    // We need to keep the input for customRequirements and close the divs properly
    content = before + 
`Yêu cầu đặc biệt (Gala, Teambuilding, v.v.)</label>
                            <input
                              type="text"
                              placeholder="Ví dụ: Cần Gala dinner, quay phim flycam, Backdrop teambuilding"
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white text-slate-950 font-medium"
                              value={customRequirements}
                              onChange={e => setCustomRequirements(e.target.value)}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  ` + after;
                  
    fs.writeFileSync('src/pages/ToursManagement.tsx', content);
    console.log("Fixed ToursManagement.tsx!");
  }
}

