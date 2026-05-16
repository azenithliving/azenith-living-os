const fs = require('fs');

const path = 'components/AzenithLegacy.tsx';
let code = fs.readFileSync(path, 'utf8');

code = code.replace(/slide\.stats\.map\(s => \(\{/g, 'slide.stats.map((s: any) => ({');

fs.writeFileSync(path, code);
