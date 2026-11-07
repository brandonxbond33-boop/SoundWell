// Soundwell front end — vanilla JS, no build step.
const CONFIG = window.SOUNDWELL_CONFIG || { ads: { enabled: false } };
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const icon = (name) => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
const store = {
  get(k, d) { try { const v = localStorage.getItem(`sw:${k}`); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(`sw:${k}`, JSON.stringify(v)); } catch { /* private mode */ } },
};

function fmtTime(s) {
  if (!Number.isFinite(s)) return '0:00';
  if (s > 0 && s < 1) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
}
function spokenTime(s) {
  if (s > 0 && s < 1) return `${s.toFixed(1)} seconds`;
  s = Math.round(s || 0);
  const m = Math.floor(s / 60); const r = s % 60;
  return m ? `${m} minute${m === 1 ? '' : 's'} ${r} second${r === 1 ? '' : 's'}` : `${r} second${r === 1 ? '' : 's'}`;
}
// Player clock: tenths of a second for short clips, m:ss otherwise.
const fmtClock = (s, total = s) => (total < 10
  ? `${(s || 0).toFixed(1)}s`
  : `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`);
const soundPath = (s) => `/sound/${s.id}/${s.slug}`;

// ---------- live region + toast ----------
let announceTimer;
function announce(msg) {
  const el = $('#announcer');
  el.textContent = '';
  clearTimeout(announceTimer);
  announceTimer = setTimeout(() => { el.textContent = msg; }, 60);
}
let toastTimer;
function toast(msg) {
  const el = $('#toast');
  el.textContent = msg; el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

// ---------- API ----------
const cache = new Map();
let inflight;
async function api(path, { abortable = false } = {}) {
  if (cache.has(path)) return cache.get(path);
  if (abortable) { inflight?.abort(); inflight = new AbortController(); }
  const res = await fetch(path, abortable ? { signal: inflight.signal } : {});
  if (!res.ok) throw Object.assign(new Error(`HTTP ${res.status}`), { status: res.status });
  const data = await res.json();
  if (path.startsWith('/api/search')) { cache.set(path, data); if (cache.size > 60) cache.delete(cache.keys().next().value); }
  return data;
}

// ---------- item registry (for player, favorites, copy) ----------
const items = new Map();
const remember = (list) => { for (const s of list) items.set(String(s.id), s); return list; };

// ---------- waveform ----------
let waveUid = 0;
function waveSvg(peaks, id, cls = '') {
  const p = peaks?.length ? peaks : Array(60).fill(12);
  const W = p.length * 3; const uid = `w${++waveUid}`;
  const bars = p.map((v, i) => `<rect x="${i * 3}" y="${(100 - v) / 2}" width="2" height="${v}" rx="1"/>`).join('');
  return `<svg class="wave ${cls}" viewBox="0 0 ${W} 100" preserveAspectRatio="none" aria-hidden="true" focusable="false" data-wave-id="${id}">
    <defs><clipPath id="${uid}"><rect class="clip" width="0" height="100"/></clipPath></defs>
    <g class="bars">${bars}</g><g class="played" clip-path="url(#${uid})">${bars}</g></svg>`;
}
function setWaveProgress(id, ratio) {
  for (const svg of $$(`svg[data-wave-id="${id}"]`)) {
    const W = svg.viewBox.baseVal.width;
    svg.querySelector('.clip').setAttribute('width', String(W * Math.min(1, Math.max(0, ratio))));
  }
}

// ---------- favorites ----------
let favs = store.get('favs', []);
const isFav = (id) => favs.some((f) => String(f.id) === String(id));
function toggleFav(id) {
  const item = items.get(String(id)) || favs.find((f) => String(f.id) === String(id));
  if (!item) return;
  if (isFav(id)) { favs = favs.filter((f) => String(f.id) !== String(id)); toast(`Removed “${item.title}” from Saved`); }
  else { favs = [{ ...item, savedAt: Date.now() }, ...favs]; toast(`Saved “${item.title}”`); }
  store.set('favs', favs);
  syncFavUI();
}
function syncFavUI() {
  $('#fav-count').textContent = favs.length;
  for (const b of $$('[data-fav]')) {
    const on = isFav(b.dataset.fav);
    b.setAttribute('aria-pressed', String(on));
    b.querySelector('use').setAttribute('href', on ? '#i-heart-fill' : '#i-heart');
  }
  if (player.current) {
    const on = isFav(player.current.id);
    $('#p-fav').setAttribute('aria-pressed', String(on));
    $('#p-fav use').setAttribute('href', on ? '#i-heart-fill' : '#i-heart');
  }
}

// ---------- credit / attribution ----------
function creditText(s) {
  const link = s.sourceUrl || `${location.origin}${soundPath(s)}`;
  if (!s.license.attribution) return `“${s.title}” by ${s.author} (${link}) — ${s.license.name}. No attribution required.`;
  return `“${s.title}” by ${s.author} (${link}) — licensed under ${s.license.name}: ${s.license.url}`;
}
async function copyCredit(id) {
  const s = items.get(String(id)); if (!s) return;
  const text = creditText(s);
  try { await navigator.clipboard.writeText(text); }
  catch {
    const ta = Object.assign(document.createElement('textarea'), { value: text });
    document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove();
  }
  toast(s.license.attribution ? 'Credit copied — paste it in your description' : 'Credit copied (optional for CC0)');
}

// ---------- components ----------
function badge(s) {
  return `<span class="badge ${s.license.attribution ? 'by' : 'cc0'}" title="${esc(s.license.plain)}">${esc(s.license.code.replace('-4.0', '').replace('-3.0', '').replace('CC-BY', 'CC BY'))}</span>`;
}
function soundRow(s) {
  const playing = player.current?.id === s.id && !player.audio.paused;
  const meta = [s.category, s.kind === 'music' && s.bpm ? `${s.bpm} BPM` : null, s.key, s.mood, s.loopable ? 'Loop' : null].filter(Boolean);
  return `<li class="row${player.current?.id === s.id ? ' is-current' : ''}" data-row="${s.id}">
    <button class="play-btn" type="button" data-play="${s.id}" aria-pressed="${playing}" aria-label="${playing ? 'Pause' : 'Play'} ${esc(s.title)}">${icon(playing ? 'pause' : 'play')}</button>
    <div class="row-main">
      <a class="row-title" href="${soundPath(s)}" data-link>${esc(s.title)}</a>
      <div class="row-meta">${meta.map((m, i) => `<span class="${i ? 'dot' : ''}${m === 'Loop' ? ' tag-loop' : ''}">${esc(m)}</span>`).join('')}</div>
      <p class="row-desc">${esc(s.description)}</p>
    </div>
    <div class="row-wave" data-seek="${s.id}">${waveSvg(s.peaks, s.id)}</div>
    <span class="dur"><span class="visually-hidden">Duration: ${spokenTime(s.duration)}</span><span aria-hidden="true">${fmtTime(s.duration)}</span></span>
    <div class="row-actions">
      ${badge(s)}
      <button class="icon-btn" type="button" data-fav="${s.id}" aria-pressed="${isFav(s.id)}" aria-label="Save ${esc(s.title)}">${icon(isFav(s.id) ? 'heart-fill' : 'heart')}</button>
      <button class="icon-btn" type="button" data-copy="${s.id}" aria-label="Copy credit for ${esc(s.title)}">${icon('copy')}</button>
      <a class="icon-btn" href="${s.downloadUrl}" download aria-label="Download ${esc(s.title)} (MP3)">${icon('download')}</a>
    </div>
  </li>`;
}
function adRow() {
  if (!CONFIG.ads?.enabled) return '';
  return `<li class="ad-row"><div class="ad"><span class="ad-label">Advertisement</span>
    <div class="ad-box"><span><strong>Your brand here.</strong> Reach people making videos, games and podcasts.</span>
    <a class="btn" href="/about#advertise" data-link>Advertise</a></div></div></li>`;
}
function sidebarAd() {
  if (!CONFIG.ads?.enabled) return '';
  return `<div class="ad sidebar-ad"><span class="ad-label">Advertisement</span>
    <div class="ad-box"><strong>Soundwell is free.</strong><span>Ads keep it that way — and never play audio.</span></div></div>`;
}
function resultsHtml(list, offset = 0) {
  const every = CONFIG.ads?.inFeedEvery || 10;
  return list.map((s, i) => soundRow(s) + ((offset + i + 1) % every === 0 ? adRow() : '')).join('');
}

// ---------- URL params ----------
const ARRAY_KEYS = ['category', 'license', 'mood', 'duration'];
const PARAM_KEYS = ['q', 'kind', ...ARRAY_KEYS, 'loopable', 'bpm_min', 'bpm_max', 'sort'];
function readParams() {
  const u = new URLSearchParams(location.search); const p = {};
  for (const k of PARAM_KEYS) {
    const v = u.get(k);
    if (v) p[k] = ARRAY_KEYS.includes(k) ? v.split(',').filter(Boolean) : v;
  }
  return p;
}
function toQuery(p, extra = {}) {
  const u = new URLSearchParams();
  for (const k of PARAM_KEYS) {
    const v = p[k];
    if (Array.isArray(v) ? v.length : v) u.set(k, Array.isArray(v) ? v.join(',') : v);
  }
  for (const [k, v] of Object.entries(extra)) u.set(k, v);
  return u.toString();
}
function setParams(next, { push = false } = {}) {
  const qs = toQuery(next);
  const url = qs ? `/search?${qs}` : (location.pathname === '/' ? '/' : '/search');
  // Leaving the home page creates a history entry; tweaks after that replace it.
  history[push || location.pathname === '/' ? 'pushState' : 'replaceState'](null, '', url);
  route();
}

// ---------- router ----------
let navDepth = 0;
function navigate(url) { navDepth++; history.pushState(null, '', url); route({ focus: true }); window.scrollTo(0, 0); }
let currentView = null;
function route({ focus = false } = {}) {
  const path = location.pathname;
  let m;
  if (path === '/' || path === '/search') return renderBrowse({ focus });
  if ((m = /^\/sound\/(\d+)/.exec(path))) return renderSound(m[1], { focus });
  if (path === '/favorites') return renderFavorites({ focus });
  if (path === '/about') return renderAbout({ focus });
  return renderNotFound();
}
function setView(name, html) {
  currentView = name;
  $('#view').innerHTML = html;
}
function focusHeading(sel = 'h1') {
  const h = $$(`#view ${sel}`).find((el) => el.offsetParent !== null);
  if (h) { if (!h.hasAttribute('tabindex')) h.tabIndex = -1; h.focus({ preventScroll: true }); }
}

// ---------- browse / search view ----------
const KIND_LABEL = { '': 'All', sfx: 'Sound effects', music: 'Music' };
const DUR_LABEL = { short: 'Under 1 second', medium: '1–5 seconds', long: '5–30 seconds', xlong: 'Over 30 seconds' };
const SORT_LABEL = { relevance: 'Best match', popular: 'Most downloaded', newest: 'Newest', shortest: 'Shortest', longest: 'Longest' };
const POPULAR = ['rain', 'whoosh', 'click', 'lofi', 'explosion', 'retro', 'ambience', 'notification', 'drums', 'horror'];
let stats = null;
let browseState = { page: 1, list: [], data: null };

async function renderBrowse({ focus }) {
  const p = readParams();
  const isHome = !p.q && !p.kind && !ARRAY_KEYS.some((k) => p[k]?.length) && !p.loopable && !p.bpm_min && !p.bpm_max && location.pathname === '/';
  $('#q').value = p.q || '';
  document.title = p.q ? `“${p.q}” — Soundwell` : 'Soundwell — free sound effects & music';

  if (currentView !== 'browse') {
    setView('browse', `
      <section class="hero" id="hero" aria-labelledby="hero-title">
        <h1 id="hero-title">Free sounds &amp; music for <span class="accent">anything you make</span>.</h1>
        <p>Instant previews, plain-English licenses, and one-click downloads. No account required.</p>
        <div class="hero-stats" id="hero-stats" aria-live="off"></div>
        <ul class="chips" aria-label="Popular searches">${POPULAR.map((t) => `<li><a class="chip" href="/search?q=${encodeURIComponent(t)}" data-link>${t}</a></li>`).join('')}</ul>
      </section>
      <div class="browse">
        <aside class="sidebar" id="sidebar" aria-label="Filters">
          <div id="filters"></div>
          ${sidebarAd()}
        </aside>
        <section aria-labelledby="results-title">
          <div class="toolbar">
            <h2 id="results-title" tabindex="-1"><span id="results-label">All sounds</span> <span class="result-count" id="result-count"></span></h2>
            <button class="btn filters-btn" type="button" id="filters-open" aria-haspopup="dialog">${icon('filter')} Filters <span id="filters-n"></span></button>
            <div class="segmented" role="group" aria-label="Type">
              ${Object.entries(KIND_LABEL).map(([k, l]) => `<button type="button" data-kind="${k}" aria-pressed="false">${l}</button>`).join('')}
            </div>
            <label class="select-wrap">Sort <select id="sort">${Object.entries(SORT_LABEL).map(([k, l]) => `<option value="${k}">${l}</option>`).join('')}</select></label>
          </div>
          <ul class="active-filters" id="active-filters" aria-label="Active filters"></ul>
          <ul class="results" id="results" aria-busy="true">${'<li class="skeleton"></li>'.repeat(8)}</ul>
          <div class="load-more" id="load-more"></div>
        </section>
      </div>`);
  }
  $('#hero').hidden = !isHome;
  setHeadingLevel('#results-title', isHome ? 'H2' : 'H1');
  if (isHome) loadStats();
  for (const b of $$('[data-kind]')) b.setAttribute('aria-pressed', String((p.kind || '') === b.dataset.kind));
  $('#sort').value = p.sort || 'relevance';
  $('#results-label').textContent = p.q ? `Results for “${p.q}”` : (p.kind ? KIND_LABEL[p.kind] : 'All sounds');

  browseState.page = 1;
  $('#results').setAttribute('aria-busy', 'true');
  try {
    const data = await api(`/api/search?${toQuery(p, { per: 30 })}`, { abortable: true });
    browseState = { page: 1, list: remember(data.items), data };
    renderResults(data, p);
    if (focus && !isHome) focusHeading('#results-title');
  } catch (e) {
    if (e.name === 'AbortError') return;
    $('#results').innerHTML = `<li class="empty"><h2>Something went wrong</h2><p class="muted">We couldn’t load sounds. Check your connection and try again.</p><button class="btn" type="button" data-retry>Retry</button></li>`;
  }
}

function renderResults(data, p) {
  const n = data.total;
  $('#result-count').textContent = `· ${n.toLocaleString()} ${n === 1 ? 'sound' : 'sounds'}`;
  const list = $('#results');
  list.setAttribute('aria-busy', 'false');
  if (!n) {
    list.innerHTML = `<li class="empty"><h2>No sounds found</h2>
      <p class="muted">Try fewer words, a broader term (“impact” instead of “punch”), or remove some filters.</p>
      ${hasFilters(p) ? '<button class="btn" type="button" data-clear>Clear filters</button>' : ''}</li>`;
  } else {
    list.innerHTML = resultsHtml(data.items);
  }
  renderLoadMore(data);
  renderFilters(data.facets, p);
  announce(`${n.toLocaleString()} ${n === 1 ? 'sound' : 'sounds'} found${p.q ? ` for ${p.q}` : ''}.`);
  player.syncProgress();
}
function renderLoadMore(data) {
  $('#load-more').innerHTML = data.page < data.pages
    ? `<button class="btn" type="button" id="more-btn">Load more <span class="muted">(${(data.total - browseState.list.length).toLocaleString()} left)</span></button>` : '';
}
async function loadMore() {
  const p = readParams();
  const next = browseState.page + 1;
  const btn = $('#more-btn'); btn.disabled = true;
  const data = await api(`/api/search?${toQuery(p, { per: 30, page: next })}`);
  const offset = browseState.list.length;
  browseState.page = next;
  browseState.list.push(...remember(data.items));
  $('#results').insertAdjacentHTML('beforeend', resultsHtml(data.items, offset));
  // Move focus to the first new result so keyboard users continue where they were.
  $(`[data-row="${data.items[0].id}"] .row-title`)?.focus();
  renderLoadMore(data);
  announce(`Loaded ${data.items.length} more sounds.`);
}
function setHeadingLevel(sel, tag) {
  const el = $(sel);
  if (!el || el.tagName === tag) return;
  const next = document.createElement(tag);
  for (const a of el.attributes) next.setAttribute(a.name, a.value);
  next.append(...el.childNodes);
  el.replaceWith(next);
}
const hasFilters = (p) => ARRAY_KEYS.some((k) => p[k]?.length) || p.loopable || p.bpm_min || p.bpm_max;

function renderFilters(f, p) {
  const focusedId = document.activeElement?.id;
  const group = (key, legend, opts, label = (v) => v) => {
    if (!opts.length) return '';
    const sel = p[key] || [];
    return `<fieldset class="filter-group"><legend>${legend}</legend>${opts.map((o) => {
      const id = `f-${key}-${String(o.value).replace(/[^\w-]/g, '_')}`;
      const checked = sel.includes(o.value);
      return `<label class="check${!o.count && !checked ? ' zero' : ''}" for="${id}">
        <input type="checkbox" id="${id}" name="${key}" value="${esc(o.value)}"${checked ? ' checked' : ''}>
        <span>${esc(label(o.value))}</span><span class="n" aria-label="${o.count} sounds">${o.count}</span></label>`;
    }).join('')}</fieldset>`;
  };
  const licLabel = (v) => ({ CC0: 'CC0 · no credit needed', 'CC-BY-4.0': 'CC BY 4.0 · credit required', 'CC-BY-3.0': 'CC BY 3.0 · credit required' }[v] || v);
  $('#filters').innerHTML = `
    <div class="filter-head"><h2>Filters</h2>${hasFilters(p) ? '<button class="link-btn" type="button" data-clear>Clear all</button>' : ''}</div>
    ${group('category', 'Category', f.category)}
    ${group('duration', 'Length', f.duration.filter((d) => d.count || (p.duration || []).includes(d.value)), (v) => DUR_LABEL[v])}
    ${group('license', 'License', f.license, licLabel)}
    ${group('mood', 'Mood', f.mood)}
    <fieldset class="filter-group"><legend>Options</legend>
      <label class="check" for="f-loopable"><input type="checkbox" id="f-loopable" name="loopable" value="1"${p.loopable ? ' checked' : ''}><span>Seamless loops only</span></label>
    </fieldset>
    ${p.kind === 'music' ? `<fieldset class="filter-group"><legend>Tempo (BPM)</legend><div class="bpm-row">
      <label class="visually-hidden" for="f-bpm-min">Minimum BPM</label><input type="number" inputmode="numeric" id="f-bpm-min" name="bpm_min" min="20" max="300" placeholder="Min" value="${esc(p.bpm_min || '')}">
      <span aria-hidden="true">–</span>
      <label class="visually-hidden" for="f-bpm-max">Maximum BPM</label><input type="number" inputmode="numeric" id="f-bpm-max" name="bpm_max" min="20" max="300" placeholder="Max" value="${esc(p.bpm_max || '')}">
    </div></fieldset>` : ''}`;
  if (focusedId && $(`#${CSS.escape(focusedId)}`) && $('#filters').contains($(`#${CSS.escape(focusedId)}`))) $(`#${CSS.escape(focusedId)}`).focus();

  // Active filter chips (removable) + count on mobile button
  const chips = [];
  for (const k of ARRAY_KEYS) for (const v of p[k] || []) chips.push({ k, v, label: k === 'duration' ? DUR_LABEL[v] : (k === 'license' ? licLabel(v).split(' ·')[0] : v) });
  if (p.loopable) chips.push({ k: 'loopable', v: '1', label: 'Loops only' });
  if (p.bpm_min) chips.push({ k: 'bpm_min', v: p.bpm_min, label: `≥ ${p.bpm_min} BPM` });
  if (p.bpm_max) chips.push({ k: 'bpm_max', v: p.bpm_max, label: `≤ ${p.bpm_max} BPM` });
  $('#active-filters').innerHTML = chips.map((c) => `<li><button type="button" data-unfilter="${c.k}" data-value="${esc(c.v)}" aria-label="Remove filter: ${esc(c.label)}">${esc(c.label)} ${icon('close')}</button></li>`).join('');
  $('#active-filters').hidden = !chips.length;
  $('#filters-n').textContent = chips.length ? `(${chips.length})` : '';
}

function readFilterForm() {
  const p = readParams();
  const root = $('#filters');
  for (const k of ARRAY_KEYS) p[k] = $$(`input[name="${k}"]:checked`, root).map((i) => i.value);
  p.loopable = $('#f-loopable', root)?.checked ? '1' : '';
  p.bpm_min = $('#f-bpm-min', root)?.value || '';
  p.bpm_max = $('#f-bpm-max', root)?.value || '';
  return p;
}

function bindBrowse() { // bound once; handlers only match browse-view controls
  const view = $('#view');
  view.addEventListener('change', (e) => {
    if (e.target.closest('#filters')) setParams(readFilterForm());
    if (e.target.id === 'sort') setParams({ ...readParams(), sort: e.target.value === 'relevance' ? '' : e.target.value });
  });
  view.addEventListener('click', (e) => {
    const t = e.target.closest('button'); if (!t) return;
    if (t.dataset.kind !== undefined) {
      const p = readParams(); p.kind = t.dataset.kind;
      if (p.kind !== 'music') { p.bpm_min = ''; p.bpm_max = ''; }
      setParams(p, { push: true });
    } else if (t.id === 'more-btn') loadMore();
    else if (t.id === 'filters-open') openFilters();
    else if (t.hasAttribute('data-retry')) route();
    else if (t.dataset.unfilter) {
      const p = readParams(); const k = t.dataset.unfilter;
      if (ARRAY_KEYS.includes(k)) p[k] = p[k].filter((v) => v !== t.dataset.value); else p[k] = '';
      setParams(p);
      $('#results-title')?.focus();
    }
  });
}
// Filters fieldset also lives in the mobile drawer, so listen on the dialog too.
function openFilters() {
  const dlg = $('#filters-dialog');
  $('#filters-dialog-body').append($('#filters'));
  dlg.addEventListener('close', () => { $('#sidebar')?.prepend($('#filters')); $('#filters-open')?.focus(); }, { once: true });
  dlg.showModal();
}
$('#filters-dialog').addEventListener('change', (e) => { if (e.target.closest('#filters')) setParams(readFilterForm()); });

async function loadStats() {
  try {
    stats ??= await api('/api/stats');
    const mins = Math.round(stats.seconds / 60);
    $('#hero-stats').innerHTML = `<span><strong>${stats.total.toLocaleString()}</strong> sounds</span>
      <span><strong>${stats.sfx.toLocaleString()}</strong> effects</span><span><strong>${stats.music.toLocaleString()}</strong> music tracks</span>
      <span><strong>${mins.toLocaleString()}</strong> minutes of audio</span>`;
  } catch { /* non-critical */ }
}

// ---------- sound detail ----------
async function renderSound(id, { focus }) {
  setView('sound', `<div class="back"><a class="btn" href="/" data-link data-back>${icon('back')} Back</a></div><div class="skeleton"></div>`);
  let s;
  try { s = await api(`/api/sounds/${id}`); }
  catch (e) { return e.status === 404 ? renderNotFound() : setView('sound', '<div class="empty"><h1>Couldn’t load this sound</h1></div>'); }
  remember([s, ...s.similar]);
  document.title = `${s.title} — free ${s.kind === 'music' ? 'music' : 'sound effect'} | Soundwell`;
  const lic = s.license;
  const facts = [
    ['Type', s.kind === 'music' ? 'Music' : 'Sound effect'], ['Category', s.category], ['Length', fmtTime(s.duration)],
    s.bpm && ['Tempo', `${s.bpm} BPM`], s.key && ['Key', s.key], s.mood && ['Mood', s.mood],
    ['Loopable', s.loopable ? 'Yes, seamless' : 'No'], ['Format', 'MP3 · 44.1 kHz'],
  ].filter(Boolean);
  const playing = player.current?.id === s.id && !player.audio.paused;
  setView('sound', `
    <div class="back"><a class="btn" href="/" data-link data-back>${icon('back')} Back to results</a></div>
    <div class="detail">
      <article>
        <div class="detail-hero">
          <div class="detail-head">
            <button class="play-btn xl" type="button" data-play="${s.id}" aria-pressed="${playing}" aria-label="${playing ? 'Pause' : 'Play'} ${esc(s.title)}">${icon(playing ? 'pause' : 'play')}</button>
            <div><h1>${esc(s.title)}</h1><p class="by">by ${s.authorUrl ? `<a href="${esc(s.authorUrl)}" rel="noopener">${esc(s.author)}</a>` : esc(s.author)}${s.source !== 'soundwell' ? ` · via <a href="${esc(s.sourceUrl)}" rel="noopener">${esc(s.source)}</a>` : ''}</p></div>
          </div>
          <div class="detail-wave" data-seek="${s.id}">${waveSvg(s.peaks, s.id)}</div>
          <div class="detail-time" aria-hidden="true"><span>0:00</span><span>${fmtTime(s.duration)}</span></div>
        </div>
        <section class="section" aria-labelledby="desc-h"><h2 id="desc-h">What it sounds like</h2><p class="description">${esc(s.description)}</p></section>
        <section class="section" aria-labelledby="det-h"><h2 id="det-h">Details</h2>
          <dl class="meta-grid">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl></section>
        <section class="section" aria-labelledby="tags-h"><h2 id="tags-h">Tags</h2>
          <ul class="tags">${s.tags.map((t) => `<li><a class="chip" href="/search?q=${encodeURIComponent(t)}" data-link>${esc(t)}</a></li>`).join('')}</ul></section>
        ${s.similar.length ? `<section class="section" aria-labelledby="sim-h"><h2 id="sim-h">More like this</h2><ul class="results">${s.similar.map(soundRow).join('')}</ul></section>` : ''}
      </article>
      <aside>
        <div class="card stack">
          <a class="btn primary" href="${s.downloadUrl}" download>${icon('download')} Download MP3</a>
          <button class="btn" type="button" data-fav="${s.id}" aria-pressed="${isFav(s.id)}">${icon(isFav(s.id) ? 'heart-fill' : 'heart')} Save</button>
        </div>
        <section class="card license-card" aria-labelledby="lic-h">
          <h2 id="lic-h">Can I use this? ${badge(s)}</h2>
          <p class="plain">${esc(lic.plain)}</p>
          <ul class="yesno">
            <li>Personal and commercial projects</li><li>YouTube, Twitch, podcasts, games, apps</li><li>Edit, cut, remix</li>
            ${lic.attribution ? '<li class="req">You must credit the creator</li>' : '<li>No credit required</li>'}
          </ul>
          <p class="small muted">${lic.attribution ? 'Paste this in your description or credits:' : 'Optional credit:'}</p>
          <p class="credit-box" id="credit">${esc(creditText(s))}</p>
          <button class="btn" type="button" data-copy="${s.id}">${icon('copy')} Copy credit</button>
          <p class="small muted"><a href="${esc(lic.url)}" rel="noopener">Read the full ${esc(lic.name)} license</a></p>
        </section>
        ${CONFIG.ads?.enabled ? `<div class="card">${sidebarAd()}</div>` : ''}
      </aside>
    </div>`);
  player.queue = [s, ...s.similar];
  player.syncProgress();
  if (focus) focusHeading();
}

// ---------- favorites ----------
function renderFavorites({ focus }) {
  document.title = 'Saved sounds — Soundwell';
  remember(favs);
  setView('favorites', `<div class="browse single"><section>
    <div class="toolbar"><h1>Saved sounds <span class="result-count">· ${favs.length}</span></h1></div>
    ${favs.length ? `<ul class="results">${favs.map(soundRow).join('')}</ul>`
      : `<div class="empty"><h2>Nothing saved yet</h2><p class="muted">Press the heart on any sound (or <kbd>F</kbd> while it plays) to keep it here. Saved sounds stay in this browser.</p><a class="btn primary" href="/" data-link>Browse sounds</a></div>`}
  </section></div>`);
  player.queue = [...favs];
  player.syncProgress();
  if (focus) focusHeading();
}

function renderAbout({ focus }) {
  document.title = 'About & licensing — Soundwell';
  setView('about', `<article class="prose">
    <h1>About Soundwell</h1>
    <p>Soundwell is a free library of sound effects and music. Every sound plays instantly, downloads without an account, and states its license in plain English.</p>
    <h2>Licenses we accept</h2>
    <p><strong>CC0</strong> — public domain. Use it anywhere, no credit needed.<br><strong>CC BY</strong> — use it anywhere, including commercially, as long as you credit the creator. We generate the credit line for you.</p>
    <p>We don’t host “non-commercial” (NC) or “no derivatives” (ND) content. Those licenses trip people up, and you shouldn’t need a lawyer to make a YouTube video.</p>
    <h2>Accessibility</h2>
    <p>Every sound has a written description of what it sounds like, for screen-reader users and Deaf and hard-of-hearing creators. The whole site works with a keyboard (press <kbd>?</kbd> for shortcuts), respects reduced-motion and high-contrast settings, and never plays audio you didn’t ask for.</p>
    <h2 id="advertise">Advertising</h2>
    <p>Soundwell is funded by ads. Our rules: ads are clearly labeled, never play sound, never animate, never cover content, and never shift the page while you’re reading. Interested? Get in touch.</p>
  </article>`);
  if (focus) focusHeading();
}
function renderNotFound() {
  document.title = 'Not found — Soundwell';
  setView('404', '<div class="empty prose"><h1>We couldn’t find that page</h1><p class="muted">It may have moved. Try searching instead.</p><a class="btn primary" href="/" data-link>Go home</a></div>');
  focusHeading();
}

// ---------- player ----------
const player = {
  audio: new Audio(),
  current: null,
  queue: [],
  counted: new Set(),
  raf: 0,
  seekPending: null,

  play(id, { at } = {}) {
    const s = items.get(String(id)); if (!s) return;
    if (this.current?.id === s.id) {
      if (at != null) this.seekRatio(at);
      if (this.audio.paused) this.audio.play(); else if (at == null) this.audio.pause();
      return;
    }
    if (this.current) setWaveProgress(this.current.id, 0);
    this.current = s;
    this.audio.src = s.previewUrl;
    this.seekPending = at;
    this.audio.play().catch(() => {});
    if (!this.counted.has(s.id)) { this.counted.add(s.id); fetch(`/api/sounds/${s.id}/play`, { method: 'POST' }).catch(() => {}); }
    // Next/previous follow the list on screen.
    if (currentView === 'browse') this.queue = browseState.list;
    else if (!this.queue.some((q) => q.id === s.id)) this.queue = [s];
    this.renderBar();
    announce(`Playing ${s.title}, ${spokenTime(s.duration)}.`);
  },
  toggle() { if (!this.current) { const first = (currentView === 'browse' ? browseState.list : this.queue)[0]; if (first) this.play(first.id); return; } this.audio.paused ? this.audio.play() : this.audio.pause(); },
  step(dir) {
    const q = this.queue.length ? this.queue : browseState.list;
    const i = q.findIndex((x) => x.id === this.current?.id);
    const next = q[i + dir] || (i === -1 ? q[0] : null);
    if (next) this.play(next.id);
  },
  seekRatio(r) { if (this.audio.duration) this.audio.currentTime = r * this.audio.duration; },
  seekBy(sec) { if (this.current) this.audio.currentTime = Math.max(0, Math.min(this.audio.duration || 0, this.audio.currentTime + sec)); },
  renderBar() {
    const s = this.current;
    $('#player').hidden = false; document.body.classList.add('has-player');
    $('#p-title').textContent = s.title; $('#p-title').href = soundPath(s);
    $('#p-sub').textContent = [s.kind === 'music' ? 'Music' : 'Sound effect', s.category, s.license.code === 'CC0' ? 'CC0' : 'CC BY'].join(' · ');
    $('#p-wave').outerHTML = waveSvg(s.peaks, s.id, 'wave-player').replace('<svg ', '<svg id="p-wave" ');
    $('#p-dl').href = s.downloadUrl; $('#p-dl').setAttribute('download', ''); $('#p-dl').setAttribute('aria-label', `Download ${s.title}`);
    $('#p-dur').textContent = fmtClock(s.duration);
    $('#p-cur').textContent = fmtClock(0, s.duration);
    syncFavUI();
    this.syncButtons();
  },
  syncButtons() {
    const playing = !this.audio.paused;
    for (const b of $$('[data-play]')) {
      const s = items.get(b.dataset.play);
      const on = this.current?.id === Number(b.dataset.play) && playing;
      b.setAttribute('aria-pressed', String(on));
      b.setAttribute('aria-label', `${on ? 'Pause' : 'Play'} ${s?.title || ''}`);
      b.querySelector('use').setAttribute('href', on ? '#i-pause' : '#i-play');
    }
    for (const r of $$('[data-row]')) r.classList.toggle('is-current', this.current?.id === Number(r.dataset.row));
    $('#p-toggle').setAttribute('aria-label', playing ? 'Pause' : 'Play');
    $('#p-toggle use').setAttribute('href', playing ? '#i-pause' : '#i-play');
  },
  syncProgress() {
    if (!this.current) return;
    const d = this.audio.duration || this.current.duration;
    setWaveProgress(this.current.id, d ? this.audio.currentTime / d : 0);
    this.syncButtons();
  },
  tick() {
    const a = this.audio; const d = a.duration || this.current?.duration || 0;
    if (this.current) setWaveProgress(this.current.id, d ? a.currentTime / d : 0);
    const seek = $('#p-seek');
    seek.value = d ? Math.round((a.currentTime / d) * 1000) : 0;
    $('#p-cur').textContent = fmtClock(a.currentTime, d);
    if (!a.paused) this.raf = requestAnimationFrame(() => this.tick());
  },
};
const A = player.audio;
A.preload = 'auto';
A.volume = store.get('volume', 0.8);
A.muted = store.get('muted', false);
A.loop = store.get('loop', false);
A.addEventListener('loadedmetadata', () => { if (player.seekPending != null) { player.seekRatio(player.seekPending); player.seekPending = null; } });
A.addEventListener('play', () => { player.syncButtons(); cancelAnimationFrame(player.raf); player.tick(); });
A.addEventListener('pause', () => { player.syncButtons(); player.tick(); });
A.addEventListener('ended', () => { player.syncButtons(); if (!A.loop && store.get('autonext', false)) player.step(1); });
A.addEventListener('timeupdate', () => {
  const d = A.duration || 0;
  $('#p-seek').setAttribute('aria-valuetext', `${spokenTime(A.currentTime)} of ${spokenTime(d)}`);
  if (A.paused) player.tick();
});
A.addEventListener('error', () => { if (player.current) toast(`Couldn’t play “${player.current.title}”`); });

$('#p-toggle').addEventListener('click', () => player.toggle());
$('#p-prev').addEventListener('click', () => player.step(-1));
$('#p-next').addEventListener('click', () => player.step(1));
$('#p-seek').addEventListener('input', (e) => player.seekRatio(e.target.value / 1000));
$('#p-loop').addEventListener('click', () => setLoop(!A.loop));
$('#p-mute').addEventListener('click', () => setMuted(!A.muted));
$('#p-fav').addEventListener('click', () => player.current && toggleFav(player.current.id));
$('#p-vol').addEventListener('input', (e) => { A.volume = e.target.value / 100; store.set('volume', A.volume); if (A.muted) setMuted(false); });
function setLoop(on) { A.loop = on; store.set('loop', on); $('#p-loop').setAttribute('aria-pressed', String(on)); toast(on ? 'Loop on' : 'Loop off'); }
function setMuted(on) {
  A.muted = on; store.set('muted', on);
  $('#p-mute').setAttribute('aria-label', on ? 'Unmute' : 'Mute');
  $('#p-mute use').setAttribute('href', on ? '#i-mute' : '#i-volume');
}
$('#p-vol').value = Math.round(A.volume * 100);
$('#p-loop').setAttribute('aria-pressed', String(A.loop));
setMuted(A.muted);

// ---------- global delegation ----------
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href]');
  if (a && a.origin === location.origin && !a.hasAttribute('download') && !a.target && !e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey && e.button === 0) {
    if (a.hasAttribute('data-back') && navDepth > 0) { e.preventDefault(); navDepth--; history.back(); return; }
    if (a.pathname.startsWith('/api/') || a.pathname.startsWith('/media/')) return;
    e.preventDefault();
    navigate(a.pathname + a.search + a.hash);
    return;
  }
  const t = e.target.closest('[data-play],[data-fav],[data-copy],[data-seek],[data-clear]');
  if (!t) return;
  if (t.dataset.play) player.play(t.dataset.play);
  else if (t.dataset.fav) toggleFav(t.dataset.fav);
  else if (t.dataset.copy) copyCredit(t.dataset.copy);
  else if (t.dataset.seek) {
    const r = t.getBoundingClientRect();
    player.play(t.dataset.seek, { at: (e.clientX - r.left) / r.width });
  } else if (t.hasAttribute('data-clear')) {
    const p = readParams(); setParams({ q: p.q, kind: p.kind, sort: p.sort });
  }
});
window.addEventListener('popstate', () => route({ focus: true }));

// Search box: live results while typing, Enter commits to history.
let typing;
$('#search-form').addEventListener('submit', (e) => {
  e.preventDefault(); clearTimeout(typing);
  const q = $('#q').value.trim();
  const p = currentView === 'browse' ? readParams() : {};
  history.pushState(null, '', `/search?${toQuery({ ...p, q })}`);
  route();
});
$('#q').addEventListener('input', () => {
  clearTimeout(typing);
  typing = setTimeout(() => {
    const q = $('#q').value.trim();
    if (currentView !== 'browse') { if (!q) return; history.pushState(null, '', `/search?${toQuery({ q })}`); return route(); }
    setParams({ ...readParams(), q });
  }, 220);
});

// ---------- theme ----------
const THEMES = ['system', 'light', 'dark'];
function applyTheme(t) {
  if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t;
  $('#theme-btn').setAttribute('aria-label', `Theme: ${t}. Change theme`);
  $('#theme-btn use').setAttribute('href', { system: '#i-auto', light: '#i-sun', dark: '#i-moon' }[t]);
}
let theme = store.get('theme', 'system');
applyTheme(theme);
$('#theme-btn').addEventListener('click', () => {
  theme = THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
  store.set('theme', theme); applyTheme(theme); toast(`Theme: ${theme}`);
});

// ---------- dialogs & shortcuts ----------
for (const d of $$('dialog')) {
  d.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === d) d.close(); });
}
$('#keys-btn').addEventListener('click', () => $('#keys-dialog').showModal());
$('#opt-keys').checked = store.get('shortcuts', true);
$('#opt-keys').addEventListener('change', (e) => store.set('shortcuts', e.target.checked));
$('#opt-autonext').checked = store.get('autonext', false);
$('#opt-autonext').addEventListener('change', (e) => store.set('autonext', e.target.checked));

document.addEventListener('keydown', (e) => {
  if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  const typingField = t.matches?.('input:not([type=checkbox]):not([type=radio]):not([type=range]), textarea, select, [contenteditable]');
  if (typingField) { if (e.key === 'Escape' && t.id === 'q') t.blur(); return; }
  if ($('dialog[open]')) return;
  if (!store.get('shortcuts', true)) return;
  const onControl = t.matches?.('button, a, input, summary');
  switch (e.key) {
    case '/': e.preventDefault(); $('#q').focus(); $('#q').select(); break;
    case ' ': if (onControl) return; e.preventDefault(); player.toggle(); break;
    case 'n': case 'N': player.step(1); break;
    case 'p': case 'P': player.step(-1); break;
    case 'ArrowRight': if (t.type === 'range' || !player.current) return; e.preventDefault(); player.seekBy(5); break;
    case 'ArrowLeft': if (t.type === 'range' || !player.current) return; e.preventDefault(); player.seekBy(-5); break;
    case 'r': case 'R': if (player.current) setLoop(!A.loop); break;
    case 'f': case 'F': if (player.current) toggleFav(player.current.id); break;
    case 'm': case 'M': setMuted(!A.muted); toast(A.muted ? 'Muted' : 'Unmuted'); break;
    case '?': $('#keys-dialog').showModal(); break;
    default:
  }
});

bindBrowse();
syncFavUI();
route();
