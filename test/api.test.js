import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { openDb, upsertSound } from '../server/db.js';
import { createApp } from '../server/index.js';
import { toFtsQuery } from '../server/search.js';
import { mapLicense } from '../scripts/import-freesound.js';

let server; let base;
const fixture = (o) => ({
  kind: 'sfx', category: 'Nature', duration: 3, license: 'CC0', author: 'Tester',
  file_url: '/media/x.mp3', preview_url: '/media/x.mp3', peaks: [10, 50, 90], ...o,
});

before(async () => {
  const db = openDb(':memory:');
  upsertSound(db, fixture({ slug: 'rain', title: 'Heavy Rain', tags: ['rain', 'storm', 'ambience'], description: 'Rain on a roof', loopable: true, duration: 12 }));
  upsertSound(db, fixture({ slug: 'thunder', title: 'Thunder Clap', tags: ['thunder', 'storm'], license: 'CC-BY-4.0', duration: 4 }));
  upsertSound(db, fixture({ slug: 'click', title: 'Button Click', category: 'Interface', tags: ['click', 'ui'], duration: 0.2 }));
  upsertSound(db, fixture({ slug: 'lofi', title: 'Lofi Beat', kind: 'music', category: 'Lo-fi', tags: ['lofi', 'chill'], bpm: 80, mood: 'Calm', duration: 30 }));
  upsertSound(db, fixture({ slug: 'house', title: 'House Loop', kind: 'music', category: 'Drums', tags: ['house', 'dance'], bpm: 124, mood: 'Energetic', duration: 8 }));
  server = createApp(db).listen(0);
  base = `http://localhost:${server.address().port}`;
});
after(() => server.close());

const get = async (path) => { const r = await fetch(base + path); return { status: r.status, body: await r.json() }; };

test('search ranks title matches and returns facets', async () => {
  const { body } = await get('/api/search?q=storm');
  assert.equal(body.total, 2);
  assert.deepEqual(body.facets.license.map((l) => l.value).sort(), ['CC-BY-4.0', 'CC0']);
  const { body: b2 } = await get('/api/search?q=thunder');
  assert.equal(b2.items[0].title, 'Thunder Clap');
});

test('prefix and synonym matching', async () => {
  assert.equal((await get('/api/search?q=thund')).body.total, 1);
  // "ui" expands to interface/button
  assert.equal((await get('/api/search?q=button')).body.items[0].slug, 'click');
  assert.equal((await get('/api/search?q=chill')).body.items[0].slug, 'lofi');
});

test('filters: kind, license, duration, loopable, bpm', async () => {
  assert.equal((await get('/api/search?kind=music')).body.total, 2);
  assert.equal((await get('/api/search?license=CC-BY-4.0')).body.total, 1);
  assert.equal((await get('/api/search?duration=short')).body.items[0].slug, 'click');
  assert.equal((await get('/api/search?loopable=1')).body.items[0].slug, 'rain');
  assert.equal((await get('/api/search?kind=music&bpm_min=100')).body.items[0].slug, 'house');
  assert.equal((await get('/api/search?category=Nature,Interface')).body.total, 3);
});

test('facet counts ignore their own filter (multi-select)', async () => {
  const { body } = await get('/api/search?category=Nature');
  const cats = Object.fromEntries(body.facets.category.map((c) => [c.value, c.count]));
  assert.equal(cats.Interface, 1);
  assert.equal(cats.Nature, 2);
});

test('FTS syntax in user input is neutralized', async () => {
  assert.equal(toFtsQuery('  '), null);
  assert.equal(toFtsQuery('a" OR "b'), '"a"* AND "or"* AND "b"*');
  const { status } = await get(`/api/search?q=${encodeURIComponent('") NEAR(* -')}`);
  assert.equal(status, 200);
});

test('sound detail includes license info and similar sounds', async () => {
  const { body: list } = await get('/api/search?q=rain');
  const { status, body } = await get(`/api/sounds/${list.items[0].id}`);
  assert.equal(status, 200);
  assert.equal(body.license.attribution, false);
  assert.ok(body.similar.some((s) => s.slug === 'thunder'));
  assert.equal((await get('/api/sounds/99999')).status, 404);
});

test('play counter increments', async () => {
  const r = await fetch(`${base}/api/sounds/1/play`, { method: 'POST' });
  assert.equal((await r.json()).plays, 1);
});

test('pagination is bounded', async () => {
  const { body } = await get('/api/search?per=2&page=2');
  assert.equal(body.items.length, 2);
  assert.equal(body.pages, 3);
  assert.equal((await get('/api/search?per=100000')).body.per, 100);
});

test('SPA fallback and static traversal protection', async () => {
  const r = await fetch(`${base}/sound/1/rain`);
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /text\/html/);
  assert.match(r.headers.get('content-security-policy'), /default-src 'self'/);
  assert.equal((await fetch(`${base}/nope.js`)).status, 404);
});

test('rejects licenses we do not host', () => {
  const db = openDb(':memory:');
  assert.throws(() => upsertSound(db, fixture({ slug: 'nc', title: 'NC', license: 'CC-BY-NC-4.0' })), /Unsupported license/);
  assert.equal(mapLicense('http://creativecommons.org/licenses/by-nc/3.0/'), null);
  assert.equal(mapLicense('http://creativecommons.org/publicdomain/zero/1.0/'), 'CC0');
});
