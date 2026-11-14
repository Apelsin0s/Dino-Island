# Builds the world map textures and the open-region outline for the in-game globe (M key).
#   python3 tools/build-map.py <cache dir>
# Sources (all public domain / MIT, fetched once into the cache dir):
#   - satellite colours: NASA Blue Marble, as packaged in the three.js examples (earth_day_4096.jpg)
#   - elevation and sea depth: Terrarium tiles (s3.amazonaws.com/elevation-tiles-prod), Mapzen / AWS open data
#   - countries, rivers, lakes: Natural Earth (github.com/nvkelso/natural-earth-vector)
# Output: src/map/earth.jpg (whole Earth, 4096x2048, equirectangular), src/map/ukraine.jpg (detail patch),
#         src/map/regions.js (open-region outline + the detail patch box).
import io, json, math, os, sys, urllib.request
import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from shapely.geometry import shape, mapping
from shapely.ops import unary_union

CACHE = sys.argv[1]
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')
OUT = os.path.join(ROOT, 'src', 'map')
os.makedirs(CACHE, exist_ok=True); os.makedirs(OUT, exist_ok=True)

def fetch(url, name):
    p = os.path.join(CACHE, name)
    if not os.path.exists(p):
        with urllib.request.urlopen(url, timeout=120) as r: data = r.read()
        open(p, 'wb').write(data)
    return p

NE = 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/'
day = np.asarray(Image.open(fetch('https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/textures/planets/earth_day_4096.jpg', 'earth_day_4096.jpg')).convert('RGB')).astype(np.float32) / 255
countries = json.load(open(fetch(NE + 'ne_50m_admin_0_countries.geojson', 'ne_50m_countries.geojson')))
rivers = json.load(open(fetch(NE + 'ne_10m_rivers_lake_centerlines.geojson', 'ne_10m_rivers.geojson')))
lakes = json.load(open(fetch(NE + 'ne_10m_lakes.geojson', 'ne_10m_lakes.geojson')))

def tile(z, x, y):
    p = fetch(f'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png', f'terr_{z}_{x}_{y}.png')
    a = np.asarray(Image.open(p).convert('RGB')).astype(np.float32)
    return a[..., 0] * 256 + a[..., 1] + a[..., 2] / 256 - 32768

def elevation(z, x0, x1, y0, y1):   # mosaic of Terrarium tiles x0..x1, y0..y1 (inclusive)
    return np.vstack([np.hstack([tile(z, x, y) for x in range(x0, x1 + 1)]) for y in range(y0, y1 + 1)])

def merc_y(lat):   # fractional tile row at zoom 0
    s = np.sin(np.radians(np.clip(lat, -85.05, 85.05)))
    return 0.5 - np.log((1 + s) / (1 - s)) / (4 * np.pi)

def sample(img, fx, fy):   # bilinear sample of a 2D array at fractional pixel coords
    h, w = img.shape[:2]; fx = np.clip(fx, 0, w - 1.001); fy = np.clip(fy, 0, h - 1.001)
    x0 = fx.astype(int); y0 = fy.astype(int); tx = fx - x0; ty = fy - y0
    if img.ndim == 3: tx = tx[..., None]; ty = ty[..., None]
    a = img[y0, x0] * (1 - tx) + img[y0, x0 + 1] * tx; b = img[y0 + 1, x0] * (1 - tx) + img[y0 + 1, x0 + 1] * tx
    return a * (1 - ty) + b * ty

def elev_equirect(z, lon0, lon1, lat0, lat1, W, H):
    n = 2 ** z
    tx0, tx1 = int((lon0 + 180) / 360 * n), int((lon1 + 180) / 360 * n - 1e-9)
    ty0, ty1 = int(merc_y(lat1) * n), int(merc_y(lat0) * n - 1e-9)
    E = elevation(z, tx0, min(n - 1, tx1), ty0, min(n - 1, ty1))
    lon = lon0 + (np.arange(W) + 0.5) / W * (lon1 - lon0); lat = lat1 - (np.arange(H) + 0.5) / H * (lat1 - lat0)
    LON, LAT = np.meshgrid(lon, lat)
    fx = ((LON + 180) / 360 * n - tx0) * 256 - 0.5; fy = (merc_y(LAT) * n - ty0) * 256 - 0.5
    return sample(E, fx, fy)

def hillshade(E, mpp_x, mpp_y, k):
    gy, gx = np.gradient(E); gx /= mpp_x; gy /= mpp_y
    nx, ny, nz = -gx * k, gy * k, np.ones_like(E); l = np.sqrt(nx * nx + ny * ny + nz * nz)
    L = np.array([-0.55, 0.55, 0.63]); L /= np.linalg.norm(L)
    return (nx * L[0] + ny * L[1] + nz * L[2]) / l / L[2]

def ocean(rgb, E, is_water):
    d = np.clip(-E, 0, 6000)
    shallow, mid, deep = np.array([0.36, 0.72, 0.80]), np.array([0.13, 0.42, 0.66]), np.array([0.05, 0.17, 0.40])
    t1 = np.clip(d / 200, 0, 1)[..., None]; t2 = np.clip((d - 200) / 3800, 0, 1)[..., None] ** 0.7
    col = shallow * (1 - t1) + mid * t1; col = col * (1 - t2) + deep * t2
    w = is_water[..., None].astype(np.float32)
    return rgb * (1 - w) + (col * 0.85 + rgb * 0.15) * w

# ---------------------------------------------------------------- whole Earth
W, H = 4096, 2048
lat = 90 - (np.arange(H) + 0.5) / H * 180
E = np.zeros((H, W), np.float32)
band = (lat < 85.05) & (lat > -85.05)
E[band] = elev_equirect(3, -180, 180, lat[band].min() - 0.05, lat[band].max() + 0.05, W, band.sum())
r, g, b = day[..., 0], day[..., 1], day[..., 2]
water = (b > r + 0.12) & (b > g + 0.04) & (E < 30)          # the Blue Marble ocean colour, where it is low
img = ocean(day, E, water)
hs = hillshade(E, 40075000 / W * np.cos(np.radians(lat))[:, None].clip(0.05), 20037000 / H, 6.0)
img = img * np.where(water, 1, np.clip(0.75 + 0.25 * hs, 0.55, 1.25))[..., None]
im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))

def px(lon, lat_, box, w, h): return ((lon - box[0]) / (box[1] - box[0]) * w, (box[3] - lat_) / (box[3] - box[2]) * h)
def rings(geom):
    t = geom['type']; c = geom['coordinates']
    if t == 'Polygon': return c
    if t == 'MultiPolygon': return [ring for poly in c for ring in poly]
    return []
def draw_borders(im, box, color, width):
    ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
    for f in countries['features']:
        for ring in rings(f['geometry']):
            d.line([px(x, y, box, im.size[0], im.size[1]) for x, y in ring], fill=color, width=width)
    return Image.alpha_composite(im.convert('RGBA'), ov).convert('RGB')
im = draw_borders(im, (-180, 180, -90, 90), (255, 255, 255, 70), 1)
im.save(os.path.join(OUT, 'earth.jpg'), quality=84, optimize=True, progressive=True)
print('earth.jpg', os.path.getsize(os.path.join(OUT, 'earth.jpg')))

# ---------------------------------------------------------------- Ukraine (with Crimea) as the open region
ukr = [f for f in countries['features'] if f['properties']['ADMIN'] == 'Ukraine'][0]
rus = [f for f in countries['features'] if f['properties']['ADMIN'] == 'Russia'][0]
crimea = [p for p in shape(rus['geometry']).geoms if 32 < p.centroid.x < 37 and 44 < p.centroid.y < 46.3]
region = unary_union([shape(ukr['geometry'])] + crimea).buffer(0.002).buffer(-0.002).simplify(0.01)
polys = list(region.geoms) if region.geom_type == 'MultiPolygon' else [region]
polys = [p for p in polys if p.area > 0.002]
out_rings = [[[round(x, 3), round(y, 3)] for x, y in p.exterior.coords] for p in polys]

# ---------------------------------------------------------------- detail patch around Ukraine
BOX = (21.0, 42.0, 43.0, 53.5)   # lon0, lon1, lat0, lat1
DW, DH = 2048, 1024
lat_d = BOX[3] - (np.arange(DH) + 0.5) / DH * (BOX[3] - BOX[2])
Ed = elev_equirect(7, BOX[0], BOX[1], BOX[2], BOX[3], DW, DH)
fx = (BOX[0] + 180 + (np.arange(DW) + 0.5) / DW * (BOX[1] - BOX[0])) / 360 * W - 0.5
fy = (90 - lat_d) / 180 * H - 0.5
FX, FY = np.meshgrid(fx, fy)
base = sample(day, FX, FY)
base = np.asarray(Image.fromarray((base * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32) / 255
water_d = Ed <= 0.5
img = ocean(base, Ed, water_d)
hs = hillshade(Ed, 111320 * (BOX[1] - BOX[0]) / DW * math.cos(math.radians(48)), 111320 * (BOX[3] - BOX[2]) / DH, 5.0)
img = img * np.where(water_d, 1, np.clip(0.8 + 0.2 * hs, 0.55, 1.3))[..., None]
im = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8)).convert('RGBA')
ov = Image.new('RGBA', im.size, (0, 0, 0, 0)); d = ImageDraw.Draw(ov)
water_c = (52, 120, 170, 255)
for f in lakes['features']:
    if 'akhov' in (f['properties'].get('name') or ''): continue   # Kakhovka reservoir: drained since the dam was destroyed in 2023
    for ring in rings(f['geometry']):
        pts = [px(x, y, BOX, DW, DH) for x, y in ring]
        if len(pts) > 2: d.polygon(pts, fill=water_c)
for f in rivers['features']:
    sr = f['properties'].get('scalerank', 9) or 9
    if sr > 9: continue
    g = f['geometry']; lines = [g['coordinates']] if g['type'] == 'LineString' else g['coordinates'] if g['type'] == 'MultiLineString' else []
    for line in lines:
        pts = [px(x, y, BOX, DW, DH) for x, y in line]
        if len(pts) > 1: d.line(pts, fill=water_c, width=3 if sr <= 4 else 2 if sr <= 6 else 1)
im = Image.alpha_composite(im, ov)
im = draw_borders(im, BOX, (255, 255, 255, 90), 2)
im.save(os.path.join(OUT, 'ukraine.jpg'), quality=84, optimize=True, progressive=True)
print('ukraine.jpg', os.path.getsize(os.path.join(OUT, 'ukraine.jpg')))

js = ('// Generated by tools/build-map.py: the regions that are open on the world map and the detail patch box.\n'
      '// Outline: Natural Earth 1:50m (public domain), Ukraine within its internationally recognised borders.\n'
      "window.MapData = " + json.dumps({ 'open': { 'ukraine': out_rings }, 'detail': { 'box': BOX, 'img': 'map/ukraine.jpg' } }, separators=(',', ':')) + ';\n')
open(os.path.join(OUT, 'regions.js'), 'w').write(js)
print('regions.js', len(js), 'rings', len(out_rings), [len(r) for r in out_rings])
