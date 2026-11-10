#!/usr/bin/env bash
# Rebuilds engine-core.js (the in-browser sound engine) from synth.js + catalog.js helpers + gens.js.
# sequence() in synth.js is swapped for the faster version in seqfast.js (bit-identical output).
set -euo pipefail
cd "$(dirname "$0")"
python3 - synth.js seqfast.js > /tmp/synth-fast.js <<'PY'
import sys
s=open(sys.argv[1]).read(); new=open(sys.argv[2]).read()
a=s.index('/** Mix a list of notes'); b=s.index('/**\n * Normalize to target peak')
print(s[:a].replace('export ','') + new + '\n' + s[b:].replace('export ',''))
PY
{ echo "function SoundwellEngine() {"; echo "'use strict';"; cat /tmp/synth-fast.js; sed -n '/^export const beat/,/^export const CATALOG/p' catalog.js | sed -e '$d' -e 's/^export //'; cat gens.js; echo "}"; } > engine-core.js
echo "engine-core.js rebuilt"
