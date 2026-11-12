// Local preview server: node build/serve.mjs site   (http://localhost:3190)
import { createServer } from 'node:http'; import { readFile } from 'node:fs/promises'; import { join, extname } from 'node:path';
const root = process.argv[2]; const T = { '.html': 'text/html', '.mp3': 'audio/mpeg' };
createServer(async (req, res) => { const p = decodeURIComponent(new URL(req.url, 'http://x').pathname); const f = join(root, p === '/' ? 'index.html' : p);
  try { const b = await readFile(f); res.writeHead(200, { 'content-type': T[extname(f)] || 'application/octet-stream' }); res.end(p === '/' ? '<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover"></head><body>' + b + '</body></html>' : b); }
  catch { res.writeHead(404); res.end(); } }).listen(process.env.PORT || 3190);
