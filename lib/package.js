// An extension and a bundle, as Kav's ext/Package.kt and ext/Bundle.kt read them. A bundle (.kavb) is a zip of
// bundle.json ({"format": 1, "name": "...", "icon": "icon.png"}), the source's picture when it names one, and one
// folder per extension, named as its manifest names it, holding
// its manifest.json, its dex and its own files. Every extension is Android code (Native.kt): one without, a JavaScript
// one or one with no code, was made for an older Kav, and Kav lists it but never runs it.
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { ARCHIVE, BUNDLE, CAPABILITIES, CHANGES, EXPLANATIONS, KINDS, LINE_KEYS, NATIVE, PACKAGE, SEARCHING, SLOTS, cleanName } from './format.js';
import { contrast, readScreens, readTheme } from './screens.js';
import { int, object, objects, str, strictObject, strings, TrustError } from './strictjson.js';
import { BadArchive, readZip, safePath, writeZip } from './zip.js';

export const sha256hex = (b) => crypto.createHash('sha256').update(b).digest('hex');

// Package.kt, Manifest.OLDER: Kav's words for an extension without Android code.
export const OLDER = 'made for an older version of Kav';

// Android code only (Manifest.older): a JavaScript manifest, or one with no "native" at all.
export const isOlder = (json) => Object.hasOwn(json, 'runtime') || !Object.hasOwn(json, 'native');

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

// A manifest read and checked as Kav checks it (Package.kt, Manifest.check). Throws TrustError.
export function readManifest(bytes) {
  const json = strictObject(bytes, PACKAGE.maxManifest);
  const w = 'manifest.json';
  const name = str(json, 'name', w);
  const m = {
    json,
    name,
    // Cleaned, as Kav prints it in its own screens; any script, emoji included.
    displayName: cleanName(str(json, 'displayName', w)) || name,
    version: str(json, 'version', w),
    release: int(json, 'release', w, -1),
    minKav: int(json, 'minKav', w, 0),
    api: int(json, 'api', w, 1),
    description: str(json, 'description', w),
    permissions: [...strings(json, 'permissions', w)].sort(),
    // What it adds that Kav can't see in its code; another word is ignored.
    adds: [...new Set(strings(json, 'adds', w).filter((a) => PACKAGE.adds.includes(a)))],
    issues: str(json, 'issues', w),
    homepage: str(json, 'homepage', w),
    icon: str(json, 'icon', w),
    // A contribution's old "domain" is ignored.
    contributions: objects(json, 'contributions', w).map((c) => ({
      id: str(c, 'id', w), capability: str(c, 'capability', w), permissions: [...strings(c, 'permissions', w)].sort(),
    })),
    tags: {},
    explanations: {},
    // Its own Android code (Native.kt): { dex, entry }, or null.
    native: null,
  };
  const tags = object(json, 'tags', w) ?? {};
  for (const [k, v] of Object.entries(tags)) if (isObject(v)) m.tags[k] = { en: str(v, 'en', w), he: str(v, 'he', w) };

  // The publisher's reasons for the lines Kav shows: { "<line key>": { "en": "...", "he": "..." } }. "reasons" in api
  // 2; "explanations", its old name, is still read.
  const notes = json.reasons ?? json.explanations;
  if (notes !== undefined && notes !== null) {
    if (!isObject(notes) || Object.values(notes).some((v) => !isObject(v))) throw new TrustError('bad reasons');
    for (const [k, v] of Object.entries(notes)) m.explanations[k] = { en: str(v, 'en', w), he: str(v, 'he', w) };
  }

  if (json.format !== 1) throw new TrustError('unknown package format');
  if (isOlder(json)) throw new TrustError(`${OLDER}: Kav runs Android code only (Kotlin or Java), with "native" in the manifest (docs/native.md)`);
  if (!PACKAGE.name.test(m.name)) throw new TrustError('bad package name');
  if (m.version.trim() === '' || m.version.length > PACKAGE.maxVersion) throw new TrustError('bad version');
  if (m.release < 1) throw new TrustError('bad release number');
  if (m.contributions.some((c) => !PACKAGE.contribution.test(c.id)) || new Set(m.contributions.map((c) => c.id)).size !== m.contributions.length)
    throw new TrustError('bad contribution ids');
  // A capability or API this Kav doesn't know installs and does nothing (minKav says what it needs).
  if (m.permissions.some((x) => !PACKAGE.contribution.test(x)) || m.contributions.some((c) => !PACKAGE.contribution.test(c.capability) || c.permissions.some((x) => !PACKAGE.contribution.test(x))))
    throw new TrustError('bad permission or capability name');
  if (m.description.length > PACKAGE.maxDescription) throw new TrustError('text too long');
  for (const u of [m.issues, m.homepage]) if (u !== '' && !u.startsWith('https://')) throw new TrustError('bad link');
  if (Object.values(m.explanations).some((v) => v.en.length > EXPLANATIONS.maxText || v.he.length > EXPLANATIONS.maxText))
    throw new TrustError(`bad reasons (each at most ${EXPLANATIONS.maxText} characters)`);
  const tagList = Object.entries(m.tags);
  if (tagList.length > PACKAGE.maxTags || tagList.some(([k, v]) => !PACKAGE.contribution.test(k) || v.en.trim() === '' || v.en.length > PACKAGE.maxTagWords || v.he.length > PACKAGE.maxTagWords))
    throw new TrustError('bad tags');
  if (Object.hasOwn(json, 'native')) {
    const n = json.native;
    if (!isObject(n)) throw new TrustError('bad native');
    m.native = { dex: typeof n.dex === 'string' ? n.dex : '', entry: typeof n.entry === 'string' ? n.entry : '' };
    if (!NATIVE.entry.test(m.native.entry)) throw new TrustError('native: bad entry class (a full class name, like "org.example.hello.Hello")');
  }
  // Its pages and settings, and its theme (lib/screens.js).
  m.screens = readScreens(m);
  m.theme = readTheme(m);
  return m;
}

// The lines Kav shows a rider about an extension, from its manifest alone (ExtUses.kt, of). Each line has the key a
// publisher's reason names it by, what it is, its detail (the kind, what it adds, what it changes, the permissions) and
// the publisher's reason, if any. Kav words the lines itself.
export function riderLines(m) {
  const caps = new Set(m.contributions.map((c) => c.capability));
  const line = (key, what, detail = []) => ({ key, what, detail, note: m.explanations[key] ?? null });
  const out = [];
  for (const c of KINDS) if (caps.has(c)) out.push(line(c, 'kind', [c]));
  if (caps.has('page.provide')) out.push(line('page.provide', 'screens'));
  if (m.screens.pages.some((p) => p.tab)) out.push(line('tab', 'tab'));
  if (caps.has('home.body')) out.push(line('home.body', 'home'));
  if (caps.has('theme')) out.push(line('theme', 'look'));
  // What it says it adds that Kav can't see in its code.
  for (const a of m.adds) out.push(line(a, 'adds', [a]));
  // Its cards on Kav's own screens, on once it's switched on.
  for (const [key, k] of Object.entries(SLOTS)) if (caps.has(k.capability)) out.push(line(k.capability, `slot-${key}`));
  if (SEARCHING.some((c) => caps.has(c))) out.push(line('searches', 'sees-searches'));
  const changes = CHANGES.filter((c) => caps.has(c));
  if (changes.length) out.push(line('results', 'changes-results', changes));
  // One with settings keeps the rider's values.
  if (m.screens.settings.length > 0) out.push(line('data', 'keeps-data'));
  // Its own Android code, inside Kav, with full access.
  if (m.native) out.push(line('native', 'native'));
  const permissions = [...new Set([...m.permissions, ...m.contributions.flatMap((c) => c.permissions)])];
  if (permissions.length) out.push(line('permissions', 'permissions', permissions));
  return out;
}

// Every field Kav reads from a manifest (Package.kt, Manifest; Pages.kt; Looks.kt; Native.kt).
const MANIFEST_FIELDS = ['format', 'name', 'displayName', 'version', 'release', 'minKav', 'api', 'description',
  'permissions', 'adds', 'issues', 'homepage', 'icon', 'contributions', 'tags', 'reasons', 'explanations',
  'pages', 'settings', 'theme', 'native'];

// Text that reads well on a ground: 4.5:1 for text, 3:1 for the live, problem and critical colours (WCAG).
const READABLE = [['text', 4.5], ['textSecondary', 4.5], ['realtime', 3], ['problem', 3], ['critical', 3]];

// What Kav would accept but an author almost certainly did not mean. Not refusals: Kav installs these.
export function manifestWarnings(m) {
  const out = [];
  // Kav reads the fields it knows and ignores the rest, so a misspelled one is silently lost.
  for (const k of Object.keys(m.json)) {
    if (MANIFEST_FIELDS.includes(k)) continue;
    const near = MANIFEST_FIELDS.find((f) => f.toLowerCase() === k.toLowerCase() || f.toLowerCase() === `${k.toLowerCase()}s` || `${f.toLowerCase()}s` === k.toLowerCase());
    out.push(`unknown manifest field "${k}": Kav accepts the package and ignores the field, so whatever it holds is lost. ${near ? `Did you mean "${near}"?` : `Remove it, or check its spelling against docs/format.md`}`);
  }
  if (Object.hasOwn(m.json, 'explanations') && !Object.hasOwn(m.json, 'reasons')) out.push('"explanations" is the old name of "reasons": Kav still reads it, but write "reasons"');
  for (const c of m.json.contributions ?? []) if (isObject(c) && Object.hasOwn(c, 'domain')) { out.push('a contribution\'s "domain" is ignored since Kav 5: every part of an extension has every power its manifest declares. Remove "domain"'); break; }
  for (const c of m.contributions) if (!CAPABILITIES.includes(c.capability)) out.push(`contribution "${c.id}": "${c.capability}" is not a capability this Kav runs, so it installs and does nothing. The capabilities are ${CAPABILITIES.join(', ')}`);
  const shown = new Set(riderLines(m).map((l) => l.key));
  for (const k of Object.keys(m.explanations)) {
    if (!LINE_KEYS.includes(k)) out.push(`reason "${k}": Kav has no line with that key, so it is never shown. The keys are ${LINE_KEYS.join(', ')}`);
    else if (!shown.has(k)) out.push(`reason "${k}": this extension has no such line, so Kav never shows it`);
  }
  if (m.native && m.native.dex === '') out.push('"native" names no "dex": Kav refuses it ("dex": "classes.dex", which kavx bundle writes)');
  // A theme's readability is the maker's to check: Kav refuses nothing for it. The kit checks what it can see.
  for (const [look, colours] of Object.entries(m.theme?.looks ?? {})) {
    const c = (r) => (colours[r] ? parseInt(colours[r].slice(1), 16) >>> 0 : null);
    for (const g of ['bg', 'surface', 'surfaceRaised']) {
      if (c(g) === null) continue;
      for (const [r, min] of READABLE) if (c(r) !== null && contrast(c(r), c(g)) < min) out.push(`theme ${look}: ${r} on ${g} is ${contrast(c(r), c(g)).toFixed(2)}:1, below ${min}:1, so it may be hard to read`);
    }
  }
  if (m.issues === '') out.push('no "issues" link: riders are sent to the source\'s GitHub issues, and get no link at all for a bundle added from a file');
  return out;
}

// One extension's files checked as Kav checks them before anything is written (Package.kt, Packages.check): its
// manifest's rules, its icon, and compiled Android code only as the native code its manifest declares.
export function checkExtension(files) {
  const bytes = files.get(PACKAGE.manifest);
  if (!bytes) throw new TrustError('no manifest.json');
  const m = readManifest(bytes);
  if (m.icon !== '' && (!files.has(m.icon) || !PACKAGE.icon.test(m.icon.toLowerCase()))) throw new TrustError("its icon isn't a picture in it");
  if (m.native && (!safePath(m.native.dex) || !m.native.dex.endsWith('.dex') || !files.has(m.native.dex))) throw new TrustError("native: its dex isn't in it");
  const dex = [...files.keys()].find((n) => n.toLowerCase().endsWith('.dex') && n !== m.native?.dex);
  if (dex !== undefined) throw new TrustError(`it can't bring code it doesn't declare: ${dex}`);
  return m;
}

// The files of an extension's folder: manifest.json first, the rest by name. Files and folders whose names start with
// a dot are left out. Throws for anything a bundle can't hold.
export function readFolder(dir) {
  const found = [];
  const walk = (rel) => {
    for (const e of fs.readdirSync(path.join(dir, rel), { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.name.startsWith('.')) continue;
      const p = rel ? `${rel}/${e.name}` : e.name;
      if (e.isSymbolicLink()) throw new TrustError(`link: ${p} (a bundle can't hold links)`);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) found.push(p);
    }
  };
  walk('');
  if (!found.includes(PACKAGE.manifest)) throw new TrustError(`no manifest.json in ${dir}`);
  const order = [PACKAGE.manifest, ...found.filter((n) => n !== PACKAGE.manifest)];
  const files = new Map();
  const folded = new Set();
  for (const n of order) {
    if (!safePath(n)) throw new TrustError(`unsafe path: ${n} (use ASCII letters, digits, ".", "_" and "-" only, at most ${ARCHIVE.maxDepth} folders deep)`);
    if (folded.has(n.toLowerCase())) throw new TrustError(`two files named ${n} when capitals are ignored`);
    folded.add(n.toLowerCase());
    if (ARCHIVE.nested.some((x) => n.toLowerCase().endsWith(x))) throw new TrustError(`nested archive or code: ${n}`);
    const bytes = fs.readFileSync(path.join(dir, n));
    if (bytes.length > ARCHIVE.maxFile) throw new TrustError(`file too large: ${n}`);
    files.set(n, bytes);
  }
  return files;
}

// A bundle as Kav reads it (Bundle.kt, read): the archive's rules, bundle.json, nothing at the top but it, and each
// folder an extension named as its manifest names it, checked; one without Android code kept, marked older. Returns
// { name, sha256, size, extensions: [{ name, manifest, files, older }] }, or throws TrustError.
export function readBundle(archive) {
  let files;
  try { files = readZip(archive); } catch (e) {
    if (e instanceof BadArchive) throw new TrustError(e.message);
    throw e;
  }
  const headBytes = files.get(BUNDLE.file);
  const head = headBytes ? strictObject(headBytes, 16 << 10) : {};
  if (Object.hasOwn(head, 'format') && head.format !== 1) throw new TrustError('unknown bundle format');
  const iconName = typeof head.icon === 'string' ? head.icon : '';
  const loose = [...files.keys()].find((n) => !n.includes('/') && n !== BUNDLE.file && n !== iconName);
  if (loose !== undefined) throw new TrustError(`a file outside the extensions' folders: ${loose}`);
  let icon = null;
  if (iconName !== '') {
    icon = files.get(iconName);
    if (!icon) throw new TrustError("its icon isn't in it");
    if (!pictureSize(icon)) throw new TrustError(`its icon isn't a PNG or JPEG of at most ${BUNDLE.iconMaxBytes >> 10} KB and ${BUNDLE.iconMaxSide} by ${BUNDLE.iconMaxSide} pixels`);
  }
  const byFolder = new Map();
  for (const [n, b] of files) {
    if (!n.includes('/')) continue;
    const folder = n.slice(0, n.indexOf('/'));
    if (!byFolder.has(folder)) byFolder.set(folder, new Map());
    byFolder.get(folder).set(n.slice(folder.length + 1), b);
  }
  if (byFolder.size === 0) throw new TrustError('no extensions in it');
  if (byFolder.size > BUNDLE.most) throw new TrustError(`more than ${BUNDLE.most} extensions`);
  const extensions = [...byFolder.keys()].sort().map((folder) => {
    const own = byFolder.get(folder);
    const bytes = own.get(PACKAGE.manifest);
    if (!bytes) throw new TrustError(`${folder}: no manifest.json`);
    const json = strictObject(bytes, PACKAGE.maxManifest);
    if (json.name !== folder) throw new TrustError(`${folder}: its folder isn't named as its manifest names it`);
    if (!PACKAGE.name.test(folder)) throw new TrustError(`${folder}: bad name`);
    if (isOlder(json)) return { name: folder, manifest: null, json, files: own, older: true };
    return { name: folder, manifest: checkExtension(own), json, files: own, older: false };
  });
  return { name: cleanName(typeof head.name === 'string' ? head.name : ''), sha256: sha256hex(archive), size: archive.length, extensions, icon };
}

// SourceImages.size: a PNG's or a JPEG's width and height from its header, when within the limits; null otherwise.
function pictureSize(b) {
  if (b.length > BUNDLE.iconMaxBytes) return null;
  let wh = null;
  if (b.length >= 24 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) && b.toString('latin1', 12, 16) === 'IHDR') wh = [b.readUInt32BE(16), b.readUInt32BE(20)];
  else if (b.length >= 4 && b[0] === 0xff && b[1] === 0xd8) {
    for (let i = 2; i + 9 < b.length;) {
      if (b[i] !== 0xff) break;
      const marker = b[i + 1], len = b.readUInt16BE(i + 2);
      if (marker >= 0xc0 && marker <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marker)) { wh = [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)]; break; }
      if (len < 2) break;
      i += 2 + len;
    }
  }
  return wh && wh.every((v) => v >= 1 && v <= BUNDLE.iconMaxSide) ? wh : null;
}

// A bundle from extensions' files (each a Map, as readFolder gives it), named name, with the source's picture (icon,
// the bytes of a PNG or JPEG) or none. Read back as Kav would before it is returned; an extension without Android code
// is refused here.
export function bundle(extensions, name = '', icon = null) {
  const head = { format: 1, ...(name ? { name } : {}), ...(icon ? { icon: 'icon.png' } : {}) };
  const all = new Map([[BUNDLE.file, Buffer.from(JSON.stringify(head))]]);
  if (icon) all.set('icon.png', icon);
  const names = new Set();
  for (const files of extensions) {
    const m = checkExtension(files);
    if (names.has(m.name)) throw new TrustError(`two extensions named ${m.name}`);
    names.add(m.name);
    for (const [n, b] of files) all.set(`${m.name}/${n}`, b);
  }
  const archive = writeZip(all);
  if (archive.length > ARCHIVE.maxArchive) throw new TrustError('bundle too large');
  return { archive, ...readBundle(archive) };
}
