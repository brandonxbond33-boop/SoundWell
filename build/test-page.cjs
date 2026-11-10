const { chromium } = require('playwright'); const fs = require('fs');
(async () => { const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] }); const out = process.argv[2]; const errs = [];
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  await ctx.addInitScript(() => { window.__saved = []; window.claude = { use: async (n) => n === 'downloads' ? { save: async ({ filename, data }) => { const buf = new Uint8Array(await data.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 32768) s += String.fromCharCode.apply(null, buf.subarray(i, i + 32768)); window.__saved.push({ filename, b64: btoa(s) }); return { status: 'saved' }; } } : null }; });
  const p = await ctx.newPage(); p.on('pageerror', e => errs.push('pageerror ' + e.message)); p.on('console', m => m.type() === 'error' && errs.push(m.text()));
  const t0 = Date.now(); await p.goto('http://localhost:3190/'); await p.waitForSelector('.row'); const loadMs = Date.now() - t0; await p.waitForTimeout(500);
  const r = { loadMs }; r.stats = await p.locator('#stats').textContent(); r.rowsRendered = await p.locator('.row').count(); r.head = await p.locator('#reshead').textContent();
  await p.screenshot({ path: out + '/v4-home.png' });
  // infinite scroll
  await p.locator('#morebtn').scrollIntoViewIfNeeded(); await p.waitForTimeout(600); r.rowsAfterScroll = await p.locator('.row').count();
  // search a procedural family + play it
  await p.fill('#q', 'laser wobble harsh'); await p.waitForTimeout(500); r.laserResults = await p.locator('#reshead').textContent(); r.firstLaser = await p.locator('.row .ttl').first().textContent();
  const tp = Date.now(); await p.locator('.row .play').first().click(); await p.waitForFunction(() => document.querySelector('.row.playing .play use')?.getAttribute('href') === '#i-pause' && !document.querySelector('.row.playing .play').classList.contains('busy'), null, { timeout: 15000 }); r.procPlayMs = Date.now() - tp;
  await p.waitForTimeout(300); r.curTime = await p.locator('#cur').textContent();
  // MP3 sound still plays
  await p.fill('#q', 'referee whistle'); await p.waitForTimeout(400); await p.locator('.row .play').first().click(); await p.waitForTimeout(1200); r.mp3Playing = await p.locator('.row.playing').count();
  // music filters
  await p.fill('#q', ''); await p.click('[data-kind="music"]'); await p.waitForTimeout(400); r.musicFiltersVisible = await p.locator('#musicf').isVisible();
  await p.selectOption('#keyf', 'F# minor'); await p.selectOption('#bpmf', '120'); await p.waitForTimeout(400); r.fsharp120 = await p.locator('#reshead').textContent();
  await p.click('#clear'); await p.waitForTimeout(300);
  // procedural download
  await p.fill('#q', 'tubular bell'); await p.waitForTimeout(400); await p.locator('.row .ttl').first().click(); await p.locator('.detail [data-act="dl"]').click(); await p.waitForTimeout(2500);
  // transposed kit
  await p.fill('#q', ''); await p.waitForTimeout(300); await p.selectOption('[data-kitkey="neon"]', 'E minor'); await p.click('[data-kit="neon"]'); await p.waitForTimeout(6000);
  r.kitLayers = await p.locator('#layers .ln').allTextContents(); r.kitBtn = (await p.locator('#mixplay').textContent()).trim();
  await p.screenshot({ path: out + '/v4-kit.png' });
  await p.selectOption('#mixlen', '15'); await p.click('#mixexport'); await p.waitForTimeout(8000);
  await p.click('#mixclose');
  // song starter
  await p.selectOption('#ss-key', '7'); await p.selectOption('#ss-prog', '1'); await p.selectOption('#ss-bpm', '90'); await p.click('#ss-go'); await p.waitForTimeout(6000);
  r.songLayers = await p.locator('#layers .ln').allTextContents(); r.songBtn = (await p.locator('#mixplay').textContent()).trim();
  const saved = await p.evaluate(() => window.__saved); r.saved = saved.map((s) => s.filename); for (const s of saved) fs.writeFileSync(out + '/dl4-' + s.filename, Buffer.from(s.b64, 'base64'));
  console.log(JSON.stringify(r, null, 1));
  const m = await b.newPage({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' }); m.on('pageerror', e => errs.push('m ' + e.message));
  await m.goto('http://localhost:3190/'); await m.waitForTimeout(800); const ov = await m.evaluate(() => document.documentElement.scrollWidth - innerWidth); await m.screenshot({ path: out + '/v4-phone.png' });
  console.log('phone overflow', ov, 'errors', errs); await b.close(); })();
