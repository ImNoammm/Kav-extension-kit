// Everything the kit knows about Kav's extension formats, in one place.
//
// Each value is copied from Kav 5's code, from the file named next to it, under android/app/src/main/java/uk/noammm/kav/
// ext/. When Kav changes a rule, this is the file to change.

// Signing.kt, StrictJson.
export const JSON_MAX_DEPTH = 32;
// Archive.kt. Plumbing, not rules: what one phone can sensibly hold.
export const ARCHIVE = {
  maxArchive: 64 << 20,
  maxExpanded: 256 << 20,
  maxFile: 64 << 20,
  maxEntries: 4096,
  // A file over ratioFrom bytes may not be more than `ratio` times its compressed size.
  ratio: 100,
  ratioFrom: 1 << 20,
  maxDepth: 16,
  maxPath: 255,
  part: /^[A-Za-z0-9._-]{1,96}$/,
  // A .zip inside a bundle is fine. A .dex is allowed in the archive and refused by the extension's check unless it is
  // the one its manifest's "native" names (Package.kt, Native.kt).
  nested: ['.kavb', '.jar', '.apk', '.so', '.aab'],
};

// Bundle.kt: a bundle (.kavb) holds bundle.json and one folder per extension, at most this many.
// Its icon, the source's picture (SourceImages.kt): a PNG or JPEG within these.
export const BUNDLE = { file: 'bundle.json', suffix: '.kavb', most: 64, iconMaxBytes: 256 << 10, iconMaxSide: 1024 };

// Package.kt.
export const PACKAGE = {
  manifest: 'manifest.json',
  maxManifest: 64 << 10,
  name: /^[a-z0-9][a-z0-9._-]{0,63}$/,
  contribution: /^[a-z0-9][a-z0-9._-]{0,63}$/,
  // Manifest.adds: what an extension adds that Kav can't see in its code.
  adds: ['map', 'notifications', 'location', 'settings'],
  maxVersion: 32,
  maxDisplayName: 64,
  maxDescription: 2000,
  maxTags: 32,
  maxTagWords: 40,
  // An icon: a picture in the package.
  icon: /^.+\.(png|jpg|jpeg|webp)$/s,
};

// Native.kt: a package's own Android code. "native": { "dex": "classes.dex", "entry": "org.example.Entry" }.
export const NATIVE = {
  entry: /^[A-Za-z_$][A-Za-z0-9_$]*(\.[A-Za-z_$][A-Za-z0-9_$]*)+$/,
  // NativeGuard: crashes within the window that switch it off at Kav's next start.
  crashes: 2,
  windowMs: 5 * 60_000,
  // Kav.java, API: the native API's level.
  api: 5,
};

// Pipeline.kt, HOOKS: the five route rules.
export const HOOKS = ['walk.time', 'transfer.policy', 'results.filter', 'results.rank', 'results.annotate'];
// Slots.kt, Kind: the four places on Kav's own screens an extension may put a piece in.
export const SLOTS = {
  home: { capability: 'slot.home' },
  results: { capability: 'slot.results' },
  trip: { capability: 'slot.trip' },
  stop: { capability: 'slot.stop' },
};
// API 4. Actions.kt, NAMES: the actions an extension may take over ("action.<name>"); Parts.kt, NAMES: the parts of
// Kav's screens it may add to or replace ("part.<name>"); MethodHooks.kt: hooks on Kav's own code ("hooks").
export const ACTIONS = ['pay', 'ticket.open', 'stop.open', 'line.open', 'trip.open', 'trip.start', 'trip.end', 'share', 'plan',
  'report', 'alert.open', 'taxi', 'street.open', 'place.save', 'stop.save', 'line.save', 'settings.open', 'tab.open',
  'settings.page.open', 'pay.history.open', 'plan.stop', 'live.show',
  'search.open', 'results.place.pick', 'results.endpoints.swap', 'results.stop.remove',
  'results.stop.stay', 'results.time.select', 'results.order.select', 'results.planner.select',
  'trip.track', 'nav.step', 'nav.board.select', 'nav.replan', 'nav.replan.keep', 'nav.plan', 'nav.exit', 'share.send',
  'pay.mode', 'pay.offer.hide', 'pay.place.open', 'pay.history.clear', 'ticket.ravpass.open',
  'live.vehicle.open', 'live.stop.open', 'stop.alerts.open', 'line.alerts.save', 'line.getoff', 'report.send', 'place.pick',
  'link.open'];
export const PARTS = ['home.places', 'home.journey', 'home.suggestions', 'home.latest', 'home.pay', 'home.recent',
  'trip.header', 'trip.map', 'trip.summary', 'trip.timeline', 'trip.ride', 'trip.walk', 'results.route',
  'stop.header', 'stop.board', 'line.header', 'settings.root', 'tabbar',
  'settings.page.header', 'stops.header', 'stops.search', 'lines.header', 'lines.search', 'lines.filters',
  'live.header', 'live.filters', 'results.endpoints', 'results.options', 'results.time.shift', 'results.planners',
  'ticket.header', 'ticket.validity', 'ticket.ride',
  'pay.history.header', 'pay.history.summary', 'pay.history.empty', 'pay.history.month', 'pay.history.ride',
  'nav.header', 'nav.problem', 'nav.card', 'share.targets', 'ticket.codes', 'pay.setup',
  'nav.wait.details', 'nav.ride.details', 'nav.banner', 'ride.pay',
  'stops.row', 'stop.departure', 'stop.alerts', 'lines.row', 'line.live', 'line.map', 'line.stop',
  'live.list', 'live.vehicle', 'live.stop', 'home.nearest', 'results.empty', 'results.hidden', 'alert.sheet',
  'report.step', 'search.result',
  ...['trips', 'paying', 'live', 'look', 'language', 'map', 'privacy', 'extensions', 'kav'].map((page) => `settings.page.${page}`)];
export const API4 = [...ACTIONS.map((a) => `action.${a}`), ...PARTS.map((p) => `part.${p}`), 'hooks'];
// Contracts.kt, Capabilities.KNOWN: every capability this Kav runs. A capability not here installs and does nothing.
export const CAPABILITIES = ['plan.provide', 'board.provide', 'stop.photo', 'trip.notification', 'trips.history', 'trips.follow', 'widget.provide', 'page.provide', 'home.body', 'theme', ...HOOKS, ...Object.values(SLOTS).map((k) => k.capability),
  ...API4];

// ExtUses.kt: the lines Kav shows a rider about an extension, worked out from its signed manifest alone. KINDS are
// the capabilities that get a line of their own, in the order shown; CHANGES the ones that change a search's
// results. LINE_KEYS is every key a publisher's reason can name.
export const KINDS = ['plan.provide', 'board.provide', 'stop.photo', 'trip.notification', 'trips.history', 'trips.follow', ...HOOKS];
// The kinds that are given the rider's trip searches: every one but a stop board, stop photos, the trip notification's
// buttons and the rider's trips (lines of their own).
export const SEARCHING = KINDS.filter((k) => !['board.provide', 'stop.photo', 'trip.notification', 'trips.history', 'trips.follow'].includes(k));
export const CHANGES = HOOKS;
export const LINE_KEYS = [...KINDS, 'searches', 'results', 'data', 'native', 'permissions', 'actions', 'parts', 'hooks',
  'page.provide', 'tab', 'home.body', 'theme', 'widget.provide', ...PACKAGE.adds, ...Object.values(SLOTS).map((k) => k.capability)];

// Pages.kt: PageSpecs.
export const PAGES = { maxPages: 64, id: /^[a-z0-9][a-z0-9._-]{0,39}$/ };
// Widgets.kt: home screen widgets ("widget.provide" and "widgets"), each at its best size; its content at most maxBytes,
// and Kav asks again at the soonest nextMinS after it, while the phone is awake.
export const WIDGETS = { capability: 'widget.provide', maxWidgets: 16, id: /^[a-z0-9][a-z0-9._-]{0,39}$/, sizes: ['small', 'wide'],
  maxBytes: 64 << 10, nextMinS: 300, askMs: 3000 };
// Looks.kt: the colour roles a theme may set (the accent among them), the looks it may list, the line badge styles and
// the corners it may set, each in dp within its range. Any subset; readability is the maker's.
export const THEME = {
  roles: ['bg', 'surface', 'surfaceRaised', 'fill', 'fillStrong', 'separator', 'text', 'textSecondary', 'textTertiary', 'surface2', 'surface3',
    'surface4', 'borderStrong', 'sunken', 'routeIdle', 'problem', 'critical', 'realtime', 'accent'],
  looks: ['dark', 'oled', 'light'],
  badges: ['kav', 'strip'],
  corners: { card: [0, 32], sheet: [0, 40], tile: [0, 24], badge: [0, 16] },
};
// Package.kt, Manifest.explanations ("reasons"): at most this many characters in each language.
export const EXPLANATIONS = { maxText: 140 };
// Package.kt, Names.clean: the names Kav prints in its own sentences (an extension's and a source's name, a secret's
// label) are plain text. Any script and any emoji is a name; nothing an extension draws itself is cleaned.
// The characters a printed name may not carry (Names.hidden): control and formatting characters (line breaks,
// direction controls, zero-width characters), private-use and unassigned code points, lone surrogates, and the Hangul
// fillers (U+115F, U+1160, U+3164, U+FFA0), letters that draw as nothing.
const HIDDEN = new RegExp(`[\\p{Cc}\\p{Cf}\\p{Zl}\\p{Zp}\\p{Co}\\p{Cn}\\p{Cs}${[0x115f, 0x1160, 0x3164, 0xffa0].map((c) => String.fromCodePoint(c)).join('')}]`, 'u');
const SPACE = /[\t\n\v\f\r\x1c-\x1f\p{Z}]/u;
// Double quotes of every kind: " and the curly, low, angle and full-width ones.
const QUOTES = [0x22, 0x201c, 0x201d, 0x201e, 0x201f, 0xab, 0xbb, 0xff02].map((c) => String.fromCodePoint(c)).join('');

const HEBREW_LETTER = /^(?=\p{L})\p{Script=Hebrew}$/u;

const isEmoji = (cp) => (cp >= 0x1f000 && cp <= 0x1faff) || (cp >= 0x2600 && cp <= 0x27bf) || (cp >= 0x2b00 && cp <= 0x2bff) || cp === 0x2640 || cp === 0x2642;
// The joiner at i has an emoji before it (past a variation selector or skin tone) and an emoji right after it.
function joinsEmoji(s, i) {
  let before = -1;
  for (let j = i; j > 0;) {
    const low = s.charCodeAt(j - 1);
    const pair = low >= 0xdc00 && low <= 0xdfff && j > 1 && s.charCodeAt(j - 2) >= 0xd800 && s.charCodeAt(j - 2) <= 0xdbff;
    const cp = pair ? s.codePointAt(j - 2) : low;
    j -= pair ? 2 : 1;
    if (cp === 0xfe0f || (cp >= 0x1f3fb && cp <= 0x1f3ff)) continue;
    before = cp; break;
  }
  const after = i + 1 < s.length ? s.codePointAt(i + 1) : -1;
  return isEmoji(before) && isEmoji(after);
}

// A name as Kav prints it: NFKC, every hidden character and every double quote removed (a zero-width joiner between
// two emoji kept, and a straight double quote between two Hebrew letters, which is how gershayim is typed), any run
// of spaces one space, at most `max` characters.
export function cleanName(s, max = PACKAGE.maxDisplayName) {
  const norm = s.normalize('NFKC');
  let t = '';
  for (let i = 0; i < norm.length;) {
    const c = String.fromCodePoint(norm.codePointAt(i));
    const at = i;
    i += c.length;
    if (SPACE.test(c)) { if (t !== '' && !t.endsWith(' ')) t += ' '; }
    else if (c === '"' && t !== '' && HEBREW_LETTER.test(t[t.length - 1]) && i < norm.length && HEBREW_LETTER.test(String.fromCodePoint(norm.codePointAt(i)))) t += c;
    else if (c === '\u200d' && joinsEmoji(norm, at)) t += c;
    else if (!HIDDEN.test(c) && !QUOTES.includes(c)) t += c;
  }
  t = t.trim().slice(0, max).trimEnd();
  const last = t.charCodeAt(t.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? t.slice(0, -1) : t;
}
