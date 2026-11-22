#!/usr/bin/env node
// kavx: the command line of the Kav extension developer kit. `kavx help` lists what it does.
import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { BUNDLE } from '../lib/format.js';
import { buildNative } from '../lib/native.js';
import { bundle, hookLine, hookable, hookableVersions, manifestWarnings, missingHooks, readBundle, riderLines } from '../lib/package.js';
import { TrustError } from '../lib/strictjson.js';

const HELP = `kavx, the Kav extension developer kit

  kavx check <folder>                    build one extension's folder (Kotlin or Java under src/, "native" in its
                                         manifest) and check it the way Kav does: see docs/native.md
                                         [--kav <versionCode>: the Kav its declared hooks are held against, by default
                                         the newest the kit knows]
  kavx bundle <folder>                   build every extension under <folder>/extensions/ (or <folder> itself, when it
                                         is one extension) into one bundle, the .kavb a GitHub Release carries
                                         [--out <file.kavb>] [--name <the source's name, as riders see it>]
                                         [--icon <the source's picture: a PNG or JPEG, at most 256 KB and 1024 px>]
  kavx verify <file.kavb>                read a bundle the way Kav does: its extensions and what each can do
  kavx link github <owner/repo>          the "Add to Kav" link for a source
  kavx hooks <file.kavb>                 the functions of Kav's its extensions declare they hook, as Kav's release
                                         gate lists them (android/hook/declared.txt)
`;

const OPTIONS = { out: { type: 'string' }, name: { type: 'string' }, icon: { type: 'string' }, kav: { type: 'string' }, help: { type: 'boolean', short: 'h' } };
// The options each command reads. Any other is refused, so a misplaced one is never silently ignored.
const TAKES = { check: ['kav'], bundle: ['out', 'name', 'icon'], verify: [], link: [], hooks: [] };
// The functions each Kav version's release build has, for declared hooks (tools/hookable.js).
const HOOKABLE = new URL('../api/hookable/', import.meta.url).pathname;

class Usage extends Error {}
const need = (v, what) => { if (v === undefined || v === '') throw new Usage(`missing ${what}`); return v; };
const say = (...a) => console.log(...a);

// An extension's folder built: its code compiled into the dex its manifest names, with its own files.
function build(folder) {
  if (!fs.existsSync(path.join(folder, 'manifest.json'))) throw new Usage(`no manifest.json in ${folder}`);
  return buildNative(folder, { log: (m) => say(`  build      ${m}`) });
}

// What Kav tells the rider, line by line. Kav words each line itself; these are the kit's descriptions.
const TOLD = {
  'kind': 'what it is', 'screens': 'has its own screens', 'tab': 'has a page you can pin as a tab', 'home': 'can replace the Home screen',
  'look': 'changes the colors', 'adds': 'adds', 'slot-home': 'can add a card to the Home screen', 'slot-results': 'can add a line to trip results',
  'slot-trip': "can add to a trip's page", 'slot-stop': 'can add to stop boards', 'sees-searches': 'sees trip searches',
  'changes-results': 'changes results', 'keeps-data': 'keeps its settings on the phone', 'native': 'runs its own Android code: full access',
  'permissions': 'asks for permissions', 'actions': 'takes over', 'parts': "changes parts of Kav's screens",
  'hooks': 'changes how Kav itself works',
};

function describe(m) {
  say(`  ${m.displayName} (${m.name}) ${m.version}, release ${m.release}`);
  for (const c of m.contributions) say(`  does       ${c.capability} as "${c.id}"`);
  if (m.native) say(`  native     ${m.native.entry}, from ${m.native.dex}`);
  for (const p of m.screens.pages) say(`  page       ${p.id}: ${p.title.en}${p.tab ? ' (can be pinned as a tab)' : ''}${p.entry ? '' : ' (opened from another page only)'}`);
  for (const s of m.screens.settings) say(`  setting    ${s.key} (${s.type}): ${s.label.en}, default ${JSON.stringify(s.default)}`);
  if (m.theme) say(`  theme      ${Object.entries(m.theme.looks).map(([k, v]) => `${k} (${Object.keys(v).length} colors)`).join(', ')}`);
  for (const l of riderLines(m)) {
    say(`  riders see ${TOLD[l.what]}${l.detail.length ? `: ${l.detail.join(', ')}` : ''}`);
    if (l.note) say(`             from the publisher: ${[l.note.en, l.note.he].filter(Boolean).join(' / ')}`);
  }
  for (const h of m.hooks) say(`  hooks      ${hookLine(h)}`);
  for (const w of manifestWarnings(m)) say(`  warning    ${w}`);
}

// Its declared hooks held against one Kav version: each one that Kav doesn't have is a warning, as Kav leaves it out.
function checkHooks(m, version) {
  if (m.hooks.length === 0) return;
  const known = hookableVersions(HOOKABLE);
  const v = version === undefined ? known.at(-1) : Number(version);
  if (v === undefined) { say('  warning    the kit has no list of Kav\'s functions, so its hooks were not checked'); return; }
  if (!known.includes(v)) throw new Usage(`the kit has no list for Kav ${version}; it has ${known.join(', ')}`);
  const missing = missingHooks(m, hookable(HOOKABLE, v));
  for (const h of missing) say(`  warning    Kav ${v} has no ${hookLine(h)}: Kav leaves this hook out and says your extension needs an update`);
  if (missing.length === 0) say(`  hooks      all ${m.hooks.length} in Kav ${v}`);
}

// The extensions' folders of a source: extensions/* when there is such a folder, else the folder itself.
function foldersOf(root) {
  const under = path.join(root, 'extensions');
  if (!fs.existsSync(under)) return [root];
  const found = fs.readdirSync(under, { withFileTypes: true }).filter((e) => e.isDirectory() && !e.name.startsWith('.'))
    .map((e) => path.join(under, e.name)).sort();
  if (found.length === 0) throw new Usage(`no extensions under ${under}`);
  return found;
}

const commands = {
  check([folder], o) {
    const files = build(need(folder, "the extension's folder"));
    const b = bundle([files]);
    describe(b.extensions[0].manifest);
    checkHooks(b.extensions[0].manifest, o.kav);
    say('ok: Kav would take it');
  },
  bundle([folder], o) {
    const root = need(folder, "the source's folder, or one extension's");
    const name = o.name ?? path.basename(path.resolve(root));
    const built = foldersOf(root).map((f) => { say(path.relative(process.cwd(), f) || f); return build(f); });
    const b = bundle(built, name, o.icon ? fs.readFileSync(o.icon) : null);
    const out = o.out ?? `${path.basename(path.resolve(root))}${BUNDLE.suffix}`;
    fs.mkdirSync(path.dirname(path.resolve(out)), { recursive: true });
    fs.writeFileSync(out, b.archive);
    say(`wrote ${out}: "${b.name}", ${b.extensions.length} extension${b.extensions.length === 1 ? '' : 's'}, ${b.size} bytes, sha256 ${b.sha256}`);
    for (const e of b.extensions) describe(e.manifest);
  },
  verify([file]) {
    const b = readBundle(fs.readFileSync(need(file, 'a bundle file')));
    say(`"${b.name || '(no name: Kav shows the repository\'s or the file\'s)'}", sha256 ${b.sha256}, ${b.size} bytes`);
    for (const e of b.extensions) {
      if (e.older) { say(`  ${e.name}: made for an older version of Kav (no Android code): Kav lists it and never runs it`); continue; }
      describe(e.manifest);
    }
    say('ok: Kav would read it');
  },
  hooks([file]) {
    const b = readBundle(fs.readFileSync(need(file, 'a bundle file')));
    for (const e of b.extensions) if (!e.older) for (const h of e.manifest.hooks) say(`${hookLine(h)}    # ${e.manifest.name}`);
  },
  link([kind, repo]) {
    if (need(kind, '"github"') !== 'github') throw new Usage('a source is a GitHub repository: kavx link github <owner/repo>');
    if (!/^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})\/[A-Za-z0-9._-]{1,100}$/.test(need(repo, 'the repository, as owner/repo'))) throw new Usage(`not a GitHub repository: ${repo}`);
    const q = `github=${encodeURIComponent(repo).replace('%2F', '/')}`;
    say(`https://kavapp.link/add-source?${q}`);
    say(`kav://add-source?${q}`);
    say('');
    say(`Markdown:  [Add to Kav](https://kavapp.link/add-source?${q})`);
  },
};

async function main(argv) {
  let parsed;
  try { parsed = parseArgs({ args: argv, options: OPTIONS, allowPositionals: true }); } catch (e) { throw new Usage(e.message); }
  const { values: o, positionals: [cmd, ...rest] } = parsed;
  if (!cmd || cmd === 'help' || o.help) { process.stdout.write(HELP); return; }
  if (!commands[cmd]) throw new Usage(`no command "${cmd}"`);
  const odd = Object.keys(o).filter((k) => !TAKES[cmd].includes(k));
  if (odd.length) throw new Usage(`"kavx ${cmd}" takes no --${odd.join(' or --')}${TAKES[cmd].length ? `. It takes: --${TAKES[cmd].join(', --')}` : ''}`);
  await commands[cmd](rest, o);
}

main(process.argv.slice(2)).catch((e) => {
  if (e instanceof Usage) console.error(`kavx: ${e.message}\nRun "kavx help" for the commands.`);
  else if (e instanceof TrustError) console.error(`REFUSED: ${e.message}`);
  else if (e.code === 'ENOENT') console.error(`kavx: no such file: ${e.path}`);
  else console.error(`kavx: ${e.message}`);
  process.exitCode = process.exitCode || (e instanceof TrustError ? 2 : 1);
});
