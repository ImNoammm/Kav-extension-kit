#!/usr/bin/env node
// Makes api/hookable/<kav version>.txt.gz: every function of Kav's own (uk.noammm.kav.*) that a release build of that Kav
// still has as a method, after R8, read from the APK's dex files. kavx check holds an extension's declared hooks
// ("hooks" in its manifest) against it. Made with the API jar, for each release of Kav.
//
//   node tools/hookable.js <Kav's release APK> <Kav's versionCode>
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';

const [apk, version] = process.argv.slice(2);
if (!apk || !/^\d+$/.test(version ?? '')) { console.error("usage: node tools/hookable.js <Kav's release APK> <Kav's versionCode>"); process.exit(1); }

function uleb(b, at) {
  let v = 0, shift = 0, x;
  do { x = b[at.i++]; v |= (x & 0x7f) << shift; shift += 7; } while (x & 0x80);
  return v >>> 0;
}

// A type descriptor as Java writes it: "I" int, "Ljava/lang/String;" java.lang.String, "[I" int[].
const PRIMITIVE = { I: 'int', J: 'long', Z: 'boolean', F: 'float', D: 'double', B: 'byte', S: 'short', C: 'char', V: 'void' };
function javaType(d) {
  if (d.startsWith('[')) return `${javaType(d.slice(1))}[]`;
  if (d.startsWith('L')) return d.slice(1, -1).replaceAll('/', '.');
  return PRIMITIVE[d];
}

// Every method with code of the classes under prefix, as "<class> <method>(<parameter types>)".
function methodsOf(dex, prefix) {
  const u32 = (o) => dex.readUInt32LE(o), u16 = (o) => dex.readUInt16LE(o);
  const strings = (i) => { const at = { i: u32(u32(0x3c) + 4 * i) }; uleb(dex, at); let e = at.i; while (dex[e] !== 0) e++; return dex.toString('utf8', at.i, e); };
  const type = (i) => strings(u32(u32(0x44) + 4 * i));
  const params = (proto) => {
    const off = u32(u32(0x4c) + 12 * proto + 8);
    if (off === 0) return [];
    return Array.from({ length: u32(off) }, (_, k) => javaType(type(u16(off + 4 + 2 * k))));
  };
  const out = [];
  for (let c = 0; c < u32(0x60); c++) {
    const def = u32(0x64) + 32 * c;
    const cls = type(u32(def));
    const data = u32(def + 24);
    if (!cls.startsWith(prefix) || data === 0) continue;
    const at = { i: data };
    const [sf, inf, dm, vm] = [uleb(dex, at), uleb(dex, at), uleb(dex, at), uleb(dex, at)];
    for (let k = 0; k < sf + inf; k++) { uleb(dex, at); uleb(dex, at); }
    for (const n of [dm, vm]) {
      let idx = 0;
      for (let k = 0; k < n; k++) {
        idx += uleb(dex, at); uleb(dex, at);
        const code = uleb(dex, at);
        if (code === 0) continue;
        const m = u32(0x5c) + 8 * idx;
        const name = strings(u32(m + 4));
        if (name === '<clinit>') continue;
        out.push(`${javaType(cls)} ${name}(${params(u16(m + 2)).join(',')})`);
      }
    }
  }
  return out;
}

// The APK's dex files, by unzip (an APK carries native code, which the kit's own reader refuses in a bundle).
const names = execFileSync('unzip', ['-Z1', apk], { encoding: 'utf8' }).split('\n').filter((n) => /^classes\d*\.dex$/.test(n));
const dexes = names.map((n) => execFileSync('unzip', ['-p', apk, n], { maxBuffer: 1 << 30 }));
if (dexes.length === 0) { console.error(`no dex in ${apk}`); process.exit(1); }
const all = [...new Set(dexes.flatMap((d) => methodsOf(Buffer.from(d), 'Luk/noammm/kav/')))].sort();
const dir = fileURLToPath(new URL('../api/hookable/', import.meta.url));
fs.mkdirSync(dir, { recursive: true });
const out = path.join(dir, `${version}.txt.gz`);
fs.writeFileSync(out, zlib.gzipSync(`# The functions Kav ${version}'s release build has, as kavx check holds declared hooks against them.\n${all.join('\n')}\n`, { level: 9 }));
console.log(`wrote ${out}: ${all.length} functions`);
