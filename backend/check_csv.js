const fs = require('fs');
const content = fs.readFileSync('c:/Users/chris/Desktop/Project/DCLIC/DclicApp/progress.mn_072026.csv', 'utf16le');
const lines = content.trim().split('\n');
const headers = lines[0].split('\t').map(s => s.replace(/^\"|\"$/g, ''));
const acts = [];
for(let i=1; i<headers.length; i+=2) {
    if (headers[i]) acts.push(headers[i].trim());
}
console.log('Total activities in CSV:', acts.length);

const codes = acts.map((name, i) => {
    const m = name.match(/M(\d+)([A-C])\./);
    return m ? 'M'+m[1]+m[2] : 'ACT'+i;
});

console.log('Unique codes:', new Set(codes).size);

const counts = {};
codes.forEach(c => counts[c] = (counts[c]||0)+1);
console.log('Duplicated codes:', Object.keys(counts).filter(c => counts[c] > 1).map(c => c + ' (' + counts[c] + ')'));
