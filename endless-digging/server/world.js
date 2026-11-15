// Loads the game's own world and rules code (src/world.js, src/rules.js, src/deposits.js) into the server,
// so the server measures every scoop exactly like the game does: same relief, same ground, same prices.
'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm');
const SRC = path.join(__dirname, '..', 'src');

function load() {
  const ctx = { console, Math, Float32Array, Float64Array, Int16Array, Int8Array, Int32Array, Uint8Array, Uint16Array, Uint32Array, Map, Set, Array, Object, JSON, Number, String, Infinity, NaN, isFinite };
  ctx.window = ctx; ctx.globalThis = ctx;
  vm.createContext(ctx);
  for (const f of ['deposits.js', 'world.js', 'rules.js', 'dem/dem.js', 'dem/world.js', 'dem/patches.js']) vm.runInContext(fs.readFileSync(path.join(SRC, f), 'utf8'), ctx, { filename: f });
  const W = ctx.World, D = ctx.DemInfo, dem = {};
  for (const k of ['local', 'ukraine']) {
    const buf = Buffer.from(fs.readFileSync(path.join(SRC, D[k].file), 'utf8').trim(), 'base64');
    dem[k] = Object.assign({}, D[k], { data: new Int16Array(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length)) });
  }
  W.setDem(dem);
  // the whole Earth: blocks are read from disk the first time something needs them
  const zlib = require('zlib');
  W.setWorldDem(ctx.WorldDemInfo);
  W.setBlockLoader(k => {
    try {
      const raw = zlib.inflateSync(Buffer.from(fs.readFileSync(path.join(SRC, 'dem', 'world', k + '.txt'), 'utf8'), 'base64'));
      return W.decodeBlock(new Int16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length)));
    } catch (e) { return null; }
  });
  W.setPatches(ctx.DemPatches || []);
  W.setPatchLoader(p => {
    try { const raw = zlib.inflateSync(Buffer.from(fs.readFileSync(path.join(SRC, p.file), 'utf8'), 'base64')); return W.decodePatch(new Int16Array(raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.length)), p.w, p.h); }
    catch (e) { return null; }
  });
  return { W, Rules: ctx.Rules };
}
module.exports = { load };
