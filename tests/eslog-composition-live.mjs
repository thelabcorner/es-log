#!/usr/bin/env node
// Proves ESLOG's ESPACK v2 artifact owns its complete transitive activation:
// ESB64 -> ESON -> ESLOG. No sibling preload is permitted in this harness.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createComToolRunner } from '../../extendscript-toolchain/src/comtool-compat.mjs';

var ROOT = dirname(fileURLToPath(import.meta.url));
var PROJECT = join(ROOT, '..');
var BUNDLE = join(PROJECT, 'dist', 'ESLOG.accel.jsx');
var COM = createComToolRunner();

function fail(message) {
  console.error('[eslog-composition-live] FAIL: ' + message);
  process.exitCode = 1;
}

function sha256(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

if (!existsSync(BUNDLE)) {
  fail('build first: ' + BUNDLE + ' missing');
} else {
  try {
    var status = await COM.run(['status']);
    if (!status.ok || !status.result) {
      console.log('[eslog-composition-live] SKIP: Illustrator is not reachable through COMTool V2');
      process.exitCode = 2;
    } else {
      var path = BUNDLE.replace(/\\/g, '/').replace(/"/g, '\\"');
      var code = [
        'var g = $.global;',
        'g.ESLOG = null;',
        'g.ESON = null;',
        'g.ESB64 = null;',
        'g.ESPAK = null;',
        'g.__ESPAK_LIBRARIES__ = null;',
        '$.evalFile(File("' + path + '"));',
        'var api = g.ESLOG;',
        'var eson = g.ESON;',
        'var b64 = g.ESB64;',
        'var esp = g.ESPAK;',
        'var mem = api.createMemorySink(4);',
        'var logger = api.createLogger({ format: "jsonl", sinks: [mem], clock: function(){ return 1700000000000; } });',
        'logger.warn("hello", [{ key: "z", value: 2 }, { key: "a", value: "ok" }]);',
        'var entry = mem.getEntries()[0];',
        'var libs = esp.libraryList ? esp.libraryList() : esp.libraries;',
        'var order = [];',
        'var i;',
        'for (i = 0; i < libs.length; i++) order[order.length] = libs[i].id + "@" + libs[i].version;',
        'return {',
        '  host: app.version, engine: $.version,',
        '  eslog: !!api && typeof api.createLogger === "function",',
        '  eson: !!eson && typeof eson.stringify === "function",',
        '  esb64: !!b64 && typeof b64.atob === "function",',
        '  control: !!esp && esp.supportsLibraryComposition === true,',
        '  order: order,',
        '  jsonl: entry && entry.text,',
        '  sorted: entry && entry.record && entry.record.fields[0].key === "a" && entry.record.fields[1].key === "z",',
        '  esonNative: !!eson.espack && eson.espack.ok === true',
        '};'
      ].join('\n');
      var result = await COM.run(['eval', '--code', code], { timeoutMs: 180000 });
      if (!result.ok || !result.result) {
        fail('COMTool V2 evaluation failed: ' + JSON.stringify(result));
      } else {
        var r = result.result;
        var expected = ['esb64@1.3.0', 'eson@1.3.0', 'eslog@0.2.0'];
        var checks = [
          r.eslog === true,
          r.eson === true,
          r.esb64 === true,
          r.control === true,
          r.sorted === true,
          r.esonNative === true,
          r.order.join(',') === expected.join(','),
          typeof r.jsonl === 'string' && r.jsonl.indexOf('"message":"hello"') >= 0
        ];
        if (checks.some(function (v) { return !v; })) {
          fail('live composition mismatch: ' + JSON.stringify(r));
        } else {
          var evidenceDir = join(PROJECT, 'evidence');
          mkdirSync(evidenceDir, { recursive: true });
          writeFileSync(join(evidenceDir, 'latest-composition-live.json'), JSON.stringify({
            schemaVersion: 1,
            kind: 'eslog-composition-live',
            capturedAt: new Date().toISOString(),
            transport: 'ESTC COMTool V2 Node SDK',
            artifact: {
              file: 'dist/ESLOG.accel.jsx',
              sha256: sha256(BUNDLE)
            },
            illustrator: r.host,
            extendScript: r.engine,
            activationOrder: r.order,
            esonNative: r.esonNative === true,
            result: 'PASS'
          }, null, 2) + '\n');
          console.log(
            '[eslog-composition-live] PASS ESB64 -> ESON -> ESLOG on Illustrator ' +
            r.host + ' / ExtendScript ' + r.engine
          );
        }
      }
    }
  } finally {
    await COM.close().catch(function () {});
  }
}