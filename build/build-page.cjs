const fs = require('fs'); const dir = process.argv[2];
const t = fs.readFileSync(dir + '/template.html.txt', 'utf8'); const d3 = JSON.parse(fs.readFileSync(dir + '/sounds3.json', 'utf8')); const proc = JSON.parse(fs.readFileSync(dir + '/proc.json', 'utf8'));
const fsPath = dir + '/freesound.json'; const rec = fs.existsSync(fsPath) ? JSON.parse(fs.readFileSync(fsPath, 'utf8')).sounds.map(({ fsid, query, rating, ...s }, i) => ({ id: 900000 + i, ...s })) : [];
const data = JSON.stringify({ kits: d3.kits, sounds: [...d3.sounds, ...rec], proc }).replace(/</g, '\\u003c');
fs.writeFileSync(process.argv[3] || dir + '/index.html', t.replace('/*DATA*/', () => data)); console.log('index.html', Math.round(fs.statSync(process.argv[3] || dir + '/index.html').size / 1024) + 'KB');
