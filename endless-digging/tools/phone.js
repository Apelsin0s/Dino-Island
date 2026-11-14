// Phone check: node tools/phone.js out.png  — emulates a phone in landscape, walks with the stick, digs with the button.
const { chromium, devices } = require('playwright');
(async () => {
  const out = process.argv[2];
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await b.newContext({ ...devices['Pixel 7 landscape'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('file://' + process.cwd() + '/src/index.html');
  await p.evaluate(() => localStorage.clear());
  await p.reload();
  await p.waitForSelector('#bPlay', { timeout: 180000 });
  console.log('touch class', await p.evaluate(() => document.documentElement.className), 'quality', await p.evaluate(() => Scene.getQuality()));
  await p.tap('#bPlay');
  await p.waitForTimeout(800);
  console.log('overlay hidden', await p.evaluate(() => document.getElementById('overlay').hidden));
  await p.evaluate(() => { window.__pe = []; for (const t of ['pointerdown','touchstart']) window.addEventListener(t, e => window.__pe.push(t + ':' + (e.target.id || e.target.tagName)), true); window.__pe.push('at:' + document.elementFromPoint(120, innerHeight - 100).id); });
  const cdp = await ctx.newCDPSession(p);
  const vp = p.viewportSize();
  const before = await p.evaluate(() => window.__game.pl.pos.toArray());
  // left thumb: push the stick forward
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y: vp.height - 100, id: 1 }] });
  for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120, y: vp.height - 100 - i * 12, id: 1 }] });
  // right thumb: look down while walking
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: 120, y: vp.height - 160, id: 1 }, { x: vp.width * 0.6, y: 120, id: 2 }] });
  for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 120, y: vp.height - 160, id: 1 }, { x: vp.width * 0.6, y: 120 + i * 15, id: 2 }] });
  await p.waitForTimeout(6000);
  console.log('pointer events', await p.evaluate(() => window.__pe.join(',')));
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  const after = await p.evaluate(() => [window.__game.pl.pos.toArray(), window.__game.pl.pitch]);
  const moved = Math.hypot(after[0][0] - before[0], after[0][1] - before[1], after[0][2] - before[2]);
  console.log('moved m', moved.toFixed(2), 'pitch', after[1].toFixed(2));
  // dig button
  const box = await p.locator('#bDig').boundingBox();
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, id: 3 }] });
  await p.evaluate(() => { window.__game.pl.pitch = -1.0; });
  await p.waitForTimeout(12000);
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  console.log('dug m3', await p.evaluate(() => window.__game.pl.dug.toFixed(3)));
  await p.evaluate(() => { window.__game.snap(-0.5, 5); });
  await p.screenshot({ path: out, timeout: 180000 });
  await b.close();
})();
