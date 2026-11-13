// Dig a pit with the shovel and snapshot it: node tools/pit.js out.jpg
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const p = await b.newPage({ viewport: { width: 960, height: 540 } });
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + process.cwd() + '/src/index.html');
  await p.waitForSelector('#bPlay', { timeout: 120000 });
  if (process.env.Q) await p.evaluate(q => window.Scene.setQuality(q), process.env.Q);
  await p.evaluate(() => { localStorage.clear(); });
  if (process.env.NOSHADOW) await p.evaluate(() => { window.NOSHADOW = 1; }); if (process.env.ENDTOOL) await p.evaluate(t => { window.ENDTOOL = t; }, process.env.ENDTOOL); await p.click('#bPlay');
  await p.waitForTimeout(500);
  const n = await p.evaluate(() => {
    const g = window.__game; g.setTool('shovel'); let n = 0;
    for (let i = 0; i < 14; i++) { if (g.digNow(-0.95 - (i % 3) * 0.12, i % 2 ? 0.12 : -0.12)) n++; }
    for (let i = 0; i < 6; i++) { if (g.digNow(-1.25, 0.1)) n++; }
    return n;
  });
  console.log('dug', n);
  await p.waitForTimeout(4000);
  const url = await p.evaluate(pt => { if (window.ENDTOOL) window.__game.setTool(window.ENDTOOL); window.__game.snap(pt, 5); if (window.NOSHADOW) window.Scene._sun().castShadow = false; return window.__game.snap(pt); }, +(process.env.PITCH || -0.7));
  require('fs').writeFileSync(out, Buffer.from(url.split(',')[1], 'base64'));
  await b.close();
})();
