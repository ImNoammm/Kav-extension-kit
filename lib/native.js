// Building a native extension (Kav's ext/Native.kt): Kotlin or Java compiled against Kav's API (api/kav-api.jar, made
// from Kav's own sources by tools/make-api-jar.js), turned into one dex with Android's own tools, and put with the
// manifest and its files into the folder a bundle takes it from. No Gradle: kotlinc or javac, then d8 (Java only) or R8 (with Kotlin), from the Android SDK.
//
// Kotlin code needs the Kotlin standard library, and Kav's release build shrinks and renames its own copy, so an
// extension brings the parts it uses: R8 keeps every class of the extension's own as it is and moves the standard
// library's into a package of the extension's, under short names, so they never meet Kav's.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFolder } from './package.js';
import { TrustError } from './strictjson.js';

export const API_JAR = fileURLToPath(new URL('../api/kav-api.jar', import.meta.url));
// The oldest Android Kav runs on (minSdk), which d8 and R8 build the dex for.
export const MIN_API = 26;

const exe = (name) => (process.platform === 'win32' ? `${name}.exe` : name);
const onPath = (name) => (process.env.PATH ?? '').split(path.delimiter).map((d) => path.join(d, name)).find((f) => fs.existsSync(f)) ?? null;
// The newest of the numbered folders in a folder ("android-36", "37.0.0"), or null.
const newest = (dir, pattern) => {
  if (!fs.existsSync(dir)) return null;
  const parts = (n) => n.match(/\d+/g)?.map(Number) ?? [];
  const found = fs.readdirSync(dir).filter((n) => pattern.test(n)).sort((a, b) => {
    const x = parts(a), y = parts(b);
    for (let i = 0; i < Math.max(x.length, y.length); i++) if ((x[i] ?? 0) !== (y[i] ?? 0)) return (x[i] ?? 0) - (y[i] ?? 0);
    return 0;
  });
  return found.length ? path.join(dir, found[found.length - 1]) : null;
};

// The tools a build needs, from the environment: ANDROID_HOME (or ANDROID_SDK_ROOT, or ~/Android/Sdk) for android.jar
// and d8.jar, JAVA_HOME (or java and javac on the PATH), and KOTLINC (or kotlinc on the PATH, or KOTLIN_HOME) when
// there is Kotlin to compile. Throws, saying what is missing and where to get it.
export function findTools({ kotlin = false } = {}) {
  const sdk = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT, path.join(os.homedir(), 'Android', 'Sdk'), path.join(os.homedir(), 'Library', 'Android', 'sdk')]
    .find((d) => d && fs.existsSync(path.join(d, 'platforms')));
  if (!sdk) throw new Error('no Android SDK found: set ANDROID_HOME to it (Android Studio installs one; the command-line tools from developer.android.com do too)');
  const platform = newest(path.join(sdk, 'platforms'), /^android-\d+$/);
  const androidJar = platform && path.join(platform, 'android.jar');
  if (!androidJar || !fs.existsSync(androidJar)) throw new Error(`no android.jar in ${path.join(sdk, 'platforms')}: install a platform, for example with sdkmanager "platforms;android-36"`);
  const buildTools = newest(path.join(sdk, 'build-tools'), /^\d+\.\d+\.\d+$/);
  const d8Jar = buildTools && path.join(buildTools, 'lib', 'd8.jar');
  if (!d8Jar || !fs.existsSync(d8Jar)) throw new Error(`no d8 in ${path.join(sdk, 'build-tools')}: install the build tools, for example with sdkmanager "build-tools;36.0.0"`);
  const javaBin = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin') : null;
  const java = (javaBin && fs.existsSync(path.join(javaBin, exe('java'))) ? path.join(javaBin, exe('java')) : null) ?? onPath(exe('java'));
  const javac = (javaBin && fs.existsSync(path.join(javaBin, exe('javac'))) ? path.join(javaBin, exe('javac')) : null) ?? onPath(exe('javac'));
  if (!java || !javac) throw new Error('no Java found: install a JDK, 17 or newer, and set JAVA_HOME to it');
  let kotlinc = null, stdlib = null;
  if (kotlin) {
    const name = process.platform === 'win32' ? 'kotlinc.bat' : 'kotlinc';
    kotlinc = process.env.KOTLINC ?? (process.env.KOTLIN_HOME ? path.join(process.env.KOTLIN_HOME, 'bin', name) : null) ?? onPath(name);
    if (!kotlinc || !fs.existsSync(kotlinc)) throw new Error('no Kotlin compiler found: download kotlin-compiler-<version>.zip from github.com/JetBrains/kotlin/releases, unpack it, and put its bin folder on your PATH (or set KOTLINC to its kotlinc)');
    stdlib = path.join(path.dirname(fs.realpathSync(kotlinc)), '..', 'lib', 'kotlin-stdlib.jar');
    if (!fs.existsSync(stdlib)) throw new Error(`no kotlin-stdlib.jar beside ${kotlinc}`);
  }
  return { sdk, androidJar, d8Jar, java, javac, kotlinc, stdlib };
}

const run = (cmd, args, env) => {
  try {
    return execFileSync(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, ...env }, maxBuffer: 64 << 20 }).toString();
  } catch (e) {
    const out = `${e.stdout ?? ''}${e.stderr ?? ''}`.trim();
    throw new Error(`${path.basename(cmd)} failed${out ? `:\n${out}` : ` (${e.message})`}`);
  }
};

const walk = (dir, keep) => {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(p, keep)); else if (keep(e.name)) out.push(p);
  }
  return out;
};

// Builds a native extension's folder:
//   <folder>/manifest.json   with "native": { "dex": "classes.dex", "entry": "your.package.Entry" }
//   <folder>/src/...         its .kt and .java files
//   anything else in the folder (an icon, pictures) goes in as it is, except src/, build/ and files whose names start
//   with a dot.
// Writes build/ in the folder (the classes, the dex and build/package, what goes in the bundle) and returns its files
// (readFolder). log: told each step.
export function buildNative(folder, { log = () => {} } = {}) {
  const dir = path.resolve(folder);
  const manifestFile = path.join(dir, 'manifest.json');
  if (!fs.existsSync(manifestFile)) throw new Error(`no manifest.json in ${dir}`);
  let manifest;
  try { manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf8')); } catch (e) { throw new TrustError(`manifest.json is not JSON: ${e.message}`); }
  const nat = manifest.native;
  // A theme with no code: nothing to compile, only its own files.
  if (nat === undefined && manifest.kind === 'theme') {
    const stage = path.join(dir, 'build', 'package');
    fs.rmSync(path.join(dir, 'build'), { recursive: true, force: true });
    fs.mkdirSync(stage, { recursive: true });
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name.startsWith('.') || e.name === 'src' || e.name === 'build') continue;
      fs.cpSync(path.join(dir, e.name), path.join(stage, e.name), { recursive: true });
    }
    log('a theme with no code: nothing to compile');
    log(`ready: ${path.relative(process.cwd(), stage) || stage}`);
    return readFolder(stage);
  }
  if (typeof nat !== 'object' || nat === null || typeof nat.entry !== 'string' || nat.entry === '' || typeof nat.dex !== 'string' || nat.dex === '')
    throw new TrustError('manifest.json needs "native": { "dex": "classes.dex", "entry": "<your entry class, such as org.example.hello.Hello>" }');
  const sources = walk(path.join(dir, 'src'), (n) => n.endsWith('.kt') || n.endsWith('.java'));
  if (sources.length === 0) throw new Error(`no .kt or .java files under ${path.join(dir, 'src')}`);
  const kt = sources.filter((f) => f.endsWith('.kt')), java = sources.filter((f) => f.endsWith('.java'));
  if (!fs.existsSync(API_JAR)) throw new Error(`${API_JAR} is missing: make it with "node tools/make-api-jar.js <Kav's source folder>"`);
  const t = findTools({ kotlin: kt.length > 0 });
  const build = path.join(dir, 'build');
  const classes = path.join(build, 'classes'), dexDir = path.join(build, 'dex'), stage = path.join(build, 'package');
  fs.rmSync(build, { recursive: true, force: true });
  fs.mkdirSync(classes, { recursive: true });
  fs.mkdirSync(dexDir, { recursive: true });
  const cp = [t.androidJar, API_JAR].join(path.delimiter);
  const env = { JAVA_HOME: path.dirname(path.dirname(t.java)) };
  if (kt.length) {
    log(`kotlinc: ${kt.length} file${kt.length === 1 ? '' : 's'}`);
    // Java files are given too, so Kotlin can use them; javac compiles them next.
    run(t.kotlinc, ['-jvm-target', '11', '-no-reflect', '-classpath', cp, '-d', classes, ...kt, ...java], env);
  }
  if (java.length) {
    log(`javac: ${java.length} file${java.length === 1 ? '' : 's'}`);
    run(t.javac, ['-source', '11', '-target', '11', '-nowarn', '-Xlint:-options', '-encoding', 'UTF-8', '-cp', [cp, classes].join(path.delimiter), '-d', classes, ...java]);
  }
  const compiled = walk(classes, (n) => n.endsWith('.class'));
  if (kt.length) {
    // The extension's own classes kept as they are; the Kotlin standard library's shrunk and moved into its package.
    const pkg = nat.entry.includes('.') ? nat.entry.slice(0, nat.entry.lastIndexOf('.')) : 'ext';
    const rules = path.join(build, 'r8-rules.pro');
    fs.writeFileSync(rules, [
      '-keep class !kotlin.**,!kotlinx.**,!org.intellij.lang.annotations.**,!org.jetbrains.annotations.**,** { *; }',
      `-repackageclasses '${pkg}.kotlin'`,
      '-keepattributes Signature,InnerClasses,EnclosingMethod,*Annotation*',
      '-dontwarn **',
      '',
    ].join('\n'));
    log('r8: one dex with the parts of the Kotlin standard library it uses');
    run(t.java, ['-cp', t.d8Jar, 'com.android.tools.r8.R8', '--release', '--min-api', String(MIN_API), '--output', dexDir, '--lib', t.androidJar, '--classpath', API_JAR,
      '--pg-conf', rules, ...compiled, t.stdlib]);
  } else {
    log('d8: one dex');
    run(t.java, ['-cp', t.d8Jar, 'com.android.tools.r8.D8', '--release', '--min-api', String(MIN_API), '--output', dexDir, '--lib', t.androidJar, '--classpath', API_JAR, ...compiled]);
  }
  const dexes = fs.readdirSync(dexDir).filter((n) => n.endsWith('.dex'));
  if (dexes.length !== 1) throw new Error(`the code made ${dexes.length} dex files; Kav loads one (at most 65,536 methods)`);
  // What goes in the bundle: the extension's own files, and the dex where the manifest says.
  fs.mkdirSync(stage, { recursive: true });
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || e.name === 'src' || e.name === 'build') continue;
    fs.cpSync(path.join(dir, e.name), path.join(stage, e.name), { recursive: true });
  }
  fs.mkdirSync(path.dirname(path.join(stage, nat.dex)), { recursive: true });
  fs.copyFileSync(path.join(dexDir, dexes[0]), path.join(stage, nat.dex));
  log(`ready: ${path.relative(process.cwd(), stage) || stage}`);
  return readFolder(stage);
}
