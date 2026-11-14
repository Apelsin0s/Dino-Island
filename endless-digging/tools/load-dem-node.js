// Node helper for tests: loads the relief grids into World (the browser loads them with fetch in game.js).
const fs = require('fs'), path = require('path');
module.exports = function (W) {
  const src = fs.readFileSync(path.join(__dirname, '../src/dem/dem.js'), 'utf8'), info = JSON.parse(src.slice(src.indexOf('{'), src.lastIndexOf('}') + 1));
  const d = {}; for (const k of ['local', 'ukraine']) { const b = Buffer.from(fs.readFileSync(path.join(__dirname, '../src', info[k].file), 'utf8'), 'base64'); d[k] = Object.assign({}, info[k], { data: new Int16Array(b.buffer, b.byteOffset, b.length / 2) }); }
  W.setDem(d);
};
