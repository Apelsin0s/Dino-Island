# Detailed relief (~40 m) for famous volcanoes, craters, mountains and canyons, on top of the 3.7 km world grid.
# Source: Terrarium tiles at zoom 12 (Mapzen / AWS open data). Downloads into <cache dir>.
#   python3 tools/build-patches.py <cache dir>
# Output: src/dem/patches/<id>.txt (half-metres, rows delta-coded, zlib, base64), src/dem/patches.js (list).
import math, os, sys, json, zlib, base64, urllib.request
from concurrent.futures import ThreadPoolExecutor
import numpy as np
from PIL import Image
CACHE = sys.argv[1]; os.makedirs(CACHE, exist_ok=True)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'dem', 'patches'); os.makedirs(OUT, exist_ok=True)
Z = 12; N = 2 ** Z; SPACING = 40.0
# id, English name, lat, lon, box size (km)
PLACES = [
  ('fuji', 'Mount Fuji', 35.3606, 138.7274, 26), ('etna', 'Etna', 37.751, 14.993, 32), ('vesuvius', 'Vesuvius', 40.821, 14.426, 14),
  ('kilimanjaro', 'Kilimanjaro', -3.067, 37.356, 44), ('maunakea', 'Mauna Kea', 19.82, -155.47, 40), ('maunaloa', 'Mauna Loa and Kilauea', 19.43, -155.45, 44),
  ('teide', 'Teide', 28.272, -16.642, 26), ('popocatepetl', 'Popocatepetl', 19.05, -98.63, 30), ('krakatoa', 'Krakatoa', -6.102, 105.423, 14),
  ('sthelens', 'Mount St. Helens', 46.191, -122.196, 16), ('rainier', 'Mount Rainier', 46.853, -121.760, 26), ('erebus', 'Mount Erebus', -77.53, 167.15, 26),
  ('cotopaxi', 'Cotopaxi', -0.68, -78.437, 22), ('chimborazo', 'Chimborazo', -1.469, -78.817, 22), ('ararat', 'Ararat', 39.70, 44.30, 32),
  ('elbrus', 'Elbrus', 43.355, 42.439, 26), ('kazbek', 'Kazbek', 42.697, 44.518, 20), ('damavand', 'Damavand', 35.955, 52.110, 26),
  ('stromboli', 'Stromboli', 38.789, 15.213, 8), ('eyjafjalla', 'Eyjafjallajokull', 63.63, -19.62, 22), ('hekla', 'Hekla', 63.98, -19.70, 16),
  ('pinatubo', 'Pinatubo', 15.142, 120.350, 16), ('tambora', 'Tambora', -8.25, 117.99, 26), ('yellowstone', 'Yellowstone', 44.43, -110.67, 44),
  ('craterlake', 'Crater Lake', 42.94, -122.10, 16), ('ngorongoro', 'Ngorongoro', -3.17, 35.58, 30), ('santorini', 'Santorini', 36.40, 25.40, 18),
  ('meteor', 'Meteor Crater', 35.027, -111.022, 6), ('pingualuit', 'Pingualuit Crater', 61.277, -73.660, 6), ('wolfecreek', 'Wolfe Creek Crater', -19.172, 127.795, 5),
  ('everest', 'Everest', 27.988, 86.925, 44), ('k2', 'K2', 35.881, 76.513, 32), ('matterhorn', 'Matterhorn', 45.977, 7.659, 18),
  ('montblanc', 'Mont Blanc', 45.833, 6.865, 26), ('eiger', 'Eiger', 46.577, 8.005, 16), ('aconcagua', 'Aconcagua', -32.653, -70.011, 32),
  ('denali', 'Denali', 63.069, -151.007, 44), ('grandcanyon', 'Grand Canyon', 36.10, -112.11, 44), ('hoverla', 'Hoverla', 48.160, 24.500, 26),
  ('aipetri', 'Crimean Mountains', 44.60, 34.25, 44), ('tablemountain', 'Table Mountain', -33.960, 18.400, 14), ('sugarloaf', 'Sugarloaf Mountain', -22.949, -43.157, 10),
  ('uluru', 'Uluru', -25.345, 131.036, 10), ('yosemite', 'Yosemite', 37.746, -119.533, 22), ('zugspitze', 'Zugspitze', 47.421, 10.985, 16),
  ('olympus', 'Mount Olympus', 40.085, 22.359, 22), ('kosciuszko', 'Kosciuszko', -36.456, 148.263, 16), ('kinabalu', 'Kinabalu', 6.075, 116.558, 16),
  ('fitzroy', 'Fitz Roy', -49.271, -73.043, 22), ('torres', 'Torres del Paine', -50.94, -73.40, 22), ('monumentvalley', 'Monument Valley', 36.99, -110.10, 16),
  ('preikestolen', 'Lysefjord', 58.986, 6.188, 16), ('geiranger', 'Geirangerfjord', 62.10, 7.09, 22), ('tatra', 'High Tatras', 49.18, 20.08, 26),
  ('hoverla_pip', 'Pip Ivan (Chornohora)', 48.047, 24.627, 16), ('dnipro_rapids', 'Khortytsia', 47.83, 35.10, 16), ('vinson', 'Mount Vinson', -78.525, -85.617, 32),
]
def merc_y(lat): s = math.sin(math.radians(lat)); return 0.5 - math.log((1 + s) / (1 - s)) / (4 * math.pi)
def fetch(x, y):
    p = os.path.join(CACHE, f'{Z}_{x}_{y}.png')
    if not os.path.exists(p) or os.path.getsize(p) < 100:
        for i in range(4):
            try:
                with urllib.request.urlopen(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{Z}/{x}/{y}.png', timeout=60) as r: open(p, 'wb').write(r.read()); break
            except Exception as e:
                if i == 3: raise
    return p
def tile(x, y):
    a = np.asarray(Image.open(fetch(x % N, y)).convert('RGB')).astype(np.float64)
    return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768
index = []
for pid, name, lat, lon, km in PLACES:
    half = km / 2; dlat = half / 111.2; dlon = half / (111.2 * math.cos(math.radians(lat)))
    box = [lon - dlon, lon + dlon, lat - dlat, lat + dlat]
    W = int(round(km * 1000 / SPACING)) + 1; H = W
    tx0, tx1 = int((box[0] + 180) / 360 * N), int((box[1] + 180) / 360 * N)
    ty0, ty1 = int(merc_y(box[3]) * N), int(merc_y(box[2]) * N)
    with ThreadPoolExecutor(16) as ex: list(ex.map(lambda q: fetch(q[0] % N, q[1]), [(x, y) for y in range(ty0, ty1 + 1) for x in range(tx0, tx1 + 1)]))
    E = np.vstack([np.hstack([tile(x, y) for x in range(tx0, tx1 + 1)]) for y in range(ty0, ty1 + 1)])
    lons = box[0] + np.arange(W) / (W - 1) * (box[1] - box[0]); lats = box[3] - np.arange(H) / (H - 1) * (box[3] - box[2])
    LON, LAT = np.meshgrid(lons, lats)
    fx = ((LON + 180) / 360 * N - tx0) * 256 - 0.5; fy = (np.vectorize(merc_y)(LAT) * N - ty0) * 256 - 0.5
    x0 = np.clip(fx.astype(int), 0, E.shape[1] - 2); y0 = np.clip(fy.astype(int), 0, E.shape[0] - 2); tx = np.clip(fx - x0, 0, 1); ty = np.clip(fy - y0, 0, 1)
    a = E[y0, x0] * (1 - tx) + E[y0, x0 + 1] * tx; b = E[y0 + 1, x0] * (1 - tx) + E[y0 + 1, x0 + 1] * tx
    h = a * (1 - ty) + b * ty
    k = np.pad(h, 1, mode='edge'); h = sum(k[1 + dy:1 + dy + H, 1 + dx:1 + dx + W] * w for dy, dx, w in [(dy, dx, (2 if dy == 0 else 1) * (2 if dx == 0 else 1) / 16) for dy in (-1, 0, 1) for dx in (-1, 0, 1)])   # soften radar speckle
    e = np.clip(np.round(h * 2), -32000, 32000).astype(np.int32)
    d = e.copy(); d[:, 1:] = e[:, 1:] - e[:, :-1]; d[1:, 0] = e[1:, 0] - e[:-1, 0]
    txt = base64.b64encode(zlib.compress(d.astype('<i2').tobytes(), 9)).decode()
    open(os.path.join(OUT, pid + '.txt'), 'w').write(txt)
    index.append({'id': pid, 'name': name, 'box': [round(v, 6) for v in box], 'w': W, 'h': H, 'file': f'dem/patches/{pid}.txt'})
    print(pid, W, 'x', H, 'min', round(h.min()), 'max', round(h.max()), round(len(txt) / 1024), 'KB', flush=True)
open(os.path.join(ROOT, 'src', 'dem', 'patches.js'), 'w').write('// Generated by tools/build-patches.py: ~40 m relief of famous volcanoes, craters, mountains and canyons (Terrarium z12, Mapzen / AWS open data). Units: half-metres.\nwindow.DemPatches = ' + json.dumps(index) + ';\n')
