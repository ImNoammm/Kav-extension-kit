// JSON as Kav reads signed things (ext/Signing.kt, StrictJson): UTF-8 only, no duplicate keys, bounded size and
// depth, an object at the top, nothing after it.
//
// Every number a trust rule reads must be a JSON integer, for Kav and for the kit: not text, not a fraction, not
// 1.0. Kav reads text and true-or-false values leniently (a number where text belongs is turned into text); the kit
// wants the type the format says there too, so on those it can refuse a file Kav would take, never the other way.
import { JSON_MAX_DEPTH } from './format.js';

export class TrustError extends Error {}

// A JSON number that was not written as an integer.
class NotWhole { constructor(source) { this.source = source; } }

export function strictObject(bytes, max) {
  if (bytes.length > max) throw new TrustError('too large');
  let s;
  try { s = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes); } catch { throw new TrustError('not UTF-8'); }
  let i = 0;
  const bad = (why) => { throw new TrustError(`bad JSON: ${why}`); };
  const peek = () => (i < s.length ? s[i] : '\0');
  const ws = () => { while (i < s.length && ' \t\r\n'.includes(s[i])) i++; };
  const string = () => {
    i++;
    let out = '';
    for (;;) {
      if (i >= s.length) bad('string');
      const c = s[i++];
      if (c === '"') return out;
      if (c < ' ') bad('control character');
      if (c !== '\\') { out += c; continue; }
      const e = s[i++];
      if (e === '"' || e === '\\' || e === '/') out += e;
      else if ('bfnrt'.includes(e ?? ' ')) out += { b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' }[e];
      else if (e === 'u') {
        const h = s.slice(i, i + 4);
        if (!/^[0-9a-fA-F]{4}$/.test(h)) bad('escape');
        out += String.fromCharCode(parseInt(h, 16));
        i += 4;
      } else bad('escape');
    }
  };
  const digits = () => { const d = i; while (peek() >= '0' && peek() <= '9') i++; if (i === d) bad('number'); };
  const value = (depth) => {
    if (depth > JSON_MAX_DEPTH) bad('too deep');
    ws();
    const c = peek();
    if (c === '{') {
      i++; ws();
      const keys = new Set();
      if (peek() === '}') { i++; return; }
      for (;;) {
        ws(); if (peek() !== '"') bad('key');
        const k = string();
        if (keys.has(k)) bad('duplicate key');
        keys.add(k);
        ws(); if (peek() !== ':') bad('colon'); i++;
        value(depth + 1); ws();
        if (peek() === ',') i++; else if (peek() === '}') { i++; return; } else bad('object');
      }
    } else if (c === '[') {
      i++; ws();
      if (peek() === ']') { i++; return; }
      for (;;) {
        value(depth + 1); ws();
        if (peek() === ',') i++; else if (peek() === ']') { i++; return; } else bad('array');
      }
    } else if (c === '"') string();
    else if (c === 't' || c === 'f' || c === 'n') {
      const w = { t: 'true', f: 'false', n: 'null' }[c];
      if (!s.startsWith(w, i)) bad('literal');
      i += w.length;
    } else {
      const start = i;
      if (peek() === '-') i++;
      if (peek() === '0') i++; else digits();
      if (peek() === '.') { i++; digits(); }
      if (peek() === 'e' || peek() === 'E') { i++; if (peek() === '+' || peek() === '-') i++; digits(); }
      if (i === start) bad('value');
    }
  };
  ws();
  if (peek() !== '{') bad('not an object');
  value(0);
  ws();
  if (i !== s.length) bad('trailing data');
  // A number written as anything but a plain integer (1.0, 1e2) is kept apart, so it can never pass for a whole
  // number: Kav refuses those where a trust rule reads a number.
  try { return JSON.parse(s, (k, v, ctx) => (typeof v === 'number' && !/^-?[0-9]+$/.test(ctx.source) ? new NotWhole(ctx.source) : v)); } catch { throw new TrustError('bad JSON'); }
}

// A JSON number's value, however it was written; undefined for anything that is not a number.
export const numberOf = (v) => (typeof v === 'number' ? v : v instanceof NotWhole ? Number(v.source) : undefined);
// Whether a value is a JSON integer that fits 32 bits (what Kotlin's `is Int` takes from org.json).
export const isInt = (v) => typeof v === 'number' && Number.isInteger(v) && v >= -2147483648 && v <= 2147483647;

// Typed reads. Each throws a TrustError naming the field when the value has another type.
const where = (what, k) => `${what}: "${k}"`;

export function str(o, k, what, fallback = '') {
  const v = o[k];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'string') throw new TrustError(`${where(what, k)} must be text`);
  return v;
}

export function int(o, k, what, fallback) {
  const v = o[k];
  if (v === undefined || v === null) return fallback;
  if (!Number.isSafeInteger(v)) throw new TrustError(`${where(what, k)} must be a whole number`);
  return v;
}

export function bool(o, k, what, fallback = false) {
  const v = o[k];
  if (v === undefined || v === null) return fallback;
  if (typeof v !== 'boolean') throw new TrustError(`${where(what, k)} must be true or false`);
  return v;
}

export function strings(o, k, what) {
  const v = o[k];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'string')) throw new TrustError(`${where(what, k)} must be a list of text`);
  return v;
}

export function objects(o, k, what) {
  const v = o[k];
  if (v === undefined || v === null) return [];
  if (!Array.isArray(v) || v.some((x) => typeof x !== 'object' || x === null || Array.isArray(x))) throw new TrustError(`${where(what, k)} must be a list of objects`);
  return v;
}

export function object(o, k, what) {
  const v = o[k];
  if (v === undefined || v === null) return null;
  if (typeof v !== 'object' || Array.isArray(v)) throw new TrustError(`${where(what, k)} must be an object`);
  return v;
}
