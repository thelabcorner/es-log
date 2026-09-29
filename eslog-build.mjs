#!/usr/bin/env node
// Node ESM core plus the canonical ESTC-generated ExtendScript entrypoints.
import { execFileSync, spawnSync } from 'node:child_process';
import { buildSync } from 'esbuild';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = dirname(fileURLToPath(import.meta.url));
var DIST = join(ROOT, 'dist');
var ENTRY = join(ROOT, 'src', 'index.ts');
var ESTC = join(ROOT, '..', 'extendscript-toolchain', 'bin', 'estc.mjs');

function resolvePython() {
  if (process.env.ESLOG_PYTHON) return { command: process.env.ESLOG_PYTHON, prefix: [] };
  var candidates = process.platform === 'win32'
    ? [
        { command: 'py.exe', prefix: ['-3'] },
        { command: 'python.exe', prefix: [] },
        { command: 'python3.exe', prefix: [] }
      ]
    : [
        { command: 'python3', prefix: [] },
        { command: 'python', prefix: [] }
      ];
  for (var i = 0; i < candidates.length; i++) {
    var probe = spawnSync(candidates[i].command, candidates[i].prefix.concat(['--version']), {
      cwd: ROOT,
      stdio: 'ignore'
    });
    if (!probe.error && probe.status === 0) return candidates[i];
  }
  throw new Error('Python 3 interpreter not found; set ESLOG_PYTHON to an executable path');
}
var PYTHON = resolvePython();

mkdirSync(DIST, { recursive: true });
buildSync({
  entryPoints: [ENTRY],
  outfile: join(DIST, 'eslog-core.esm.mjs'),
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'es2019',
  logLevel: 'warning'
});

function buildExtendscript(config) {
  execFileSync(process.execPath, [ESTC, 'build', '--config', config], {
    cwd: ROOT,
    stdio: 'inherit'
  });
}

function assertNoDescriptorModuleHelpers(path) {
  var source = readFileSync(path, 'utf8');
  var forbidden = ['Object.defineProperty', 'Object.getOwnPropertyDescriptor', 'Object.getOwnPropertyNames'];
  var i = 0;
  for (i = 0; i < forbidden.length; i++) {
    if (source.indexOf(forbidden[i]) !== -1) {
      throw new Error('ESLOG JSX contains an unsupported module helper: ' + forbidden[i]);
    }
  }
}

function gitHead() {
  try {
    return execFileSync('git', ['rev-parse', 'HEAD'], { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch (ignore) {
    return '';
  }
}

function estcCheck(file) {
  execFileSync(process.execPath, [ESTC, 'check', file, '--no-target'], {
    cwd: ROOT,
    stdio: 'inherit'
  });
}

function minifyComposed(text) {
  var skillDir = join(ROOT, '..', 'agent-skills', 'adobe-extendscript-minification');
  var script = join(skillDir, 'scripts', 'minify-jsx.py');
  var config = join(skillDir, 'configs', 'conservative.json');
  if (!existsSync(script) || !existsSync(config)) {
    throw new Error('ESLOG composed distribution requires the shared ExtendScript minification skill');
  }
  var body = join(DIST, '.eslog-accel.body.jsx');
  var min = join(DIST, '.eslog-accel.min.jsx');
  writeFileSync(body, text, 'utf8');
  execFileSync(PYTHON.command, PYTHON.prefix.concat([script, '--in', body, '--config', config, '--out', min]), {
    cwd: ROOT,
    stdio: 'inherit'
  });
  var minified = readFileSync(min, 'utf8');
  writeFileSync(join(DIST, 'ESLOG.accel.min.jsx'), minified, 'utf8');
  estcCheck('dist/ESLOG.accel.min.jsx');
}

async function buildComposition() {
  var espackRoot = join(ROOT, '..', 'espack');
  var esonRoot = join(ROOT, '..', 'eson');
  var esonManifest = join(esonRoot, 'dist', 'ESON.manifest.json');
  if (!existsSync(join(espackRoot, 'espack-merge.mjs'))) {
    throw new Error('ESLOG composition requires sibling ESPACK');
  }
  if (!existsSync(esonManifest)) {
    throw new Error('ESLOG composition requires ESON v2 manifest; run ../eson build:accel first');
  }
  var packageInfo = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
  var esonPackage = JSON.parse(readFileSync(join(esonRoot, 'package.json'), 'utf8'));
  var facadePath = join(DIST, 'ESLOG.facade.jsx');
  var facade = readFileSync(join(DIST, 'ESLOG.jsx'), 'utf8') +
    '\n// ESLOG.facade.jsx - loader-free ESLOG global activation for ESPACK v2 composition\n';
  writeFileSync(facadePath, facade, 'utf8');

  var buildApi = await import(new URL('../espack/espack-build.mjs', import.meta.url).href);
  var mergeApi = await import(new URL('../espack/espack-merge.mjs', import.meta.url).href);
  var librariesApi = await import(new URL('../espack/espack-libraries.mjs', import.meta.url).href);
  var library = librariesApi.libraryFromFile({
    id: 'eslog',
    version: packageInfo.version,
    global: 'ESLOG',
    path: facadePath,
    requires: [{ id: 'eson', range: '^' + esonPackage.version }],
    contract: [
      { name: 'createLogger', type: 'function' },
      { name: 'createMemorySink', type: 'function' },
      { name: 'createJsonlSink', type: 'function' }
    ],
    provenance: {
      package: packageInfo.name,
      repository: packageInfo.repository && packageInfo.repository.url,
      commit: gitHead(),
      artifact: 'dist/ESLOG.facade.jsx'
    }
  });
  var ownManifest = buildApi.makeManifest({
    bundleName: 'eslog',
    cacheDir: '',
    payloads: [],
    accel: null,
    libraries: [library],
    entries: [{ id: 'eslog', range: '=' + packageInfo.version }]
  });
  var composed = mergeApi.merge({
    manifests: [esonManifest, ownManifest],
    out: join(DIST, 'ESLOG.accel.jsx'),
    manifestOut: join(DIST, 'ESLOG.manifest.json'),
    name: 'eslog',
    entries: [{ id: 'eslog', range: '=' + packageInfo.version }],
    deferB64: true
  });
  estcCheck('dist/ESLOG.facade.jsx');
  estcCheck('dist/ESLOG.accel.jsx');
  assertNoDescriptorModuleHelpers(join(DIST, 'ESLOG.facade.jsx'));
  assertNoDescriptorModuleHelpers(join(DIST, 'ESLOG.accel.jsx'));
  minifyComposed(composed.text);
}

buildExtendscript('./extendscript.estc.config.mjs');
buildExtendscript('./extendscript.vendor.estc.config.mjs');
assertNoDescriptorModuleHelpers(join(DIST, 'ESLOG.jsx'));
assertNoDescriptorModuleHelpers(join(DIST, 'vendor-eslog.js'));
await buildComposition();
console.log('[eslog-build] wrote standalone and ESPACK v2 composed ExtendScript artifacts');
