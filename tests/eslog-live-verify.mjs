#!/usr/bin/env node
// Real-engine behavior probe through the COMTool V2 runner; never launches Illustrator.
import { createComToolRunner } from '../../extendscript-toolchain/src/comtool-compat.mjs';
import { existsSync, unlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

var ROOT = dirname(fileURLToPath(import.meta.url));
var PROJECT = join(ROOT, '..');
var VENDOR = join(PROJECT, 'dist', 'vendor-eslog.js');
var PROBE = join(ROOT, '.eslog-live-probe.jsx');
var COM = createComToolRunner();

async function runTool(args) {
  try { return await COM.runText(args, { timeoutMs: 180000 }); }
  catch (error) { return null; }
}

function skip(reason) {
  console.log('[eslog-live-verify] SKIP: ' + reason);
  process.exitCode = 2;
}

if (!existsSync(VENDOR)) {
  console.error('[eslog-live-verify] build first (npm run build)');
  process.exitCode = 1;
} else {
  var statusText = await runTool(['status', '--no-launch']);
  if (statusText === null) {
    skip('COMTool V2 could not query a running Illustrator instance');
  } else {
    var status;
    try { status = JSON.parse(statusText.trim()); }
    catch (error) { status = null; }
    if (!status || !status.ok || !status.result) {
      skip('Illustrator status is unavailable without launch permission');
    } else {
      var vendorPath = VENDOR.replace(/\\/g, '/').replace(/"/g, '\\"');
      var probe = [
        '#target illustrator',
        '$.global["ESLOG"] = null;',
        '$.evalFile(File("' + vendorPath + '"));',
        'var api = $.global["ESLOG"];',
        'var report = { engine: $.version, host: app.name + " " + app.version };',
        'var mem = api.createMemorySink(4);',
        'var timeCalls = 0;',
        'var infoCalls = 0;',
        'var appendCalls = 0;',
        'var appendText = "";',
        'var observed = null;',
        'var custom = api.createCustomSink(function (record, text) { observed = { record: record, text: text }; });',
        'var logger = api.createLogger({ threshold: "warn", format: "jsonl", clock: function () { timeCalls++; return 1700000000000; }, sinks: [custom, mem] });',
        'logger.logLazy("info", function () { infoCalls++; return "filtered"; }, function () { infoCalls++; return []; });',
        'logger.warn("quoted \\" and NUL \\u0000 line\\n", [{ key: "z", value: 2 }, { key: "a", value: "ok" }]);',
        'var entries = mem.getEntries();',
        'var entry = entries[0];',
        'var append = api.createJsonlAppendSink({ append: function (path, text) { appendCalls++; appendText = path + "|" + text; } }, "events.jsonl");',
        'var appendLogger = api.createLogger({ format: "jsonl", sinks: [append], clock: function () { return 5; } });',
        'appendLogger.error("appended");',
        'var continued = 0;',
        'var isolated = api.createLogger({ sinks: [api.createCustomSink(function () { throw "sink-failure"; }), api.createCustomSink(function () { continued++; })], clock: function () { return 6; } });',
        'isolated.error("isolation");',
        'var fail = isolated.getLastSinkErrors();',
        'report.global = typeof api.createLogger === "function";',
        'report.filteredNoWork = timeCalls === 1 && infoCalls === 0;',
        'report.oneTimestamp = timeCalls === 1;',
        'report.sharedRecord = entry.record === observed.record;',
        'report.sharedText = entry.text === observed.text;',
        'report.sortedFields = entry.record.fields[0].key === "a" && entry.record.fields[1].key === "z";',
        'report.escapedNulAndNewline = entry.text.indexOf("\\\\u0000") >= 0 && entry.text.indexOf("\\\\n") >= 0;',
        'report.appendOnce = appendCalls === 1 && appendText.indexOf("events.jsonl|") === 0;',
        'report.errorIsolation = continued === 1 && fail.length === 1 && fail[0].message === "sink-failure";',
        'report;'
      ].join('\n');
      writeFileSync(PROBE, probe, 'utf8');
      try {
        var output = await runTool(['eval', '--file', PROBE.replace(/\\/g, '/')]);
        if (output === null) {
          skip('COMTool V2 eval did not return an engine result');
        } else {
          var envelope;
          try { envelope = JSON.parse(output.trim()); }
          catch (error) { envelope = null; }
          var result = envelope && envelope.result && (envelope.result.result || envelope.result);
          if (!envelope || !envelope.ok || !result) {
            skip('COMTool V2 returned an unavailable engine result');
          } else {
            var failed = [];
            var keys = ['global', 'filteredNoWork', 'oneTimestamp', 'sharedRecord', 'sharedText', 'sortedFields', 'escapedNulAndNewline', 'appendOnce', 'errorIsolation'];
            var i = 0;
            for (i = 0; i < keys.length; i++) {
              if (result[keys[i]] !== true) { failed[failed.length] = keys[i]; }
            }
            if (failed.length > 0) {
              console.error('[eslog-live-verify] FAIL ' + failed.join(', ') + ' on ' + result.host + ' / ' + result.engine);
              process.exitCode = 1;
            } else {
              console.log('[eslog-live-verify] ' + keys.length + '/' + keys.length + ' checks passed on ' + result.host + ' / ExtendScript ' + result.engine);
            }
          }
        }
      } finally {
        try { unlinkSync(PROBE); } catch (error) {}
      }
    }
  }
}

await COM.close();
