import fs from 'fs';
let content = fs.readFileSync('src/pages/VisaServices.tsx', 'utf8');

content = content.replace(
`                          </div>
                        </div>
                      )}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">`,
`                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">`
);

fs.writeFileSync('src/pages/VisaServices.tsx', content);
