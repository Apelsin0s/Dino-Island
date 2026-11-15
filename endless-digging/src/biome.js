// Biomes: what the surface looks like anywhere on Earth, read from a satellite picture of the planet
// (NASA Blue Marble, map/earth.jpg) and a water map (map/water.png), plus the rules the picture cannot tell:
// snow above the snow line (depends on latitude), bare rock on steep mountain sides, sand on beaches.
// Used for the colour of the ground, the far landscape, how many and which trees grow, and where the sea is.
'use strict';
(function (root) {
  const B = { ready: null, ok: false };
  let img = null, wat = null, IW = 0, IH = 0, WW = 0, WH = 0;
  const loadPix = src => new Promise(res => {
    const im = new Image(); im.crossOrigin = 'anonymous';
    im.onload = () => { try { const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const x = c.getContext('2d', { willReadFrequently: true }); x.drawImage(im, 0, 0); res({ d: x.getImageData(0, 0, im.width, im.height).data, w: im.width, h: im.height }); } catch (e) { res(null); } };
    im.onerror = () => res(null); im.src = src;
  });
  B.ready = Promise.all([loadPix('map/earth.jpg'), loadPix('map/water.png')]).then(([a, b]) => {
    if (a) { img = a.d; IW = a.w; IH = a.h; } if (b) { wat = b.d; WW = b.w; WH = b.h; } B.ok = !!a;
  });
  // bilinear sample of an RGBA picture in plate carrée (lon -180..180, lat 90..-90)
  function samp(d, w, h, lat, lon, ch, out) {
    let fx = (lon + 180) / 360 * w - 0.5, fy = (90 - lat) / 180 * h - 0.5;
    fy = Math.max(0, Math.min(h - 1.001, fy));
    const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0, xa = ((x0 % w) + w) % w, xb = (xa + 1) % w;
    for (let c = 0; c < ch; c++) {
      const a = d[(y0 * w + xa) * 4 + c], b = d[(y0 * w + xb) * 4 + c], e = d[((y0 + 1) * w + xa) * 4 + c], f = d[((y0 + 1) * w + xb) * 4 + c];
      out[c] = ((a * (1 - tx) + b * tx) * (1 - ty) + (e * (1 - tx) + f * tx) * ty) / 255;
    }
    return out;
  }
  const px = [0, 0, 0], wv = [0];
  B.water = (lat, lon) => wat ? samp(wat, WW, WH, lat, lon, 1, wv)[0] : 0;     // 0 land .. 1 sea
  // the snow line: ~5 km at the equator, ~3 km in the Alps, ~1.5 km in Norway, at sea level near the poles
  B.snowLine = lat => 5200 * Math.pow(Math.cos(Math.min(89, Math.abs(lat)) * Math.PI / 180), 1.35) - 300;
  // the satellite colour, made into the game's look; also what grows there
  //  out: { r, g, b (0..1), forest 0..1, desert 0..1, ice 0..1, boreal 0..1 }
  B.at = function (lat, lon, out) {
    out = out || {};
    if (!img) { out.r = 0.44; out.g = 0.72; out.b = 0.28; out.forest = 0.3; out.desert = 0; out.ice = 0; out.boreal = 0; return out; }
    samp(img, IW, IH, lat, lon, 3, px);
    const r = px[0], g = px[1], b = px[2], mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, s = mx - mn;
    const ice = Math.max(0, Math.min(1, (l - 0.55) * 4)) * Math.max(0, Math.min(1, (0.2 - s) * 6));
    const desert = Math.max(0, Math.min(1, (r - g) * 7 + (r - 0.32) * 2)) * (1 - ice);
    const green = Math.max(0, Math.min(1, (g - r) * 9 + 0.35 - (r - 0.3) * 2)) * (1 - ice) * (1 - desert);
    const forest = Math.max(0, Math.min(1, (0.3 - l) * 5)) * green;
    // colour: lawn greens where it is green, warm sand where it is desert, steppe yellows between, snow on ice
    const lawn = [0.47 - forest * 0.13, 0.76 - forest * 0.18, 0.3 - forest * 0.08], steppe = [0.72, 0.74, 0.38], sand = [0.89, 0.77, 0.52], snow = [0.95, 0.97, 1.0];
    const dry = Math.max(0, 1 - green - desert - ice);
    out.r = lawn[0] * green + sand[0] * desert + steppe[0] * dry + snow[0] * ice;
    out.g = lawn[1] * green + sand[1] * desert + steppe[1] * dry + snow[1] * ice;
    out.b = lawn[2] * green + sand[2] * desert + steppe[2] * dry + snow[2] * ice;
    // a little of the real tint, so regions differ (darker forests, redder deserts)
    const k = 0.25, br = 1.6; out.r = out.r * (1 - k) + Math.min(1, r * br) * k; out.g = out.g * (1 - k) + Math.min(1, g * br) * k; out.b = out.b * (1 - k) + Math.min(1, b * br) * k;
    out.forest = forest + green * 0.15; out.desert = desert; out.ice = ice; out.green = green;
    out.boreal = Math.max(0, Math.min(1, (Math.abs(lat) - 48) / 10));
    return out;
  };
  // ground colour at a point: biome, snow above the snow line, rock on steep slopes, sand on beaches and the sea floor
  const tmp = {};
  B.ground = function (lat, lon, alt, upness, out, bio) {
    const c = bio || B.at(lat, lon, tmp);
    let r = c.r, g = c.g, b = c.b;
    if (alt < 2.5) { const w = B.water(lat, lon); if (w > 0.25) { const k = Math.min(1, (w - 0.25) * 3) * Math.min(1, (2.5 - alt) / 2.5); r += (0.88 - r) * k; g += (0.8 - g) * k; b += (0.6 - b) * k; } }
    const steep = Math.max(0, Math.min(1, (0.86 - upness) * 5)), high = Math.max(0, Math.min(1, (alt - 1200) / 900));
    const rock = Math.max(steep * (0.4 + 0.6 * high), high * 0.35);
    r += (0.62 - r) * rock; g += (0.6 - g) * rock; b += (0.6 - b) * rock;
    const sl = B.snowLine(lat), sn = Math.max(0, Math.min(1, (alt - sl) / 250)) * (1 - steep * 0.5);
    r += (0.95 - r) * sn; g += (0.97 - g) * sn; b += (1.0 - b) * sn;
    out.r = r; out.g = g; out.b = b; return out;
  };
  root.Biome = B;
})(window);
