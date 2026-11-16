// HD relief on the server: the same Terrarium zoom-12 tiles the Steam game streams, fetched around every player
// (and before any dig), cached on disk in DATA_DIR/tiles. Turn off with HD_TILES=0.
'use strict';
const https = require('https'), fs = require('fs'), path = require('path'), { PNG } = require('pngjs');
module.exports = function (W, dataDir) {
  const on = process.env.HD_TILES !== '0', dir = path.join(dataDir, 'tiles'), pend = new Map(), have = new Set();
  const URL = process.env.HD_URL || 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/12/{x}/{y}.png';
  if (on) fs.mkdirSync(dir, { recursive: true });
  const get = url => new Promise((res, rej) => https.get(url, { timeout: 20000 }, r => { if (r.statusCode !== 200) { r.resume(); return rej(new Error('http ' + r.statusCode)); } const b = []; r.on('data', d => b.push(d)); r.on('end', () => res(Buffer.concat(b))); }).on('error', rej).on('timeout', function () { this.destroy(new Error('timeout')); }));
  function load(x, y) {
    const k = x + '_' + y; if (have.has(k)) return Promise.resolve(); if (pend.has(k)) return pend.get(k);
    const file = path.join(dir, k + '.png');
    const p = (fs.existsSync(file) ? Promise.resolve(fs.readFileSync(file)) : get(URL.replace('{x}', x).replace('{y}', y)).then(b => { fs.writeFile(file, b, () => {}); return b; }))
      .then(buf => { const png = PNG.sync.read(buf); W.setHDTile(x, y, W.decodeTerrarium(png.data)); have.add(k); pend.delete(k); })
      .catch(e => { pend.delete(k); console.warn('HD tile', k, e.message); });
    pend.set(k, p); return p;
  }
  function around(lat, lon, r) { if (!on) return Promise.resolve(); const [x, y] = W.hdTileOf(lat, lon), ps = []; for (let j = -r; j <= r; j++) for (let i = -r; i <= r; i++) ps.push(load((x + i + 4096) % 4096, y + j)); return Promise.all(ps); }
  return { on, around, count: () => have.size };
};
