#!/usr/bin/env node
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

var iterations = Number(process.argv[2] || 20000);
var seed = Number(process.argv[3] || 0x5e10);
if (!Number.isInteger(iterations) || iterations < 1 || iterations > 1000000) {
  throw new Error('iterations must be an integer in [1, 1000000]');
}
var core = await import(pathToFileURL(resolve('dist/eslog-core.esm.mjs')).href);
var eson = await import(pathToFileURL(resolve('../eson/dist/eson-core.esm.mjs')).href);
eson.install({ json2Source: readFileSync(resolve('../eson/vendor/json2.raw.js'), 'utf8') });
globalThis.ESON = eson;
var current = seed >>> 0;
function next() {
  current = (Math.imul(current, 1664525) + 1013904223) >>> 0;
  return current;
}
function pick(max) { return next() % max; }
function randomString(maxLength) {
  var length = pick(maxLength + 1);
  var output = '';
  var i = 0;
  for (i = 0; i < length; i++) {
    var code = pick(65536);
    output = output + String.fromCharCode(code);
  }
  return output;
}

var records = 0;
var memory = core.createMemorySink(1);
var logger = core.createLogger({
  format: 'jsonl',
  sinks: [memory],
  clock: function () { return 1700000000000; }
});
var i = 0;
for (i = 0; i < iterations; i++) {
  var message = randomString(96);
  var fields = [];
  var fieldCount = pick(6);
  var j = 0;
  for (j = 0; j < fieldCount; j++) {
    var kind = pick(4);
    var value;
    if (kind === 0) { value = randomString(48); }
    else if (kind === 1) { value = next() / 65536; }
    else if (kind === 2) { value = (next() & 1) === 1; }
    else { value = null; }
    fields[j] = { key: 'k' + j, value: value };
  }
  logger.info(message, fields);
  var actual = JSON.parse(memory.getEntries()[0].text);
  assert.equal(actual.message, message);
  assert.equal(actual.timestamp, 1700000000000);
  assert.equal(actual.level, 'info');
  for (j = 0; j < fields.length; j++) {
    var expected = fields[j].value;
    if (typeof expected === 'number' && !Number.isFinite(expected)) { expected = null; }
    assert.deepEqual(actual.fields[fields[j].key], expected);
  }
  records++;
}
console.log('[eslog-fuzz] ' + records + ' seeded JSONL records parsed by Node JSON.parse; seed=0x' + seed.toString(16));
