/** Mix notes [{start, dur, ...}] by summing voice(note, tLocal). Tracks only the notes sounding now. */
function sequence(notes, voice, tail = 1) {
  const ns = [...notes].sort((a, b) => a.start - b.start); let next = 0; let active = []; let lastT = -Infinity;
  return (t) => {
    if (t < lastT - 0.05) { next = 0; active = []; }
    lastT = t;
    while (next < ns.length && ns[next].start <= t) active.push(ns[next++]);
    let s = 0; let w = 0;
    for (let i = 0; i < active.length; i++) { const n = active[i]; const lt = t - n.start; if (lt < n.dur + tail) { if (lt >= 0) s += voice(n, lt); active[w++] = n; } }
    active.length = w; return s;
  };
}
