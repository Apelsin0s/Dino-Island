# Lakes and rivers of the whole Earth for the game: where the water is, at what level, how wide and deep.
#   python3 tools/build-water.py <natural earth folder>
# Sources (Natural Earth, public domain): ne_10m_lakes, ne_10m_lakes_europe, ne_10m_lakes_north_america,
#   ne_10m_rivers, ne_10m_rivers_europe, ne_10m_rivers_north_america (.geojson). Water levels come from the
#   game's own relief (src/dem/world, src/dem/ukraine.txt, src/dem/local.txt), so the water sits right in the ground.
# Output (src/dem/water/): <c>_<r>.txt per 15° block that has water: base64(zlib(JSON)) with
#   lakes: 1/120° raster (uint16: lake id * 16 + distance inside the shore in pixels, 0..15), base64-zlib inside;
#   rivers: segments [lat0, lon0, lat1, lon1, level0, level1, width]. src/dem/water.js: lake levels and depths.
# Not included: Kakhovka Reservoir (drained in June 2023).
import os, sys, json, math, zlib, base64
import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage
SRC = sys.argv[1]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'dem', 'water'); os.makedirs(OUT, exist_ok=True)
for f in os.listdir(OUT): os.remove(os.path.join(OUT, f))
B, RES = 15, 120                     # block size (deg), raster cells per degree
S = B * RES
SKIP = {'Kakhovka Reservoir'}

# ---------- the game's relief (world 1/30° grid; Ukraine 2 km; start 20 m) ----------
WI = json.loads(open(os.path.join(ROOT, 'src', 'dem', 'world.js')).read().split('=', 1)[1].strip().rstrip(';'))
blocks = {}
def wblock(c, r):
    k = (c, r)
    if k not in blocks:
        raw = zlib.decompress(base64.b64decode(open(os.path.join(ROOT, 'src', 'dem', 'world', f'{c}_{r}.txt')).read()))
        d = np.frombuffer(raw, '<i2').astype(np.int32).reshape(WI['size'], WI['size'])
        d[:, 0] = np.cumsum(d[:, 0]); d = np.cumsum(d, axis=1)
        blocks[k] = d.astype(np.float32)
    return blocks[k]
def world_h(lat, lon):
    lon = ((lon + 180) % 360) - 180
    c = min(23, max(0, int((lon + 180) // B))); r = min(11, max(0, int((90 - lat) // B)))
    d = wblock(c, r); fx = (lon - (-180 + c * B)) / WI['step'] + 1; fy = ((90 - r * B) - lat) / WI['step'] + 1
    x = min(WI['size'] - 2, max(0, int(fx))); y = min(WI['size'] - 2, max(0, int(fy))); tx = fx - x; ty = fy - y
    return (d[y, x] * (1 - tx) + d[y, x + 1] * tx) * (1 - ty) + (d[y + 1, x] * (1 - tx) + d[y + 1, x + 1] * tx) * ty
DI = json.loads(open(os.path.join(ROOT, 'src', 'dem', 'dem.js')).read().split('=', 1)[1].strip().rstrip(';'))
grids = {}
for k in ('ukraine', 'local'):
    g = DI[k]; g['d'] = np.frombuffer(base64.b64decode(open(os.path.join(ROOT, 'src', g['file'])).read()), '<i2').reshape(g['h'], g['w']).astype(np.float32) * 0.1; grids[k] = g
def grid_h(g, lat, lon):
    b = g['box']; fx = (lon - b[0]) / (b[1] - b[0]) * (g['w'] - 1); fy = (b[3] - lat) / (b[3] - b[2]) * (g['h'] - 1)
    if fx < 1 or fy < 1 or fx > g['w'] - 3 or fy > g['h'] - 3: return None
    x, y = int(fx), int(fy); tx, ty = fx - x, fy - y; d = g['d']
    return (d[y, x] * (1 - tx) + d[y, x + 1] * tx) * (1 - ty) + (d[y + 1, x] * (1 - tx) + d[y + 1, x + 1] * tx) * ty
def ground(lat, lon):   # the best relief the game has there
    for k in ('local', 'ukraine'):
        v = grid_h(grids[k], lat, lon)
        if v is not None: return v
    return world_h(lat, lon)

# ---------- read ----------
def load(name):
    p = os.path.join(SRC, name + '.geojson')
    return json.load(open(p))['features'] if os.path.exists(p) else []
lakes, seen = [], set()
for f in load('ne_10m_lakes') + load('ne_10m_lakes_europe') + load('ne_10m_lakes_north_america'):
    g = f['geometry']; pr = f['properties']; name = pr.get('name') or ''
    if not g or name in SKIP: continue
    polys = g['coordinates'] if g['type'] == 'MultiPolygon' else [g['coordinates']]
    xs = [p[0] for poly in polys for p in poly[0]]; ys = [p[1] for poly in polys for p in poly[0]]
    key = (name, round(min(xs), 2), round(min(ys), 2))
    if key in seen: continue
    seen.add(key); lakes.append({'name': name, 'polys': polys, 'box': (min(xs), max(xs), min(ys), max(ys))})
rivers = []
for f in load('ne_10m_rivers') + load('ne_10m_rivers_europe') + load('ne_10m_rivers_north_america'):
    g = f['geometry']; pr = f['properties']
    if not g or pr.get('featurecla') == 'Lake Centerline': continue
    lines = g['coordinates'] if g['type'] == 'MultiLineString' else [g['coordinates']]
    sr = pr.get('scalerank') or 9
    w = {0: 1200, 1: 1000, 2: 800, 3: 650, 4: 500, 5: 360, 6: 260, 7: 190, 8: 140, 9: 100, 10: 80, 11: 60, 12: 50}.get(int(sr), 50)
    for ln in lines:
        if len(ln) >= 2: rivers.append({'name': pr.get('name') or '', 'pts': ln, 'w': w})
print('lakes', len(lakes), 'river lines', len(rivers), flush=True)

# ---------- lakes: raster per block, level from the relief ----------
lake_info = []   # [level, maxDepth]
rasters = {}
def block_raster(c, r):
    if (c, r) not in rasters: rasters[(c, r)] = np.zeros((S, S), np.uint16)
    return rasters[(c, r)]
lakes.sort(key=lambda L: -(L['box'][1] - L['box'][0]) * (L['box'][3] - L['box'][2]))
for L in lakes[:4000]:
    lid = len(lake_info) + 1
    x0, x1, y0, y1 = L['box']
    # rasterize on a canvas covering the lake (1/120°), find inside distance, then write into the blocks
    W_ = int(math.ceil((x1 - x0) * RES)) + 4; H_ = int(math.ceil((y1 - y0) * RES)) + 4
    if W_ * H_ > 4e7: continue
    ox, oy = math.floor(x0 * RES) - 2, math.ceil(y1 * RES) + 2   # cell column / row of the canvas corner (rows go south)
    im = Image.new('L', (W_, H_), 0); dr = ImageDraw.Draw(im)
    for poly in L['polys']:
        for i, ring in enumerate(poly):
            dr.polygon([((p[0] * RES - ox), (oy - p[1] * RES)) for p in ring], fill=0 if i else 1)
    m = np.asarray(im) > 0
    if m.sum() == 0:   # very small: one cell at its centre
        m[H_ // 2, W_ // 2] = True
    dist = np.clip(np.ceil(ndimage.distance_transform_edt(m)), 0, 15).astype(np.uint16)
    ys, xs = np.nonzero(m)
    samp = [ground(oy / RES - (yy + 0.5) / RES, (ox + xx + 0.5) / RES) for yy, xx in zip(ys[::max(1, len(ys) // 400)], xs[::max(1, len(xs) // 400)])]
    level = float(np.percentile(samp, 35))
    area = m.sum() * (111.2 / RES) ** 2 * math.cos(math.radians((y0 + y1) / 2))
    lake_info.append([round(level, 1), round(min(60, 4 + math.sqrt(area) * 0.8), 1), L['name']])
    # write into blocks
    for yy, xx in zip(ys, xs):
        lat = oy / RES - (yy + 0.5) / RES; lon = (ox + xx + 0.5) / RES
        lon = ((lon + 180) % 360) - 180
        c = int((lon + 180) // B); r = int((90 - lat) // B)
        if not (0 <= c < 24 and 0 <= r < 12): continue
        R = block_raster(c, r); px = int((lon - (-180 + c * B)) * RES); py = int(((90 - r * B) - lat) * RES)
        if 0 <= px < S and 0 <= py < S: R[py, px] = lid * 16 + int(dist[yy, xx])
print('lakes rasterized', len(lake_info), 'blocks', len(rasters), flush=True)

# ---------- rivers: ~1 km segments, level = lowest ground nearby, flowing downhill ----------
def hav(a, b):
    la = math.radians((a[1] + b[1]) / 2); return math.hypot((b[0] - a[0]) * 111200 * math.cos(la), (b[1] - a[1]) * 111200)
seg_by_block = {}
nseg = 0
for Rv in rivers:
    pts = []
    for i in range(len(Rv['pts']) - 1):
        a, b = Rv['pts'][i], Rv['pts'][i + 1]; n = max(1, int(hav(a, b) / 1000))
        for k in range(n): pts.append((a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n))
    pts.append(tuple(Rv['pts'][-1]))
    if len(pts) < 2: continue
    lv = []
    for (lon, lat) in pts:
        dl = 1.2 / 111.2; v = min(ground(lat + dy * dl, lon + dx * dl / max(0.2, math.cos(math.radians(lat)))) for dy in (-1, 0, 1) for dx in (-1, 0, 1))
        lv.append(v)
    lv = np.array(lv); k = 5; lv = np.convolve(np.pad(lv, k, mode='edge'), np.ones(2 * k + 1) / (2 * k + 1), 'valid')
    if lv[0] < lv[-1]: lv = lv[::-1]; pts = pts[::-1]
    lv = np.minimum.accumulate(lv) - 1.0           # water never runs uphill
    for i in range(len(pts) - 1):
        (lo0, la0), (lo1, la1) = pts[i], pts[i + 1]
        c = int((((lo0 + 180) % 360)) // B); r = min(11, max(0, int((90 - la0) // B)))
        seg_by_block.setdefault((c, r), []).extend([round(la0, 5), round(lo0, 5), round(la1, 5), round(lo1, 5), round(float(lv[i]), 1), round(float(lv[i + 1]), 1), Rv['w']])
        nseg += 1
print('river segments', nseg, flush=True)

# ---------- write ----------
keys = set(rasters) | set(seg_by_block)
total = 0
for (c, r) in sorted(keys):
    o = {}
    if (c, r) in rasters: o['lakes'] = base64.b64encode(zlib.compress(rasters[(c, r)].astype('<u2').tobytes(), 9)).decode()
    if (c, r) in seg_by_block: o['rivers'] = seg_by_block[(c, r)]
    txt = base64.b64encode(zlib.compress(json.dumps(o, separators=(',', ':')).encode(), 9)).decode(); total += len(txt)
    open(os.path.join(OUT, f'{c}_{r}.txt'), 'w').write(txt)
info = {'block': B, 'res': RES, 'size': S, 'file': 'dem/water/{c}_{r}.txt', 'blocks': sorted(f'{c}_{r}' for c, r in keys), 'lakes': [[l[0], l[1]] for l in lake_info]}
open(os.path.join(ROOT, 'src', 'dem', 'water.js'), 'w').write('// Generated by tools/build-water.py: lakes and rivers (Natural Earth), levels from the game relief.\nwindow.WaterInfo = ' + json.dumps(info, separators=(',', ':')) + ';\n')
print('blocks', len(keys), 'size', round(total / 1e6, 1), 'MB')
