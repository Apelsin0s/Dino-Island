// Screenshot helper: node tools/shot.js out.png [actions]
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || 'shot.png', mode = process.argv[3] || 'look';
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  const logs = []; p.on('console', m => logs.push(m.type() + ': ' + m.text())); p.on('pageerror', e => logs.push('ERR ' + e.message));
  await p.goto('file://' + process.cwd() + '/src/index.html');
  const t0 = Date.now();
  await p.waitForSelector('#bPlay', { timeout: 120000 }).catch(() => {});
  console.log('loaded in', Date.now() - t0, 'ms');
  await p.click('#bPlay').catch(e => logs.push('noplay ' + e.message));
  await p.waitForTimeout(1500); if (process.env.Q) await p.evaluate(q => window.Scene.setQuality(q), process.env.Q);
  if (mode === 'dig') {
    await p.mouse.move(640, 360);
    await p.mouse.down({ button: 'left' });
    if (process.env.TOOL) await p.keyboard.press(process.env.TOOL);
    for (let i = 0; i < 40; i++) { await p.evaluate(() => { window.__game.pl.pitch = -1.0; }); await p.waitForTimeout(700); }
    await p.mouse.up({ button: 'left' });
    await p.evaluate(() => { const g = window.__game; g.pl.pitch = -0.7; });
    await p.waitForTimeout(800);
  }
  if (mode === 'walk') { await p.keyboard.down('KeyW'); await p.waitForTimeout(4000); await p.keyboard.up('KeyW'); }
  const url = await p.evaluate(pt => window.__game.snap(pt), process.env.PITCH ? +process.env.PITCH : undefined); require('fs').writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  const fps = await p.evaluate(() => new Promise(r => { let n = 0; const s = performance.now(); (function f() { n++; if (performance.now() - s < 2000) requestAnimationFrame(f); else r(n / 2); })(); }));
  console.log('fps', fps, 'pos', await p.evaluate(() => { const g = window.__game; return [g.pl.pos.length() - g.W.R, g.pl.dug, g.S.chunkCount()]; }));
  console.log(logs.slice(0, 20).join('\n'));
  await b.close();
})();
