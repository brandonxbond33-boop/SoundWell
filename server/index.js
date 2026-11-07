// Zero-dependency HTTP server: JSON API + static web app + ranged audio streaming.
import { createServer } from 'node:http';
import { createReadStream, existsSync, statSync } from 'node:fs';
import { extname, join, normalize, resolve, sep, basename } from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './db.js';
import { search, getSound, stats } from './search.js';

const ROOT = resolve(fileURLToPath(import.meta.url), '../..');
const WEB_DIR = join(ROOT, 'web');
const MEDIA_DIR = join(ROOT, 'data', 'media');

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.json': 'application/json',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.opus': 'audio/ogg', '.wav': 'audio/wav',
  '.flac': 'audio/flac', '.png': 'image/png', '.ico': 'image/x-icon', '.webmanifest': 'application/manifest+json',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  // Ad networks will need their domains added to script-src/frame-src (see docs/ROADMAP.md).
  'Content-Security-Policy': [
    "default-src 'self'", "img-src 'self' data: https:", "media-src 'self' https://cdn.freesound.org https://freesound.org",
    "style-src 'self'", "script-src 'self'", "connect-src 'self'", "frame-ancestors 'none'", "base-uri 'none'",
  ].join('; '),
};

function send(res, status, body, headers = {}) {
  const isJson = typeof body !== 'string' && !Buffer.isBuffer(body);
  const payload = isJson ? JSON.stringify(body) : body;
  res.writeHead(status, {
    ...SECURITY_HEADERS,
    'Content-Type': isJson ? 'application/json; charset=utf-8' : 'text/plain; charset=utf-8',
    'Content-Length': Buffer.byteLength(payload),
    ...headers,
  });
  res.end(payload);
}

/** Serve a file from `baseDir`, with HTTP Range support (needed for audio seeking). */
function serveFile(req, res, baseDir, relPath, extraHeaders = {}) {
  const filePath = normalize(join(baseDir, relPath));
  if (!filePath.startsWith(baseDir + sep) && filePath !== baseDir) return send(res, 403, 'Forbidden');
  if (!existsSync(filePath) || !statSync(filePath).isFile()) return false;
  const { size, mtimeMs } = statSync(filePath);
  const etag = `W/"${size.toString(16)}-${Math.floor(mtimeMs).toString(16)}"`;
  const headers = {
    ...SECURITY_HEADERS,
    'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    ETag: etag,
    'Cache-Control': baseDir === MEDIA_DIR ? 'public, max-age=31536000, immutable' : 'no-cache',
    ...extraHeaders,
  };
  if (req.headers['if-none-match'] === etag) { res.writeHead(304, headers); return res.end(); }

  const range = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (range) {
    let start = range[1] === '' ? size - Number(range[2]) : Number(range[1]);
    let end = range[1] !== '' && range[2] !== '' ? Number(range[2]) : size - 1;
    start = Math.max(0, start); end = Math.min(end, size - 1);
    if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${size}` }); return res.end(); }
    res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    if (req.method === 'HEAD') return res.end();
    return createReadStream(filePath, { start, end }).pipe(res);
  }
  res.writeHead(200, { ...headers, 'Content-Length': size });
  if (req.method === 'HEAD') return res.end();
  createReadStream(filePath).pipe(res);
  return true;
}

export function createApp(db) {
  const bump = (col) => db.prepare(`UPDATE sounds SET ${col} = ${col} + 1 WHERE id = ? RETURNING *`);
  const bumpPlay = bump('plays');
  const bumpDownload = bump('downloads');

  return createServer((req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = decodeURIComponent(url.pathname);
      const params = Object.fromEntries(url.searchParams);

      if (path === '/api/search' && req.method === 'GET') {
        return send(res, 200, search(db, params), { 'Cache-Control': 'public, max-age=30' });
      }
      if (path === '/api/stats' && req.method === 'GET') return send(res, 200, stats(db));

      let m = /^\/api\/sounds\/(\d+)$/.exec(path);
      if (m && req.method === 'GET') {
        const sound = getSound(db, m[1]);
        return sound ? send(res, 200, sound) : send(res, 404, { error: 'Sound not found' });
      }
      m = /^\/api\/sounds\/(\d+)\/play$/.exec(path);
      if (m && req.method === 'POST') {
        const row = bumpPlay.get(Number(m[1]));
        return row ? send(res, 200, { plays: row.plays }) : send(res, 404, { error: 'Sound not found' });
      }
      m = /^\/api\/sounds\/(\d+)\/download$/.exec(path);
      if (m && req.method === 'GET') {
        const row = bumpDownload.get(Number(m[1]));
        if (!row) return send(res, 404, { error: 'Sound not found' });
        if (/^https?:\/\//.test(row.file_url)) { res.writeHead(302, { Location: row.file_url }); return res.end(); }
        const rel = row.file_url.replace(/^\/media\//, '');
        const name = `${row.slug}${extname(rel)}`;
        const ok = serveFile(req, res, MEDIA_DIR, rel, { 'Content-Disposition': `attachment; filename="${name}"` });
        return ok === false ? send(res, 404, { error: 'File missing' }) : undefined;
      }
      if (path.startsWith('/api/')) return send(res, 404, { error: 'Not found' });

      if (path.startsWith('/media/') && (req.method === 'GET' || req.method === 'HEAD')) {
        const ok = serveFile(req, res, MEDIA_DIR, path.slice('/media/'.length));
        return ok === false ? send(res, 404, 'Not found') : undefined;
      }

      if (req.method === 'GET' || req.method === 'HEAD') {
        const rel = path === '/' ? 'index.html' : path.slice(1);
        const ok = serveFile(req, res, WEB_DIR, rel);
        // SPA fallback: unknown non-file routes get the app shell.
        if (ok === false) {
          if (extname(basename(path))) return send(res, 404, 'Not found');
          return serveFile(req, res, WEB_DIR, 'index.html');
        }
        return;
      }
      send(res, 405, 'Method not allowed');
    } catch (err) {
      console.error(err);
      if (!res.headersSent) send(res, 500, { error: 'Internal error' });
    }
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dbPath = process.env.DB_PATH || join(ROOT, 'data', 'soundwell.db');
  if (!existsSync(dbPath)) {
    console.error(`No database at ${dbPath}. Run "npm run seed" first.`);
    process.exit(1);
  }
  const port = Number(process.env.PORT) || 3000;
  createApp(openDb(dbPath)).listen(port, () => console.log(`Soundwell running at http://localhost:${port}`));
}
