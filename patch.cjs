const fs = require('fs');
let code = fs.readFileSync('src/pages/VisaProcessing.tsx', 'utf8');
const hookStr = `
  // Xử lý click từ thông báo
  useEffect(() => {
    if (location.state?.searchTarget) {
      setSearchTerm(location.state.searchTarget);
      setFilterStatus('all');
      setFilterTimeRange('all');
      
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);
`;
code = code.replace("  const [sortBy, setSortBy] = useState('newest_created');", "  const [sortBy, setSortBy] = useState('newest_created');\n" + hookStr);
fs.writeFileSync('src/pages/VisaProcessing.tsx', code);
