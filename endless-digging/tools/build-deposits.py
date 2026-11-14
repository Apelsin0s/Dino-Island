# Builds src/deposits.js: the resource table (prices from rarity) and the deposits shown on the world map.
#   python3 tools/build-deposits.py <cache dir with mrds/mrds.csv>
# Ukraine: a hand-made list (coordinates approximate, status checked against what is known in 2026).
# The rest of the world: large deposits (prod_size L) from USGS MRDS (mrdata.usgs.gov, public domain; status as of its last update).
import csv, json, os, re, sys
csv.field_size_limit(10 ** 9)
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')

# id: [ru, en, symbol, colour, abundance in the crust (ppm)] -- price per litre = 0.08 * (1e6 / ppm) ** 0.45
RES = {
  'fe': ['Железо', 'Iron', 'Fe', '#8a5a44', 56300], 'mn': ['Марганец', 'Manganese', 'Mn', '#a2456e', 950], 'ti': ['Титан', 'Titanium', 'Ti', '#7f8fa6', 5650],
  'zr': ['Цирконий', 'Zirconium', 'Zr', '#b9a37a', 165], 'cr': ['Хром', 'Chromium', 'Cr', '#5c8a6b', 102], 'v': ['Ванадий', 'Vanadium', 'V', '#6e6aa8', 120],
  'al': ['Бокситы (алюминий)', 'Bauxite (aluminium)', 'Al', '#c47a4a', 82300], 'cu': ['Медь', 'Copper', 'Cu', '#c46a2c', 60], 'zn': ['Цинк', 'Zinc', 'Zn', '#7a9bb0', 70],
  'pb': ['Свинец', 'Lead', 'Pb', '#5b6470', 14], 'ni': ['Никель', 'Nickel', 'Ni', '#7ba05b', 84], 'co': ['Кобальт', 'Cobalt', 'Co', '#2f5fb3', 25],
  'li': ['Литий', 'Lithium', 'Li', '#d14b8f', 20], 'sn': ['Олово', 'Tin', 'Sn', '#9aa3ad', 2.3], 'w': ['Вольфрам', 'Tungsten', 'W', '#4b5a6b', 1.25],
  'mo': ['Молибден', 'Molybdenum', 'Mo', '#5a7f8f', 1.2], 'nb': ['Ниобий и тантал', 'Niobium & tantalum', 'Nb', '#6b6f9e', 20], 'be': ['Бериллий', 'Beryllium', 'Be', '#4fa39a', 2.8],
  'ree': ['Редкоземельные металлы', 'Rare earths', 'REE', '#8e5bb5', 50], 'u': ['Уран', 'Uranium', 'U', '#7cc93a', 2.7], 'sb': ['Сурьма', 'Antimony', 'Sb', '#8b8b6b', 0.2],
  'hg': ['Ртуть', 'Mercury', 'Hg', '#b0b6c0', 0.085], 'ag': ['Серебро', 'Silver', 'Ag', '#c9ced6', 0.075], 'au': ['Золото', 'Gold', 'Au', '#e0b020', 0.004],
  'pt': ['Платина и палладий', 'Platinum & palladium', 'Pt', '#d9dde3', 0.005], 'diamond': ['Алмазы', 'Diamonds', '◆', '#7fd3f0', 0.0005],
  'coal': ['Уголь', 'Coal', 'C', '#2b2b2b', 5000], 'graphite': ['Графит', 'Graphite', 'Gr', '#4a4f57', 200], 'p': ['Фосфаты', 'Phosphate', 'P', '#c9a25a', 1050],
  'k': ['Калийная соль', 'Potash', 'K', '#d08080', 20900], 'salt': ['Каменная соль', 'Rock salt', 'NaCl', '#e8e2d6', 23600], 's': ['Сера', 'Sulfur', 'S', '#e3d23a', 350],
  'kaolin': ['Каолин', 'Kaolin', 'Kl', '#ece6da', 82300], 'f': ['Флюорит', 'Fluorite', 'F', '#9b7fd1', 585], 'ba': ['Барит', 'Barite', 'Ba', '#a9b4a0', 425],
  'amber': ['Янтарь', 'Amber', 'Am', '#f0a030', 0.5], 'stone': ['Гранит и габбро', 'Granite & gabbro', 'Gn', '#b9a8a0', 280000],
  'oil': ['Нефть', 'Oil', 'Oil', '#1d1d1d', 0], 'gas': ['Газ', 'Natural gas', 'Gas', '#5fb0e6', 0],
}
def price(ppm): return 0 if not ppm else round(0.08 * (1e6 / ppm) ** 0.45, 2)

# Ukraine: [lat, lon, res, ru, en, status]   status: work, idle, closed, occ14, occ22, front, expl
UA = [
  [48.035, 33.44, 'fe', 'Северный ГОК (Кривбасс)', 'Northern GOK (Kryvbas)', 'work'],
  [47.985, 33.40, 'fe', 'Центральный ГОК (Кривбасс)', 'Central GOK (Kryvbas)', 'work'],
  [47.86, 33.36, 'fe', 'Южный ГОК (Кривбасс)', 'Southern GOK (Kryvbas)', 'work'],
  [47.92, 33.31, 'fe', 'Новокриворожский ГОК', 'Novokryvorizkyi GOK', 'work'],
  [47.70, 33.25, 'fe', 'Ингулецкий ГОК', 'Inhulets GOK', 'work'],
  [47.95, 33.37, 'fe', 'Шахты Кривбасса (подземная добыча)', 'Kryvbas underground mines', 'work'],
  [49.05, 33.47, 'fe', 'Полтавский ГОК (Горишние Плавни)', 'Poltava GOK (Horishni Plavni)', 'work'],
  [49.08, 33.58, 'fe', 'Еристовское месторождение', 'Yerystivske deposit', 'expl'],
  [47.43, 34.95, 'fe', 'Запорожский ЖРК (Днепрорудное)', 'Zaporizhzhia iron ore (Dniprorudne)', 'occ22'],
  [45.36, 36.45, 'fe', 'Камыш-Бурунское (Керчь)', 'Kamysh-Burun (Kerch)', 'occ14'],
  [47.58, 34.40, 'mn', 'Покровский ГОК (Никопольский бассейн)', 'Pokrov GOK (Nikopol basin)', 'front'],
  [47.645, 34.62, 'mn', 'Марганецкий ГОК', 'Marhanets GOK', 'front'],
  [47.25, 35.70, 'mn', 'Большетокмакское месторождение', 'Velykyi Tokmak deposit', 'occ22'],
  [48.49, 34.06, 'ti', 'Вольногорский ГМК (Малышевское)', 'Vilnohirsk mining (Malyshevske)', 'work'],
  [50.72, 28.72, 'ti', 'Иршанский ГОК', 'Irshansk mining', 'work'],
  [50.88, 28.66, 'ti', 'Стремигородское (титан и апатит)', 'Stremyhorod (titanium, apatite)', 'expl'],
  [48.49, 34.03, 'zr', 'Малышевское (цирконий)', 'Malyshevske (zirconium)', 'work'],
  [47.33, 37.40, 'ree', 'Азовское (редкие земли)', 'Azovske (rare earths)', 'occ22'],
  [47.40, 36.30, 'ree', 'Новополтавское (редкие земли, фосфор)', 'Novopoltavske (rare earths, phosphorus)', 'occ22'],
  [47.38, 37.62, 'nb', 'Мазуровское (ниобий, цирконий)', 'Mazurivske (niobium, zirconium)', 'occ22'],
  [48.32, 33.50, 'u', 'Ингульская шахта (ВостГОК)', 'Inhulska mine (VostGOK)', 'work'],
  [48.40, 33.48, 'u', 'Мичуринское (Жёлтые Воды)', 'Michurinske (Zhovti Vody)', 'work'],
  [48.73, 31.63, 'u', 'Смолинская шахта', 'Smolino mine', 'work'],
  [48.56, 32.48, 'u', 'Новоконстантиновское', 'Novokostiantynivske', 'expl'],
  [48.20, 30.04, 'graphite', 'Завальевский графитовый комбинат', 'Zavallia graphite', 'work'],
  [48.06, 33.01, 'graphite', 'Балаховское (графит)', 'Balakhivka (graphite)', 'expl'],
  [48.13, 37.35, 'li', 'Шевченковское (литий)', 'Shevchenkivske (lithium)', 'occ22'],
  [48.41, 32.40, 'li', 'Добра (литий)', 'Dobra (lithium)', 'expl'],
  [48.35, 31.82, 'li', 'Полоховское (литий, тантал)', 'Polokhivske (lithium, tantalum)', 'expl'],
  [47.18, 36.17, 'li', 'Крутая Балка (литий)', 'Kruta Balka (lithium)', 'occ22'],
  [48.16, 23.04, 'au', 'Мужиевское (золото)', 'Muzhiievo (gold)', 'closed'],
  [48.20, 22.64, 'au', 'Береговское (золото, полиметаллы)', 'Berehove (gold, base metals)', 'closed'],
  [48.48, 32.22, 'au', 'Клинцовское (золото)', 'Klintsi (gold)', 'expl'],
  [47.93, 34.03, 'au', 'Сергеевское (золото)', 'Serhiivske (gold)', 'expl'],
  [47.82, 30.98, 'au', 'Майское (золото)', 'Maiske (gold)', 'expl'],
  [48.18, 30.62, 'ni', 'Побужский ферроникелевый (Побужское)', 'Pobuzke ferronickel', 'idle'],
  [51.47, 26.45, 'cu', 'Волынская самородная медь (Рафаловка)', 'Volyn native copper (Rafalivka)', 'expl'],
  [48.33, 37.98, 'hg', 'Никитовское (ртуть, Горловка)', 'Mykytivka (mercury, Horlivka)', 'occ14'],
  [48.32, 38.08, 'coal', 'Шахты Донбасса (оккупированная часть)', 'Donbas mines (occupied part)', 'occ14'],
  [48.29, 37.18, 'coal', 'Покровское шахтоуправление', 'Pokrovske mining (coking coal)', 'front'],
  [48.35, 37.86, 'coal', 'Шахты Торецка и Горловки', 'Toretsk and Horlivka mines', 'occ22'],
  [48.52, 35.90, 'coal', 'Павлоградуголь (Западный Донбасс)', 'Pavlohrad coal', 'work'],
  [50.39, 24.24, 'coal', 'Львовско-Волынский бассейн (Червоноград)', 'Lviv-Volyn basin (Chervonohrad)', 'work'],
  [48.67, 33.11, 'coal', 'Днепровский буроугольный бассейн (Александрия)', 'Dnipro lignite (Oleksandriia)', 'closed'],
  [48.69, 38.18, 'salt', 'Соледар (Артёмсоль)', 'Soledar (Artemsil)', 'occ22'],
  [48.85, 37.60, 'salt', 'Славянские солеварни', 'Sloviansk salt', 'front'],
  [47.95, 23.86, 'salt', 'Солотвинское (соль)', 'Solotvyno (salt)', 'closed'],
  [46.10, 34.00, 'salt', 'Сиваш (соль, бром)', 'Syvash (salt, bromine)', 'occ14'],
  [49.03, 24.36, 'k', 'Калуш (калийная соль)', 'Kalush (potash)', 'idle'],
  [49.29, 23.55, 'k', 'Стебник (калийная соль)', 'Stebnyk (potash)', 'closed'],
  [49.96, 23.40, 's', 'Яворовское (сера)', 'Yavoriv (sulfur)', 'closed'],
  [49.47, 24.04, 's', 'Роздольское (сера)', 'Rozdil (sulfur)', 'closed'],
  [51.20, 24.63, 'p', 'Ратновское (фосфориты)', 'Ratne (phosphorite)', 'expl'],
  [49.10, 28.95, 'kaolin', 'Глуховецкое (каолин)', 'Hlukhivtsi (kaolin)', 'work'],
  [48.52, 36.42, 'kaolin', 'Просяновское (каолин)', 'Prosiana (kaolin)', 'work'],
  [49.30, 31.95, 'kaolin', 'Дашуковское (бентонит)', 'Dashukivka (bentonite)', 'work'],
  [50.95, 28.62, 'stone', 'Коростенские граниты и лабрадориты', 'Korosten granite and labradorite', 'work'],
  [50.25, 28.70, 'stone', 'Житомирские граниты', 'Zhytomyr granite', 'work'],
  [51.56, 26.92, 'amber', 'Клесов (янтарь)', 'Klesiv (amber)', 'work'],
  [51.25, 26.10, 'amber', 'Янтарь Ровенщины и Волыни', 'Rivne-Volyn amber', 'work'],
  [50.75, 27.70, 'be', 'Пержанское (бериллий)', 'Perzhanske (beryllium)', 'expl'],
  [49.65, 36.53, 'gas', 'Шебелинское (газ)', 'Shebelynka (gas)', 'work'],
  [49.85, 35.80, 'gas', 'Днепровско-Донецкая впадина (газ)', 'Dnipro-Donets basin (gas)', 'work'],
  [49.03, 24.00, 'gas', 'Бильче-Волица (газ)', 'Bilche-Volytsia (gas)', 'work'],
  [49.29, 23.42, 'oil', 'Бориславское (нефть)', 'Boryslav (oil)', 'work'],
  [48.97, 23.95, 'oil', 'Долинское (нефть)', 'Dolyna (oil)', 'work'],
  [48.98, 37.25, 'gas', 'Юзовская площадь (сланцевый газ)', 'Yuzivska area (shale gas)', 'front'],
]

# a few famous deposits MRDS lacks or places poorly (oil, gas, coal, brines, diamonds)
WORLD_EXTRA = [
  [25.4, 49.5, 'oil', 'Гавар', 'Ghawar'], [29.0, 47.9, 'oil', 'Бурган', 'Burgan'], [61.1, 76.8, 'oil', 'Самотлор', 'Samotlor'], [31.9, -102.3, 'oil', 'Пермский бассейн', 'Permian Basin'],
  [57.0, 2.0, 'oil', 'Северное море', 'North Sea'], [8.0, 6.0, 'oil', 'Дельта Нигера', 'Niger Delta'], [57.0, -111.6, 'oil', 'Нефтеносные пески Атабаски', 'Athabasca oil sands'],
  [26.5, 52.0, 'gas', 'Северное / Южный Парс', 'North Dome / South Pars'], [66.0, 77.0, 'gas', 'Уренгой', 'Urengoy'], [38.2, 63.0, 'gas', 'Галкыныш', 'Galkynysh'],
  [-22.5, 148.5, 'coal', 'Боуэнский бассейн', 'Bowen Basin'], [43.9, -105.5, 'coal', 'Паудер-Ривер', 'Powder River Basin'], [54.0, 86.5, 'coal', 'Кузбасс', 'Kuzbass'],
  [38.0, 112.5, 'coal', 'Шаньси', 'Shanxi coalfield'], [23.75, 86.4, 'coal', 'Джхария', 'Jharia'], [-26.0, 29.3, 'coal', 'Мпумаланга', 'Mpumalanga coalfields'],
  [-23.5, -68.2, 'li', 'Салар-де-Атакама', 'Salar de Atacama'], [-20.3, -67.5, 'li', 'Салар-де-Уюни', 'Salar de Uyuni'], [-33.86, 116.06, 'li', 'Гринбушес', 'Greenbushes'], [-21.05, 118.9, 'li', 'Пилганура', 'Pilgangoora'],
  [-24.4, 25.5, 'diamond', 'Джваненг', 'Jwaneng'], [62.53, 113.99, 'diamond', 'Мир (Якутия)', 'Mir (Yakutia)'], [-9.4, 20.3, 'diamond', 'Катока', 'Catoca'], [64.2, 65.0, 'diamond', 'Удачная', 'Udachny'],
  [41.8, 109.97, 'ree', 'Баян-Обо', 'Bayan Obo'], [35.48, -115.53, 'ree', 'Маунтин-Пасс', 'Mountain Pass'], [-28.86, 122.55, 'ree', 'Маунт-Уэлд', 'Mount Weld'],
  [58.2, -103.7, 'u', 'Сигар-Лейк', 'Cigar Lake'], [-30.44, 136.88, 'u', 'Олимпик-Дам', 'Olympic Dam'], [45.0, 67.5, 'u', 'Инкай (Казахстан)', 'Inkai (Kazakhstan)'],
  [52.8, 27.5, 'k', 'Солигорск (Беларуськалий)', 'Soligorsk (Belaruskali)'], [59.4, 56.8, 'k', 'Березники (Уралкалий)', 'Berezniki (Uralkali)'], [51.7, -106.0, 'k', 'Саскачеван', 'Saskatchewan potash'],
  [32.88, -6.9, 'p', 'Хурибга', 'Khouribga'], [34.4, 8.8, 'p', 'Гафса', 'Gafsa'], [-12.5, 141.9, 'al', 'Уэйпа', 'Weipa'], [10.9, -14.3, 'al', 'Боке', 'Boké'],
  [54.95, 20.48, 'amber', 'Янтарный (Калининград)', 'Yantarny (Kaliningrad)'], [-10.7, 25.5, 'co', 'Колвези', 'Kolwezi'], [69.35, 88.2, 'ni', 'Норильск', 'Norilsk'],
]

def res_of(commod):
    c = commod.lower()
    rules = [('gold', 'au'), ('silver', 'ag'), ('platinum', 'pt'), ('palladium', 'pt'), ('pge', 'pt'), ('uranium', 'u'), ('lithium', 'li'), ('rare earth', 'ree'), ('ree', 'ree'),
             ('cerium', 'ree'), ('lanthan', 'ree'), ('diamond', 'diamond'), ('cobalt', 'co'), ('nickel', 'ni'), ('copper', 'cu'), ('zinc', 'zn'), ('lead', 'pb'), ('tin', 'sn'),
             ('tungsten', 'w'), ('molybdenum', 'mo'), ('niobium', 'nb'), ('tantalum', 'nb'), ('beryllium', 'be'), ('mercury', 'hg'), ('antimony', 'sb'), ('chromium', 'cr'),
             ('vanadium', 'v'), ('titanium', 'ti'), ('zirconium', 'zr'), ('manganese', 'mn'), ('iron', 'fe'), ('alumin', 'al'), ('bauxite', 'al'), ('phosph', 'p'),
             ('potash', 'k'), ('potassium', 'k'), ('salt', 'salt'), ('sodium', 'salt'), ('sulfur', 's'), ('graphite', 'graphite'), ('coal', 'coal'), ('kaolin', 'kaolin'),
             ('fluor', 'f'), ('barium', 'ba'), ('barite', 'ba')]
    for word, rid in rules:
        if re.search(r'\b' + word, c): return rid
    return None

world = []
src = os.path.join(sys.argv[1], 'mrds', 'mrds.csv')
seen = set()
with open(src, encoding='latin-1') as f:
    for row in csv.DictReader(f):
        if row['prod_size'] != 'L' or row['country'] == 'Ukraine': continue
        if row['dev_stat'] not in ('Producer', 'Past Producer'): continue
        if '(facility)' in row['site_name'].lower() or 'plant' in row['dep_type'].lower(): continue
        rid = res_of(row['commod1'] or '');
        if not rid: continue
        try: lat, lon = round(float(row['latitude']), 3), round(float(row['longitude']), 3)
        except ValueError: continue
        k = (round(lat, 1), round(lon, 1), rid)
        if k in seen: continue
        seen.add(k)
        name = re.sub(r'\s+', ' ', row['site_name']).strip()[:48]
        world.append([lat, lon, rid, name, name, 'usgs_prod' if row['dev_stat'] == 'Producer' else 'usgs_past', row['country']])
for e in WORLD_EXTRA: world.append([e[0], e[1], e[2], e[3], e[4], 'known', ''])

res = {k: { 'ru': v[0], 'en': v[1], 'sym': v[2], 'col': v[3], 'ppm': v[4], 'price': price(v[4]) } for k, v in RES.items()}
data = { 'res': res, 'ua': [r + ['UA'] for r in UA], 'world': world }
open(os.path.join(ROOT, 'src', 'deposits.js'), 'w').write('// Generated by tools/build-deposits.py. Ukraine: hand-made list (approximate coordinates, status 2026).\n'
    '// World: large deposits from USGS MRDS (public domain, status as of its last update) and a few famous oil, gas, coal and brine fields.\n'
    '// Price per litre in the game = 0.08 * (1e6 / abundance in the crust, ppm) ^ 0.45: the rarer, the dearer.\n'
    'window.DepositData = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
from collections import Counter
print('ua', len(UA), 'world', len(world), Counter(w[2] for w in world).most_common(12))
print({k: v['price'] for k, v in res.items()})
