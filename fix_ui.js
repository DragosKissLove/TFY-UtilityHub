const fs = require('fs');
const path = 'project/src/components/Cs2ConfigModal.tsx';
let content = fs.readFileSync(path, 'utf8');
content = content.replace(
    /<button disabled className="px-4 py-2\.5 rounded-xl font-medium text-sm border border-white\/5 bg-white\/5 text-gray-500 cursor-not-allowed">\s*Discord Required\s*<\/button>/,
    '<div className="text-amber-500 text-sm flex items-center gap-2 bg-amber-500/10 px-3 py-2 rounded-lg"><AlertCircle size={14} /> Discord Login Required</div>'
);
fs.writeFileSync(path, content);
console.log('Patch complete.');
