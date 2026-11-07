// Search + facet queries. All user input is bound as parameters; the FTS query string
// is rebuilt from sanitized tokens so users can't inject FTS5 syntax.
import { LICENSES } from './db.js';

export const DURATIONS = {
  short: [0, 1],      // UI blips, hits
  medium: [1, 5],
  long: [5, 30],
  xlong: [30, 1e9],
};

const SORTS = {
  relevance: null, // bm25 when there's a query, popular otherwise
  popular: 's.downloads DESC, s.plays DESC, s.id DESC',
  newest: 's.created_at DESC, s.id DESC',
  shortest: 's.duration ASC, s.id ASC',
  longest: 's.duration DESC, s.id ASC',
};

const SYNONYMS = {
  sfx: ['effect'], ui: ['interface', 'button'], gun: ['shot', 'weapon'], beat: ['drum', 'loop'],
  ambience: ['ambient', 'atmosphere'], ambient: ['ambience', 'atmosphere'], bgm: ['music', 'background'],
  notification: ['alert', 'ping'], alert: ['notification', 'alarm'], scary: ['dark', 'horror', 'tension'],
  retro: ['8bit', 'chiptune'], '8bit': ['retro', 'chiptune'], chill: ['calm', 'relaxing', 'lofi'],
};

/** "rain on roof" -> ("rain"* OR "ambience"*) AND ("roof"*) */
export function toFtsQuery(q) {
  const tokens = String(q || '')
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((t) => t.length > 0)
    .slice(0, 12);
  if (!tokens.length) return null;
  return tokens
    .map((t) => {
      const alts = [t, ...(SYNONYMS[t] || [])].map((a) => `"${a.replace(/"/g, '')}"*`);
      return alts.length > 1 ? `(${alts.join(' OR ')})` : alts[0];
    })
    .join(' AND ');
}

function list(v) {
  if (v == null || v === '') return [];
  return (Array.isArray(v) ? v : String(v).split(',')).map((x) => x.trim()).filter(Boolean).slice(0, 20);
}

/** Build WHERE clause. `skip` omits one facet so facet counts stay useful (multi-select). */
function buildWhere(p, skip) {
  const where = [];
  const args = [];
  const fts = toFtsQuery(p.q);
  if (fts) {
    where.push('s.id IN (SELECT rowid FROM sounds_fts WHERE sounds_fts MATCH ?)');
    args.push(fts);
  }
  if (p.kind === 'sfx' || p.kind === 'music') { where.push('s.kind = ?'); args.push(p.kind); }

  const inList = (col, vals, name) => {
    if (skip === name || !vals.length) return;
    where.push(`${col} IN (${vals.map(() => '?').join(',')})`);
    args.push(...vals);
  };
  inList('s.category', list(p.category), 'category');
  inList('s.license', list(p.license).filter((l) => LICENSES[l]), 'license');
  inList('s.mood', list(p.mood), 'mood');

  const durs = list(p.duration).filter((d) => DURATIONS[d]);
  if (skip !== 'duration' && durs.length) {
    where.push(`(${durs.map(() => '(s.duration >= ? AND s.duration < ?)').join(' OR ')})`);
    for (const d of durs) args.push(...DURATIONS[d]);
  }
  if (p.loopable === '1' || p.loopable === true) where.push('s.loopable = 1');
  const bmin = Number.parseInt(p.bpm_min, 10);
  const bmax = Number.parseInt(p.bpm_max, 10);
  if (Number.isFinite(bmin)) { where.push('s.bpm >= ?'); args.push(bmin); }
  if (Number.isFinite(bmax)) { where.push('s.bpm <= ?'); args.push(bmax); }
  if (p.exclude) { where.push('s.id != ?'); args.push(Number(p.exclude) || 0); }

  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', args, fts };
}

export function serialize(row) {
  if (!row) return row;
  const lic = LICENSES[row.license];
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    kind: row.kind,
    category: row.category,
    tags: row.tags ? row.tags.split(' ') : [],
    mood: row.mood,
    duration: row.duration,
    bpm: row.bpm,
    key: row.music_key,
    loopable: !!row.loopable,
    license: { code: row.license, ...lic },
    author: row.author,
    authorUrl: row.author_url,
    source: row.source,
    sourceUrl: row.source_url,
    previewUrl: row.preview_url,
    downloadUrl: `/api/sounds/${row.id}/download`,
    peaks: row.peaks ? JSON.parse(row.peaks) : null,
    plays: row.plays,
    downloads: row.downloads,
    createdAt: row.created_at,
  };
}

export function search(db, p = {}) {
  const per = Math.min(Math.max(Number.parseInt(p.per, 10) || 24, 1), 100);
  const page = Math.min(Math.max(Number.parseInt(p.page, 10) || 1, 1), 1000);
  const { sql, args, fts } = buildWhere(p);

  let order = SORTS[p.sort] || null;
  let from = 'sounds s';
  const fromArgs = [];
  if (!order) {
    if (fts) {
      // Rank by bm25 with column weights: title > tags > category > description.
      from = `sounds s JOIN (SELECT rowid, bm25(sounds_fts, 10.0, 2.0, 5.0, 3.0, 2.0, 1.0) AS rank
              FROM sounds_fts WHERE sounds_fts MATCH ?) r ON r.rowid = s.id`;
      fromArgs.push(fts);
      order = 'r.rank ASC, s.downloads DESC';
    } else {
      order = SORTS.popular;
    }
  }

  const total = db.prepare(`SELECT count(*) AS n FROM sounds s ${sql}`).get(...args).n;
  const rows = db
    .prepare(`SELECT s.* FROM ${from} ${sql} ORDER BY ${order} LIMIT ? OFFSET ?`)
    .all(...fromArgs, ...args, per, (page - 1) * per);

  return { total, page, per, pages: Math.ceil(total / per), items: rows.map(serialize), facets: facets(db, p) };
}

export function facets(db, p) {
  const out = {};
  for (const name of ['category', 'license', 'mood']) {
    const { sql, args } = buildWhere(p, name);
    const rows = db
      .prepare(`SELECT s.${name} AS v, count(*) AS n FROM sounds s ${sql}
                ${sql ? 'AND' : 'WHERE'} s.${name} IS NOT NULL GROUP BY v ORDER BY n DESC, v ASC`)
      .all(...args);
    out[name] = rows.map((r) => ({ value: r.v, count: r.n }));
  }
  const { sql, args } = buildWhere(p, 'duration');
  const dur = db.prepare(`SELECT s.duration AS d FROM sounds s ${sql}`).all(...args);
  out.duration = Object.entries(DURATIONS).map(([value, [a, b]]) => ({
    value, count: dur.filter((r) => r.d >= a && r.d < b).length,
  }));
  return out;
}

export function getSound(db, id) {
  const row = db.prepare('SELECT * FROM sounds WHERE id = ?').get(Number(id) || 0);
  if (!row) return null;
  const sound = serialize(row);
  // "More like this": same kind, ranked by shared tags/category through FTS.
  const terms = [...new Set([...sound.tags, sound.category.toLowerCase()])].slice(0, 8);
  let similar = [];
  if (terms.length) {
    const q = terms.map((t) => `"${t.replace(/"/g, '')}"`).join(' OR ');
    similar = db.prepare(
      `SELECT s.* FROM sounds s JOIN (SELECT rowid, bm25(sounds_fts) AS rank FROM sounds_fts WHERE sounds_fts MATCH ?) r
       ON r.rowid = s.id WHERE s.id != ? AND s.kind = ? ORDER BY r.rank ASC LIMIT 6`,
    ).all(q, row.id, row.kind).map(serialize);
  }
  return { ...sound, similar };
}

export function stats(db) {
  const r = db.prepare(`SELECT count(*) AS total,
      sum(kind='sfx') AS sfx, sum(kind='music') AS music, sum(duration) AS seconds,
      count(DISTINCT author) AS creators FROM sounds`).get();
  const categories = db.prepare(
    `SELECT kind, category, count(*) AS n FROM sounds GROUP BY kind, category ORDER BY n DESC`,
  ).all().map((c) => ({ kind: c.kind, category: c.category, count: c.n }));
  return { ...r, categories };
}
