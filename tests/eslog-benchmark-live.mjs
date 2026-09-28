#!/usr/bin/env node
// Illustrator-only string-vs-array and logger benchmark via COMTool V2.
// Samples execute inside the engine; COM transport is outside timed regions.
import { createComToolRunner } from '../../extendscript-toolchain/src/comtool-compat.mjs';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = dirname(fileURLToPath(import.meta.url));
var PROJECT = join(ROOT, '..');
var VENDOR = join(PROJECT, 'dist', 'vendor-eslog.js');
var PROBE = join(ROOT, '.eslog-benchmark-probe.jsx');
var COM = createComToolRunner();

async function runTool(args) {
  try { return await COM.runText(args, { timeoutMs: 300000 }); }
  catch (error) { return null; }
}
function skip(reason) {
  console.log('[eslog-benchmark:engine] PENDING: ' + reason);
  process.exitCode = 2;
}

if (!existsSync(VENDOR)) {
  console.error('[eslog-benchmark:engine] build first (npm run build)');
  process.exitCode = 1;
} else {
  var statusText = await runTool(['status', '--no-launch']);
  var status;
  try { status = statusText === null ? null : JSON.parse(statusText.trim()); }
  catch (error) { status = null; }
  if (!status || !status.ok || !status.result) {
    skip('COMTool V2/Illustrator is unavailable without launch permission');
  } else {
    var vendorPath = VENDOR.replace(/\\/g, '/').replace(/"/g, '\\"');
    var source = [
      '#target illustrator',
      '$.global["ESLOG"] = null;',
      '$.evalFile(File("' + vendorPath + '"));',
      'var api = $.global["ESLOG"];',
      'var report = { host: app.name + " " + app.version, engine: $.version, rows: [] };',
      'function buildString(piece, count) { var out = ""; var i; for (i = 0; i < count; i++) { out = out + piece; } return out; }',
      'function buildArray(piece, count) { var out = []; var i; for (i = 0; i < count; i++) { out[out.length] = piece; } return out.join(""); }',
      'function runCandidate(arrayMode, piece, count, repeat) { var i; var result = ""; for (i = 0; i < repeat; i++) { if (arrayMode) { result = buildArray(piece, count); } else { result = buildString(piece, count); } } return result.length; }',
      'function measure(arrayMode, piece, count, repeat) { var i; var samples = []; for (i = 0; i < 2; i++) { $.hiresTimer; runCandidate(arrayMode, piece, count, repeat); $.hiresTimer; } for (i = 0; i < 9; i++) { $.hiresTimer; runCandidate(arrayMode, piece, count, repeat); samples[i] = $.hiresTimer; } return samples; }',
      'var sizes = [256, 1024, 4096];',
      'var pieces = [1, 16];',
      'var si; var pi;',
      'for (si = 0; si < sizes.length; si++) { for (pi = 0; pi < pieces.length; pi++) { var pieceSize = pieces[pi]; var count = sizes[si] / pieceSize; var piece = "abcdefghijklmnop".substring(0, pieceSize); var repeat = Math.max(1, Math.floor(4096 / sizes[si])); var row = { target: sizes[si], piece: pieceSize, repeat: repeat, string: measure(false, piece, count, repeat), array: measure(true, piece, count, repeat) }; report.rows[report.rows.length] = row; } }',
      'var sink = api.createCustomSink(function () {});',
      'var enabled = api.createLogger({ sinks: [sink], clock: function () { return 1; } });',
      'var disabled = api.createLogger({ threshold: "error", sinks: [sink], clock: function () { return 1; } });',
      'function logSamples(log, level) { var samples = []; var i; var j; for (i = 0; i < 2; i++) { $.hiresTimer; for (j = 0; j < 2000; j++) { log[level]("message"); } $.hiresTimer; } for (i = 0; i < 9; i++) { $.hiresTimer; for (j = 0; j < 2000; j++) { log[level]("message"); } samples[i] = $.hiresTimer; } return samples; }',
      'report.disabled = logSamples(disabled, "info");',
      'report.enabled = logSamples(enabled, "info");',
      'report;'
    ].join('\n');
    writeFileSync(PROBE, source, 'utf8');
    try {
      var output = await runTool(['eval', '--file', PROBE.replace(/\\/g, '/')]);
      if (output === null) {
        skip('COMTool V2 eval failed');
      } else {
        var envelope;
        try { envelope = JSON.parse(output.trim()); }
        catch (error) { envelope = null; }
        var result = envelope && envelope.result && (envelope.result.result || envelope.result);
        if (!envelope || !envelope.ok || !result || !result.rows) {
          skip('COMTool V2 did not return benchmark samples');
        } else {
          function median(values) {
            var sorted = values.slice().sort(function (a, b) { return a - b; });
            return sorted[Math.floor(sorted.length / 2)];
          }
          console.log('[eslog-benchmark:engine] ' + result.host + ' / ExtendScript ' + result.engine + ' | $.hiresTimer delta samples, 2 warmups + 9 samples');
          console.log('targetChars pieceChars repeat stringMedianUs arrayJoinMedianUs array/string');
          var i = 0;
          for (i = 0; i < result.rows.length; i++) {
            var row = result.rows[i];
            var stringUs = median(row.string);
            var arrayUs = median(row.array);
            console.log(row.target + ' ' + row.piece + ' ' + row.repeat + ' ' + stringUs.toFixed(2) + ' ' + arrayUs.toFixed(2) + ' ' + (arrayUs / stringUs).toFixed(2) + 'x');
          }
          console.log('logger info disabled: ' + median(result.disabled).toFixed(2) + ' us / 2000 calls');
          console.log('logger info enabled:  ' + median(result.enabled).toFixed(2) + ' us / 2000 calls');
          console.log('Timing excludes COM transport; $.hiresTimer was primed before every sample.');
        }
      }
    } finally {
      try { unlinkSync(PROBE); } catch (error) {}
    }
  }
}

await COM.close();
