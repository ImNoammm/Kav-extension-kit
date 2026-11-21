#!/usr/bin/env node
// Makes api/kav-api.jar, the jar a native extension compiles against, from Kav's own sources: the classes of
// kav.kavapp.api (android/app/src/main/java/kav/kavapp/api in Kav), compiled against android.jar. The jar is
// for compiling only: Kav itself provides these classes when it loads an extension, so they never go into a dex.
// The sources are copied beside it (api/src) to read.
//
//   node tools/make-api-jar.js <Kav's source folder>
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findTools } from '../lib/native.js';
import { writeZip } from '../lib/zip.js';

const kav = process.argv[2];
if (!kav) { console.error('usage: node tools/make-api-jar.js <Kav\'s source folder>'); process.exit(1); }
const from = path.join(kav, 'android/app/src/main/java/kav/kavapp/api');
const sources = fs.existsSync(from) ? fs.readdirSync(from).filter((n) => n.endsWith('.java')).sort() : [];
if (sources.length === 0) { console.error(`no API sources in ${from}`); process.exit(1); }

const api = fileURLToPath(new URL('../api/', import.meta.url));
const t = findTools();
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kav-api-'));
try {
  execFileSync(t.javac, ['-source', '11', '-target', '11', '-nowarn', '-Xlint:-options', '-encoding', 'UTF-8', '-cp', t.androidJar, '-d', tmp, ...sources.map((n) => path.join(from, n))], { stdio: 'inherit' });
  const files = new Map();
  const walk = (dir, rel) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      if (e.isDirectory()) walk(path.join(dir, e.name), `${rel}${e.name}/`);
      else files.set(`${rel}${e.name}`, fs.readFileSync(path.join(dir, e.name)));
    }
  };
  walk(tmp, '');
  // The same bytes every time from the same classes: the kit's own zip writer, which writes no dates.
  fs.mkdirSync(api, { recursive: true });
  fs.writeFileSync(path.join(api, 'kav-api.jar'), writeZip(new Map([['META-INF/MANIFEST.MF', Buffer.from('Manifest-Version: 1.0\r\n\r\n')], ...files])));
  const src = path.join(api, 'src/kav/kavapp/api');
  fs.rmSync(path.join(api, 'src'), { recursive: true, force: true });
  fs.mkdirSync(src, { recursive: true });
  for (const n of sources) fs.copyFileSync(path.join(from, n), path.join(src, n));
  console.log(`wrote ${path.join(api, 'kav-api.jar')} (${files.size} classes) and api/src from ${from}`);
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}
