// Chat moderation: children play this game, so the chat is strict by default.
//  - swear words are hidden (several languages, including common letter tricks like "f.u.c.k" or Latin/Cyrillic mixes);
//  - links, e-mail addresses, phone numbers and social handles are hidden (no luring players off the game);
//  - flood control: at most one message every 1.5 s, at most 8 in 20 s, the same text twice in a row is dropped;
//  - mutes and permanent bans by the owner; reports from players are kept for the owner to read.
'use strict';

// roots are matched inside words after normalising (lower case, look-alike letters folded, separators removed)
const ROOTS = [
  // English
  'fuck', 'shit', 'bitch', 'cunt', 'pussy', 'whore', 'slut', 'nigg', 'retard', 'asshole', 'bastard', 'porn',
  // Ukrainian / Russian (Cyrillic, after folding)
  'хуй', 'хуе', 'хуя', 'хуї', 'пизд', 'пізд', 'ебат', 'ебал', 'ебан', 'еба', 'їба', 'йоба', 'бляд', 'блят', 'сука', 'суки', 'мудак', 'мудил', 'гандон', 'залуп', 'шлюх', 'пидор', 'підор', 'пидар', 'дроч', 'срак', 'жопа', 'курв', 'секс', 'порн',
  // German, Spanish, Portuguese, French, Italian, Polish, Turkish (most common)
  'scheiß', 'scheiss', 'fotze', 'hurensohn', 'puta', 'mierda', 'coño', 'cabron', 'caralho', 'porra', 'merde', 'putain', 'salope', 'connard', 'cazzo', 'stronzo', 'vaffanculo',
  'kurwa', 'chuj', 'pierdol', 'jebać', 'jebac', 'siktir', 'orospu', 'amına', 'amina'
];
// short roots that are only bad as whole words
const WORDS = new Set(['ass', 'cum', 'fck', 'wtf', 'stfu', 'sex', 'sexy', 'nude', 'nudes', 'rape', 'dick', 'dicks', 'fag', 'fags', 'бля', 'хер', 'хрен', 'нах', 'пох', 'еб']);
// Latin look-alikes -> Cyrillic when the word is mostly Cyrillic, and digits/symbols -> letters
const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '@': 'a', '$': 's', '!': 'i', '|': 'i' };
const LAT2CYR = { a: 'а', e: 'е', o: 'о', p: 'р', c: 'с', x: 'х', y: 'у', k: 'к', m: 'м', t: 'т', h: 'н', b: 'в', i: 'і' };
const CYR2LAT = Object.fromEntries(Object.entries(LAT2CYR).map(([l, c]) => [c, l]));

function fold(word) {
  let w = word.toLowerCase().normalize('NFKC');
  w = w.replace(/[013457@$!|]/g, ch => LEET[ch] || ch).replace(/ё/g, 'е');
  const cyr = (w.match(/[Ѐ-ӿ]/g) || []).length, lat = (w.match(/[a-z]/g) || []).length;
  if (cyr && lat) w = cyr >= lat ? w.replace(/[a-z]/g, ch => LAT2CYR[ch] || ch) : w.replace(/[Ѐ-ӿ]/g, ch => CYR2LAT[ch] || ch);
  return w.replace(/(.)\1{2,}/g, '$1$1');
}
const bad = w => { const f = fold(w); if (WORDS.has(f)) return true; for (const r of ROOTS) if (f.includes(r)) return true; return false; };

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|ru|ua|io|gg|me|tk|xyz|link|ly|to|co|tv|app|site|online|info|biz)\b|discord|t\.me|telegram|whatsapp|viber|instagram|tiktok|snapchat|vk\.com|@[a-z0-9_]{3,})/i;
const EMAIL = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const PHONE = /(\+?\d[\d\s().-]{7,}\d)/;

// returns { text, hidden } — text with bad parts replaced by stars
function clean(text) {
  let t = String(text || '').replace(/[\u0000-\u001f\u007f\u200b-\u200f\u2028-\u202e\u2060-\u206f]/g, '').trim().slice(0, 200);
  let hidden = false;
  if (EMAIL.test(t)) { t = t.replace(new RegExp(EMAIL.source, 'g'), '***'); hidden = true; }
  if (PHONE.test(t)) { t = t.replace(new RegExp(PHONE.source, 'g'), '***'); hidden = true; }
  if (LINK.test(t)) { t = t.replace(new RegExp('\\S*(' + LINK.source + ')\\S*', 'gi'), '***'); hidden = true; }
  // words, and the same word spelt with spaces or dots between letters ("f u c k")
  t = t.replace(/(?:\b\w(?:[\s._*-]\w){2,}\b)/gu, m => bad(m.replace(/[\s._*-]/g, '')) ? (hidden = true, '***') : m);
  t = t.replace(/[\p{L}\p{N}@$!|]+/gu, w => bad(w) ? (hidden = true, '*'.repeat(Math.min(6, w.length))) : w);
  return { text: t, hidden };
}

// per-player flood control
function makeLimiter() {
  const times = [];
  let lastText = '';
  return function allow(text, now) {
    while (times.length && now - times[0] > 20000) times.shift();
    if (times.length && now - times[times.length - 1] < 1500) return 'slow';
    if (times.length >= 8) return 'slow';
    if (text === lastText) return 'repeat';
    times.push(now); lastText = text; return null;
  };
}
module.exports = { clean, makeLimiter, bad };
