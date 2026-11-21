// A package's ZIP, read the way Kav reads it (ext/Archive.kt): by its own reader, so every rule is checked on the
// central directory and the local headers both, before any file is used. And a plain writer that always makes the
// same bytes from the same files.
//
// The reader is a port, not a library call, because the point is to refuse exactly what Kav refuses. General ZIP
// libraries are written to open as many archives as they can.
import zlib from 'node:zlib';
import { ARCHIVE } from './format.js';

export class BadArchive extends Error {}

// A file's path inside a package: ASCII names of letters, digits, '.', '_' and '-' between single slashes, never
// "." or "..", at most ARCHIVE.maxDepth deep.
export function safePath(name) {
  const dir = name.endsWith('/');
  const parts = (dir ? name.slice(0, -1) : name).split('/');
  return name.length <= ARCHIVE.maxPath && parts.length <= ARCHIVE.maxDepth && parts.every((p) => ARCHIVE.part.test(p) && p !== '.' && p !== '..');
}

function nameOf(raw, flags) {
  const utf8 = (flags & 0x800) !== 0;
  if (!utf8 && raw.some((b) => b >= 0x80)) throw new BadArchive("name isn't ASCII");
  const name = new TextDecoder().decode(raw);
  // eslint-disable-next-line no-control-regex
  if (!safePath(name)) throw new BadArchive(`unsafe path: ${name.slice(0, 80).replace(/[\u0000-\u001f]/g, '')}`);
  return name;
}

function inflate(zip, at, csize, usize, name) {
  let out;
  try {
    out = zlib.inflateRawSync(zip.subarray(at, at + csize), { maxOutputLength: usize + 1 });
  } catch (e) {
    // More than it declared (a bomb), or a stream that stops short.
    if (e.code === 'ERR_BUFFER_TOO_LARGE' || e.code === 'Z_BUF_ERROR') throw new BadArchive(`bad size: ${name}`);
    throw new BadArchive(`damaged: ${name}`);
  }
  if (out.length !== usize) throw new BadArchive(`bad size: ${name}`);
  return out;
}

// The files in the archive, by name, in the archive's order. Throws BadArchive for anything outside the rules.
export function readZip(zip) {
  try {
    return entries(Buffer.from(zip.buffer, zip.byteOffset, zip.byteLength));
  } catch (e) {
    if (e instanceof RangeError) throw new BadArchive('damaged archive');
    throw e;
  }
}

function entries(zip) {
  if (zip.length > ARCHIVE.maxArchive) throw new BadArchive('archive too large');
  let end = -1;
  for (let at = zip.length - 22; at >= Math.max(0, zip.length - 22 - 0xffff); at--) {
    if (zip.readUInt32LE(at) === 0x06054b50) { end = at; break; }
  }
  if (end < 0) throw new BadArchive('not a ZIP');
  if (zip.readUInt16LE(end + 4) !== 0 || zip.readUInt16LE(end + 6) !== 0) throw new BadArchive('multi-part archive');
  const count = zip.readUInt16LE(end + 10);
  if (count !== zip.readUInt16LE(end + 8)) throw new BadArchive('multi-part archive');
  if (count > ARCHIVE.maxEntries) throw new BadArchive('too many files');
  const cdSize = zip.readUInt32LE(end + 12);
  const cdAt = zip.readUInt32LE(end + 16);
  if (cdAt + cdSize > end) throw new BadArchive('bad central directory');
  const out = new Map();
  const folded = new Set();
  let at = cdAt;
  let total = 0;
  for (let n = 0; n < count; n++) {
    if (at + 46 > end || zip.readUInt32LE(at) !== 0x02014b50) throw new BadArchive('bad central directory');
    const madeBy = zip.readUInt16LE(at + 4);
    const flags = zip.readUInt16LE(at + 8);
    const method = zip.readUInt16LE(at + 10);
    const crc = zip.readUInt32LE(at + 16);
    const csize = zip.readUInt32LE(at + 20);
    const usize = zip.readUInt32LE(at + 24);
    const nameLen = zip.readUInt16LE(at + 28);
    const extraLen = zip.readUInt16LE(at + 30);
    const commentLen = zip.readUInt16LE(at + 32);
    const external = zip.readUInt32LE(at + 38);
    const local = zip.readUInt32LE(at + 42);
    if (at + 46 + nameLen > zip.length) throw new BadArchive('damaged archive');
    const rawName = zip.subarray(at + 46, at + 46 + nameLen);
    at += 46 + nameLen + extraLen + commentLen;
    if (at > end) throw new BadArchive('bad central directory');
    const name = nameOf(rawName, flags);
    if (flags & 1) throw new BadArchive(`encrypted: ${name}`);
    if (csize === 0xffffffff || usize === 0xffffffff || local === 0xffffffff) throw new BadArchive("ZIP64 isn't accepted");
    const mode = (external >>> 16) & 0xf000;
    if ((madeBy >> 8) === 3 && mode === 0xa000) throw new BadArchive(`link: ${name}`);
    if (name.endsWith('/')) {
      if (usize !== 0) throw new BadArchive(`bad folder: ${name}`);
      continue;
    }
    const lower = name.toLowerCase();
    if (folded.has(lower)) throw new BadArchive(`two files named ${name}`);
    folded.add(lower);
    if (ARCHIVE.nested.some((x) => lower.endsWith(x))) throw new BadArchive(`nested archive or code: ${name}`);
    if (method !== 0 && method !== 8) throw new BadArchive(`unsupported compression: ${name}`);
    if (usize > ARCHIVE.maxFile) throw new BadArchive(`file too large: ${name}`);
    total += usize;
    if (total > ARCHIVE.maxExpanded) throw new BadArchive('too large once expanded');
    if (usize > ARCHIVE.ratioFrom && usize > csize * ARCHIVE.ratio) throw new BadArchive(`suspicious compression: ${name}`);
    // The local header must say the same name and method; its sizes may be in a data descriptor (flag 8).
    if (local >= 0x80000000 || local + 30 > cdAt || zip.readUInt32LE(local) !== 0x04034b50) throw new BadArchive(`bad local header: ${name}`);
    const lNameLen = zip.readUInt16LE(local + 26);
    const lExtraLen = zip.readUInt16LE(local + 28);
    if (local + 30 + lNameLen > zip.length) throw new BadArchive('damaged archive');
    if (!rawName.equals(zip.subarray(local + 30, local + 30 + lNameLen))) throw new BadArchive(`names disagree: ${name}`);
    if (zip.readUInt16LE(local + 8) !== method || (zip.readUInt16LE(local + 6) & 1) !== 0) throw new BadArchive(`headers disagree: ${name}`);
    const data = local + 30 + lNameLen + lExtraLen;
    if (data + csize > cdAt) throw new BadArchive(`bad local header: ${name}`);
    let bytes;
    if (method === 0) {
      if (csize !== usize) throw new BadArchive(`bad stored size: ${name}`);
      bytes = Buffer.from(zip.subarray(data, data + csize));
    } else bytes = inflate(zip, data, csize, usize, name);
    if (zlib.crc32(bytes) !== crc) throw new BadArchive(`damaged: ${name}`);
    out.set(name, bytes);
  }
  return out;
}

// An archive from raw entries, with every header field open to the caller. writeZip below uses it plainly; the
// kit's tests use it to build archives that lie.
//   entry: { name, data, method = 8, local = {}, central = {} }
// local and central override header fields: name, method, flags, crc, csize, usize, and for central also madeBy,
// external. `stored` replaces the bytes written as the file's data.
export function rawZip(list, { comment = Buffer.alloc(0), count } = {}) {
  const locals = [], centrals = [];
  let offset = 0;
  for (const e of list) {
    const data = Buffer.from(e.data ?? '');
    const method = e.method ?? 8;
    const stored = e.stored ?? (method === 8 ? zlib.deflateRawSync(data, { level: 6 }) : data);
    const base = { name: Buffer.from(e.name), method, flags: 0, crc: zlib.crc32(data), csize: stored.length, usize: data.length };
    const l = { ...base, ...e.local }, c = { madeBy: 20, external: 0, ...base, ...e.central };
    l.name = Buffer.from(l.name); c.name = Buffer.from(c.name);
    const lh = Buffer.alloc(30);
    lh.writeUInt32LE(0x04034b50, 0); lh.writeUInt16LE(20, 4); lh.writeUInt16LE(l.flags, 6); lh.writeUInt16LE(l.method, 8);
    lh.writeUInt16LE(0, 10); lh.writeUInt16LE(0x21, 12);
    lh.writeUInt32LE(l.crc >>> 0, 14); lh.writeUInt32LE(l.csize >>> 0, 18); lh.writeUInt32LE(l.usize >>> 0, 22);
    lh.writeUInt16LE(l.name.length, 26); lh.writeUInt16LE(0, 28);
    const ch = Buffer.alloc(46);
    ch.writeUInt32LE(0x02014b50, 0); ch.writeUInt16LE(c.madeBy, 4); ch.writeUInt16LE(20, 6); ch.writeUInt16LE(c.flags, 8);
    ch.writeUInt16LE(c.method, 10); ch.writeUInt16LE(0, 12); ch.writeUInt16LE(0x21, 14);
    ch.writeUInt32LE(c.crc >>> 0, 16); ch.writeUInt32LE(c.csize >>> 0, 20); ch.writeUInt32LE(c.usize >>> 0, 24);
    ch.writeUInt16LE(c.name.length, 28); ch.writeUInt32LE(c.external >>> 0, 38); ch.writeUInt32LE(c.offset ?? offset, 42);
    locals.push(lh, l.name, stored);
    centrals.push(ch, c.name);
    offset += 30 + l.name.length + stored.length;
  }
  const cd = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(count ?? list.length, 8); eocd.writeUInt16LE(count ?? list.length, 10);
  eocd.writeUInt32LE(cd.length, 12); eocd.writeUInt32LE(offset, 16); eocd.writeUInt16LE(comment.length, 20);
  return Buffer.concat([...locals, cd, eocd, comment]);
}

// The archive of these files, in this order: deflate at zlib's level 6, no extra fields, and one fixed date
// (1 January 1980), since a package's date means nothing to Kav. The same files give the same bytes on the same
// version of Node. Another zlib may deflate differently, which is as valid.
export function writeZip(files) {
  return rawZip([...files].map(([name, data]) => ({ name, data })));
}
