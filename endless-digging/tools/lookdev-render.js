// Renders look-dev stills without a window: node tools/lookdev-render.js <outDir> "v=1&q=draft&shots=wide,close" [suffix]
const { chromium } = require('playwright'); const fs = require('fs'); const path = require('path');
(async () => {
  const outDir = process.argv[2], query = process.argv[3] || 'v=1&q=draft&shots=wide', suffix = process.argv[4] || '';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-watchdog', '--js-flags=--max-old-space-size=8192'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
  p.on('console', m => { const t = m.text(); if (!/GL Driver Message|GPU stall/.test(t)) console.log(t.slice(0, 1500)); });
  p.on('pageerror', e => console.log('PAGE ERROR', e.message));
  await p.goto('file://' + path.resolve(__dirname, '..', 'lookdev', 'index.html') + '?' + query);
  const t0 = Date.now();
  await p.waitForFunction(() => window.__done || window.__error, null, { timeout: 40 * 60 * 1000, polling: 1000 });
  const shots = await p.evaluate(() => window.__shots);
  const v = (query.match(/v=(\w+)/) || [0, '1'])[1];
  for (const k of Object.keys(shots)) { const f = path.join(outDir, 'v' + v + '-' + k + suffix + '.jpg'); fs.writeFileSync(f, Buffer.from(shots[k].split(',')[1], 'base64')); console.log('wrote', f); }
  console.log('total', ((Date.now() - t0) / 1000).toFixed(0) + 's');
  await b.close();
})();
