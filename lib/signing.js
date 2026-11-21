// Kav's signature on its security block list (Kav's ext/Signing.kt and ext/BlockList.kt), the one signed file in
// Kav's extensions now: Kav's maintainer signs a list by hand with the block list's key (site/extensions/block-list.md), and Kav
// and the community script check it. A signature covers "KAVEXT:block-list:1\n" and then the exact payload bytes.
import crypto from 'node:crypto';
import fs from 'node:fs';
import { strictObject, TrustError } from './strictjson.js';

// Signing.kt: the roles a signature may be for (only Kav's block list now), and an envelope's limits.
const ROLES = ['block-list'];
const signedPrefix = (role) => `KAVEXT:${role}:1\n`;
const ENVELOPE = { maxPayload: 1 << 20, maxSignatures: 4 };
// Signing.kt, Keys.fingerprint: the first 16 bytes of SHA-256 over the key's X.509 encoding, lower-case hex.
const FINGERPRINT_BYTES = 16;

export const sha256 = (bytes) => crypto.createHash('sha256').update(bytes).digest();
export const sha256hex = (bytes) => sha256(bytes).toString('hex');

// Strict base64, as java.util.Base64's basic decoder reads it: no line breaks, no URL alphabet.
export function decode64(text) {
  if (typeof text !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(text)) return null;
  const b = Buffer.from(text, 'base64');
  return b.toString('base64').replace(/=+$/, '') === text.replace(/=+$/, '') ? b : null;
}

export const encode64 = (bytes) => Buffer.from(bytes).toString('base64');

// A new P-256 private key as PEM text (PKCS#8).
export function newKey() {
  return crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' }).privateKey.export({ type: 'pkcs8', format: 'pem' });
}

function p256(key, what) {
  if (key.asymmetricKeyType !== 'ec' || key.asymmetricKeyDetails?.namedCurve !== 'prime256v1') throw new TrustError(`${what} is not a P-256 key`);
  return key;
}

// A private key from where it is kept: a PEM file's path, or "env:NAME" for a PEM held in an environment variable
// (how a release workflow passes a repository secret without writing it to disk).
export function loadPrivateKey(spec) {
  let pem;
  if (spec.startsWith('env:')) {
    pem = process.env[spec.slice(4)];
    if (!pem) throw new Error(`the environment variable ${spec.slice(4)} is empty or not set`);
  } else pem = fs.readFileSync(spec, 'utf8');
  let key;
  try { key = crypto.createPrivateKey(pem); } catch { throw new Error(`${spec} does not hold a private key in PEM form`); }
  return p256(key, spec);
}

// A public key from a PEM file (public or private), "env:NAME", or its base64 X.509 form as fingerprints are made of.
export function loadPublicKey(spec) {
  const raw = decode64(spec);
  if (raw && raw.length > 60) return publicKey(raw);
  const pem = spec.startsWith('env:') ? process.env[spec.slice(4)] ?? '' : fs.readFileSync(spec, 'utf8');
  try { return p256(crypto.createPublicKey(pem), spec); } catch (e) {
    if (e instanceof TrustError) throw e;
    throw new Error(`${spec} does not hold a key in PEM form`);
  }
}

// A key's X.509 (SubjectPublicKeyInfo) bytes: what goes in files, and what a fingerprint is made of.
export function spki(key) {
  const pub = key.type === 'private' ? crypto.createPublicKey(key) : key;
  return pub.export({ type: 'spki', format: 'der' });
}

export function publicKey(spkiBytes) {
  try { return p256(crypto.createPublicKey({ key: Buffer.from(spkiBytes), format: 'der', type: 'spki' }), 'it'); } catch { throw new TrustError('not a P-256 key'); }
}

export const fingerprint = (spkiBytes) => sha256(spkiBytes).subarray(0, FINGERPRINT_BYTES).toString('hex');
export const fingerprintOf = (key) => fingerprint(spki(key));

const signedBytes = (role, payload) => Buffer.concat([Buffer.from(signedPrefix(role)), payload]);

export function sign(key, role, payload) {
  return crypto.sign('sha256', signedBytes(role, payload), { key, dsaEncoding: 'der' });
}

export function verify(spkiBytes, role, payload, signature) {
  try { return crypto.verify('sha256', signedBytes(role, payload), { key: publicKey(spkiBytes), dsaEncoding: 'der' }, signature); } catch { return false; }
}

// A signed file's bytes: the payload as given, signed by each key in turn.
export function seal(role, payload, keys) {
  if (!ROLES.includes(role)) throw new Error(`unknown role ${role}`);
  if (keys.length === 0 || keys.length > ENVELOPE.maxSignatures) throw new Error(`a signed file takes 1 to ${ENVELOPE.maxSignatures} signatures`);
  if (payload.length > ENVELOPE.maxPayload) throw new Error('the payload is too large');
  return Buffer.from(JSON.stringify({
    kav: 'signed', role, payload: encode64(payload),
    signatures: keys.map((k) => ({ key: encode64(spki(k)), sig: encode64(sign(k, role, payload)) })),
  }) + '\n');
}

// A signed file opened: its payload bytes and the keys whose signatures check out, by fingerprint.
export function open(bytes, role, max = ENVELOPE.maxPayload * 2) {
  const o = strictObject(bytes, max);
  if (o.kav !== 'signed') throw new TrustError('not a signed file');
  if (o.role !== role) throw new TrustError(`signed as another role, wanted ${role}`);
  const payload = decode64(o.payload);
  if (!payload) throw new TrustError('bad payload');
  const list = o.signatures;
  if (!Array.isArray(list)) throw new TrustError('no signatures');
  if (list.length === 0 || list.length > ENVELOPE.maxSignatures) throw new TrustError('bad signatures');
  const signers = new Map();
  for (const s of list) {
    if (typeof s !== 'object' || s === null) throw new TrustError('bad signature');
    const key = decode64(s.key);
    if (!key) throw new TrustError('bad key');
    const sig = decode64(s.sig);
    if (!sig) throw new TrustError('bad signature');
    if (verify(key, role, payload, sig)) signers.set(fingerprint(key), key);
  }
  return {
    role, payload, signers,
    signedBy: (fp) => signers.has(fp),
    // The payload, when one of these keys signed it.
    payloadFrom(fingerprints, maxPayload = ENVELOPE.maxPayload) {
      if (!fingerprints.some((fp) => signers.has(fp))) throw new TrustError(`${role} isn't signed by a key Kav trusts for it`);
      return strictObject(payload, maxPayload);
    },
  };
}
