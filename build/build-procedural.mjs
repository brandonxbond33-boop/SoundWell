import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { readFileSync, writeFileSync } from 'node:fs';
const src = readFileSync(new URL('./engine-core.js', import.meta.url), 'utf8');
const E = new Function(src + '\nreturn SoundwellEngine();')();
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
if (isMainThread) {
  const list = E.enumerate(); const N = list.length; const W = 4; const res = new Array(N); let done = 0; const t0 = Date.now(); const stats = [];
  await Promise.all(Array.from({ length: W }, (_, w) => new Promise((ok, bad) => {
    const wk = new Worker(new URL(import.meta.url), { workerData: { w, W } });
    wk.on('message', (m) => { res[m.i] = m; done++; if (done % 250 === 0) console.log(done, '/', N, Math.round((Date.now() - t0) / 1000) + 's'); });
    wk.on('error', bad); wk.on('exit', ok);
  })));
  const bad = res.filter((r) => r.bad || r.rms < 0.01); console.log('problems', bad.length, bad.slice(0, 10).map((r) => list[r.i].title + ' rms ' + r.rms.toFixed(3) + (r.bad ? ' NAN' : '')));
  writeFileSync(new URL('./proc.json', import.meta.url), JSON.stringify({ n: res.map((r) => r.n), pk: res.map((r) => r.pk).join('') }));
  console.log('done', N, 'in', Math.round((Date.now() - t0) / 1000) + 's');
} else {
  const { w, W } = workerData; const list = E.enumerate();
  for (let i = w; i < list.length; i += W) {
    const e = list[i]; const buf = E.renderEntry(e.g, e.p); let bad = 0, sq = 0; for (const v of buf) { if (!Number.isFinite(v)) bad++; sq += v * v; }
    const pk = E.peaks(buf, 40).map((v) => B64[Math.min(63, Math.round(v / 100 * 63))]).join('');
    parentPort.postMessage({ i, n: buf.length, pk, bad, rms: Math.sqrt(sq / buf.length) });
  }
}
