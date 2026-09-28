#!/usr/bin/env node
// Node ESM core plus the canonical ESTC-generated ExtendScript entrypoints.
import { execFileSync } from 'node:child_process';
import { buildSync } from 'esbuild';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = dirname(fileURLToPath(import.meta.url));
var DIST = join(ROOT, 'dist');
var ENTRY = join(ROOT, 'src', 'index.ts');
var ESTC = join(ROOT, '..', 'extendscript-toolchain', 'bin', 'estc.mjs');

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

buildExtendscript('./extendscript.estc.config.mjs');
buildExtendscript('./extendscript.vendor.estc.config.mjs');
assertNoDescriptorModuleHelpers(join(DIST, 'ESLOG.jsx'));
assertNoDescriptorModuleHelpers(join(DIST, 'vendor-eslog.js'));
console.log('[eslog-build] wrote Node core and ESTC-validated ExtendScript artifacts');
