// What a manifest may declare beyond contributions, checked as Kav checks it: its pages and settings (ext/Pages.kt,
// PageSpecs) and its theme (ext/Looks.kt). Each function throws a TrustError with Kav's reason, with a few more words
// where Kav's own are too short to act on.
import { PAGES, THEME } from './format.js';
import { numberOf, TrustError } from './strictjson.js';

const no = (why) => { throw new TrustError(why); };
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v) && numberOf(v) === undefined;
const objectsOf = (a) => (Array.isArray(a) ? a.filter(isObject) : []);

// Its words in English and Hebrew; another language is ignored. English is needed.
function words(o, what) {
  const en = isObject(o) ? o.en : undefined;
  if (typeof en !== 'string' || en === '') no(`${what}: needs English words ({ "en": "...", "he": "..." })`);
  return { en, he: typeof o.he === 'string' ? o.he : '' };
}

function setting(o) {
  const key = o.key;
  if (typeof key !== 'string' || !PAGES.id.test(key)) no('setting: bad key');
  if (!['text', 'number', 'toggle', 'choice', 'place', 'stop', 'time', 'date', 'color'].includes(o.type)) no(`setting ${key}: unknown type`);
  const label = words(o.label, `setting ${key}`);
  const num = (k) => {
    const v = numberOf(o[k]);
    if (v === undefined || !Number.isFinite(v)) no(`setting ${key}: ${k} must be a number`);
    return v;
  };
  if (o.type === 'text') {
    const given = numberOf(o.maxLength);
    const maxLength = Math.min(100_000, Math.max(1, given === undefined ? 10_000 : Math.trunc(given)));
    const d = o.default === undefined || o.default === null ? '' : o.default;
    if (typeof d !== 'string' || d.length > maxLength) no(`setting ${key}: bad default`);
    return { key, type: 'text', label, default: d, maxLength };
  }
  if (o.type === 'number') {
    const min = num('min'), max = num('max'), d = num('default');
    if (min >= max || d < min || d > max) no(`setting ${key}: default must be within min and max`);
    const step = o.step === undefined ? 1 : num('step');
    if (step <= 0 || step > max - min) no(`setting ${key}: step must be above 0 and within the range`);
    const unit = o.unit === undefined || o.unit === null ? { en: '', he: '' } : words(o.unit, `setting ${key} unit`);
    if (unit.en.length > 16 || unit.he.length > 16) no(`setting ${key}: a unit is a word or two`);
    return { key, type: 'number', label, default: d, min, max, step, unit };
  }
  // Chosen with Kav's own pickers: a place or stop has no default (null until the rider picks one).
  if (o.type === 'place' || o.type === 'stop') {
    if (o.default !== undefined && o.default !== null) no(`setting ${key}: a ${o.type} has no default`);
    return { key, type: o.type, label, default: null };
  }
  if (o.type === 'time' || o.type === 'date' || o.type === 'color') {
    const d = o.default === undefined || o.default === null ? '' : o.default;
    if (typeof d !== 'string' || (d !== '' && validSetting({ type: o.type }, d) === undefined)) no(`setting ${key}: bad default`);
    return { key, type: o.type, label, default: d };
  }
  if (o.type === 'toggle') {
    const d = o.default === undefined || o.default === null ? false : o.default;
    if (typeof d !== 'boolean') no(`setting ${key}: bad default`);
    return { key, type: 'toggle', label, default: d };
  }
  if (!Array.isArray(o.options)) no(`setting ${key}: options missing`);
  const options = objectsOf(o.options).map((x) => {
    if (typeof x.value !== 'string' || !PAGES.id.test(x.value)) no(`setting ${key}: bad option`);
    return { value: x.value, label: words(x.label, `setting ${key} option`) };
  });
  if (options.length === 0 || new Set(options.map((x) => x.value)).size !== options.length) no(`setting ${key}: different options`);
  const d = o.default === undefined || o.default === null ? options[0].value : o.default;
  if (typeof d !== 'string' || !options.some((x) => x.value === d)) no(`setting ${key}: default isn't an option`);
  return { key, type: 'choice', label, default: d, options };
}

// Pages.kt, PageSpecs.read: { provides (it declares page.provide), pages, home, settings }.
export function readScreens(m) {
  const provides = m.contributions.some((c) => c.capability === 'page.provide');
  const pa = m.json.pages;
  if (pa !== undefined && pa !== null && !Array.isArray(pa)) no('bad pages');
  const pages = objectsOf(pa).map((p) => {
    if (typeof p.id !== 'string' || !PAGES.id.test(p.id)) no('page: bad id');
    const tab = p.tab === undefined || p.tab === null ? false : p.tab;
    if (typeof tab !== 'boolean') no('page: tab is true or false');
    const entry = p.entry === undefined || p.entry === null ? true : p.entry;
    if (typeof entry !== 'boolean') no('page: entry is true or false');
    if (tab && !entry) no("a tab opens on its own, so it's an entry page");
    return { id: p.id, title: words(p.title, 'page title'), tab, entry };
  });
  if (Array.isArray(pa) && pages.length !== pa.length) no('bad pages');
  if (pages.length > PAGES.maxPages || new Set(pages.map((p) => p.id)).size !== pages.length) no('bad pages');
  if (!provides && pages.length > 0) no('pages without a page contribution (add a contribution with capability "page.provide")');
  if (provides && pages.length === 0) no('a page contribution without pages (list them under "pages")');
  const home = m.contributions.some((c) => c.capability === 'home.body');
  if (home && (!provides || !pages.some((p) => p.id === 'home'))) no('a Home body needs the page "home" (and a page.provide contribution)');
  const sa = m.json.settings;
  if (sa !== undefined && sa !== null && !Array.isArray(sa)) no('bad settings');
  const settings = objectsOf(sa).map(setting);
  if (Array.isArray(sa) && settings.length !== sa.length) no('bad settings');
  if (new Set(settings.map((s) => s.key)).size !== settings.length) no('bad settings');
  return { provides, pages, home, settings };
}

// The value as Kav keeps it, or undefined when it isn't one this setting takes (Pages.kt, ExtSettings.valid).
export function validSetting(s, v) {
  if (s.type === 'text') return typeof v === 'string' && v.length <= s.maxLength ? v : undefined;
  if (s.type === 'number') { const n = numberOf(v); return n !== undefined && Number.isFinite(n) && n >= s.min && n <= s.max ? n : undefined; }
  if (s.type === 'toggle') return typeof v === 'boolean' ? v : undefined;
  if (s.type === 'place' || s.type === 'stop') {
    if (v === null) return null;
    if (!isObject(v)) return undefined;
    const lat = numberOf(v.lat), lon = numberOf(v.lon);
    if (!(Number.isFinite(lat) && lat >= -90 && lat <= 90 && Number.isFinite(lon) && lon >= -180 && lon <= 180)) return undefined;
    const out = { name: typeof v.name === 'string' ? v.name.slice(0, 200) : '', lat, lon };
    if (s.type === 'stop') { if (typeof v.code !== 'string' || !/^[0-9]{1,8}$/.test(v.code)) return undefined; out.code = v.code; }
    return out;
  }
  if (s.type === 'time') return typeof v === 'string' && (v === '' || /^([01][0-9]|2[0-3]):[0-5][0-9]$/.test(v)) ? v : undefined;
  if (s.type === 'date') return typeof v === 'string' && (v === '' || /^[0-9]{4}-(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$/.test(v)) ? v : undefined;
  if (s.type === 'color') return typeof v === 'string' && (v === '' || /^#[0-9A-Fa-f]{6}$/.test(v)) ? v.toUpperCase() : undefined;
  return typeof v === 'string' && s.options.some((x) => x.value === v) ? v : undefined;
}

// Every declared setting with the rider's value, or its default where the value is missing or not valid.
export function settingsOf(screens, values = {}) {
  const out = {};
  for (const s of screens.settings) out[s.key] = validSetting(s, values[s.key]) ?? s.default;
  return out;
}

// ---- Themes (Looks.kt) ---------------------------------------------------------------------------------------

// "#RRGGBB" or "#AARRGGBB" as ARGB, or null.
const parseColour = (s) => {
  if (!s.startsWith('#') || (s.length !== 7 && s.length !== 9) || !/^[+-]?[0-9a-fA-F]+$/.test(s.slice(1))) return null;
  const n = parseInt(s.slice(1), 16);
  return s.length === 7 ? (0xff000000 | n) >>> 0 : n >>> 0;
};
const ch = (c, s) => (c >>> s) & 0xff;
// WCAG relative luminance and contrast ratio: the kit's readability warning (Kav itself refuses nothing for it).
function luminance(c) {
  const lin = (v) => { const s = v / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * lin(ch(c, 16)) + 0.7152 * lin(ch(c, 8)) + 0.0722 * lin(ch(c, 0));
}
export function contrast(a, b) {
  const x = luminance(a), y = luminance(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

// The package's theme, or null when it declares none or nothing Kav can use: { looks: { dark: { role: '#AARRGGBB' } } }.
// Any of the roles, any subset, for any of the looks; a value that isn't a colour, a role or a look Kav doesn't know is
// left out. Kav refuses only a theme contribution whose "theme" isn't an object.
export function readTheme(m) {
  if (!m.contributions.some((c) => c.capability === 'theme')) return null;
  const t = m.json.theme;
  if (!isObject(t)) no('a theme contribution without its theme');
  const looks = {};
  for (const look of THEME.looks) {
    const o = isObject(t.looks) ? t.looks[look] : undefined;
    if (!isObject(o)) continue;
    const values = {};
    for (const r of THEME.roles) {
      const c = typeof o[r] === 'string' ? parseColour(o[r]) : null;
      if (c !== null) values[r] = `#${c.toString(16).toUpperCase().padStart(8, '0')}`;
    }
    if (Object.keys(values).length) looks[look] = values;
  }
  return Object.keys(looks).length ? { looks } : null;
}
