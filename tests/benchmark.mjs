#!/usr/bin/env node
// Node reference only. This does not select ExtendScript buffering behavior.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

var core = await import(pathToFileURL(resolve('dist/eslog-core.esm.mjs')).href);
var samples = 9;
var warmups = 3;
function median(values) {
  var sorted = values.slice().sort(function (a, b) { return a - b; });
  return sorted[Math.floor(sorted.length / 2)];
}
function measure(fn) {
  var i = 0;
  for (i = 0; i < warmups; i++) { fn(); }
  var values = [];
  for (i = 0; i < samples; i++) {
    var start = process.hrtime.bigint();
    fn();
    values[i] = Number(process.hrtime.bigint() - start) / 1000;
  }
  return median(values);
}
function buildByString(piece, count) {
  var output = '';
  var i = 0;
  for (i = 0; i < count; i++) { output = output + piece; }
  return output;
}
function buildByArray(piece, count) {
  var output = [];
  var i = 0;
  for (i = 0; i < count; i++) { output[output.length] = piece; }
  return output.join('');
}

console.log('[eslog-benchmark] Node ' + process.version + ' | median of ' + samples + ' samples | ' + warmups + ' warmups');
console.log('targetChars pieceChars repeats stringBatchUs arrayJoinBatchUs array/string');
var targetSizes = [256, 1024, 4096, 16384];
var pieceSizes = [1, 16];
var si = 0;
var pi = 0;
for (si = 0; si < targetSizes.length; si++) {
  for (pi = 0; pi < pieceSizes.length; pi++) {
    var target = targetSizes[si];
    var pieceSize = pieceSizes[pi];
    var piece = 'abcdefghijklmnop'.substring(0, pieceSize);
    var count = Math.ceil(target / pieceSize);
    var repeats = 1;
    var checksum = 0;
    var stringUs = measure(function () {
      var j = 0;
      for (j = 0; j < repeats; j++) { checksum += buildByString(piece, count).length; }
    });
    var arrayUs = measure(function () {
      var j = 0;
      for (j = 0; j < repeats; j++) { checksum += buildByArray(piece, count).length; }
    });
    console.log(target + ' ' + pieceSize + ' ' + repeats + ' ' + stringUs.toFixed(2) + ' ' + arrayUs.toFixed(2) + ' ' + (arrayUs / stringUs).toFixed(2) + 'x');
  }
}

var sinkCalls = 0;
var clockCalls = 0;
var sinks = [];
var sinkIndex = 0;
for (sinkIndex = 0; sinkIndex < 4; sinkIndex++) {
  sinks[sinkIndex] = core.createCustomSink(function () { sinkCalls++; });
}
var filteredLogger = core.createLogger({
  threshold: 'error',
  sinks: sinks,
  clock: function () { clockCalls++; return 1; }
});
var enabled0Sink = core.createLogger({
  sinks: [],
  clock: function () { clockCalls++; return 1; }
});
var enabled4Sinks = core.createLogger({
  sinks: sinks,
  clock: function () { clockCalls++; return 1; }
});
var logLoops = 20000;
var filteredBatchUs = measure(function () {
  var i = 0;
  for (i = 0; i < logLoops; i++) { filteredLogger.info('filtered'); }
});
var enabled0BatchUs = measure(function () {
  var i = 0;
  for (i = 0; i < logLoops; i++) { enabled0Sink.info('enabled'); }
});
var enabled4BatchUs = measure(function () {
  var i = 0;
  for (i = 0; i < logLoops; i++) { enabled4Sinks.info('enabled'); }
});
console.log('direct info() Node lane: filtered=' + filteredBatchUs.toFixed(3) + ' us/batch (' +
  (filteredBatchUs / logLoops).toFixed(3) + ' us/call), enabled0Sink=' + enabled0BatchUs.toFixed(3) +
  ' us/batch, enabled4Sinks=' + enabled4BatchUs.toFixed(3) + ' us/batch (' + sinkCalls + ' writes)');
console.log('checksum=' + checksum + ' clockCalls=' + clockCalls + ' | Node is a reference lane; run npm run benchmark:engine for Illustrator evidence.');
