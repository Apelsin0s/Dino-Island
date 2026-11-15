// Loads the game's own world and rules code (src/world.js, src/rules.js, src/deposits.js) into the server,
// so the server measures every scoop exactly like the game does: same relief, same ground, same prices.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..', 'src');

function load() {
  const ctx = { console, Math, Float32Array, Float64Array, Int16Array, Int8Array, Int32Array, Uint8Array, Uint16Array, Uint32Array, Map, Set, Array, Object, JSON, Number, String, Infinity, NaN, isFinite };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['deposits.js', 'world.js', 'rules.js', 'dem/dem.js']) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
  const W = ctx.World, D = ctx.DemInfo, dem = {};
  for (const k of ['local', 'ukraine']) {
    const buf = Buffer.from(fs.readFileSync(path.join(SRC, D[k].file), 'utf8').trim(), 'base64');
    dem[k] = Object.assign({}, D[k], { data: new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)) });
  }
  W.setDem(dem);
  return { W, Rules: ctx.Rules };
}
module.exports = { load };
