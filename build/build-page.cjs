const fs = require('fs'); const dir = process.argv[2];
const t = fs.readFileSync(dir + '/template.html.txt', 'utf8'); const d3 = JSON.parse(fs.readFileSync(dir + '/sounds3.json', 'utf8')); const proc = JSON.parse(fs.readFileSync(dir + '/proc.json', 'utf8'));
const data = JSON.stringify({ kits: d3.kits, sounds: d3.sounds, proc }).replace(/</g, '\\u003c');
fs.writeFileSync(process.argv[3] || dir + '/index.html', t.replace('/*DATA*/', () => data)); console.log('index.html', Math.round(fs.statSync(process.argv[3] || dir + '/index.html').size / 1024) + 'KB');
