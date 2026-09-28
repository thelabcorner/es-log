#!/usr/bin/env node
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

var core = await import(pathToFileURL(resolve('dist/eslog-core.esm.mjs')).href);
var cases = 0;
function test(name, fn) {
  fn();
  cases++;
  console.log('  ok ' + name);
}

test('filtered calls do no message, fields, clock, or sink work', function () {
  var clockCalls = 0;
  var sinkCalls = 0;
  var messageCalls = 0;
  var fieldCalls = 0;
  var logger = core.createLogger({
    threshold: 'error',
    clock: function () { clockCalls++; return 100; },
    sinks: [core.createCustomSink(function () { sinkCalls++; })]
  });
  var poisoned = new Proxy({}, { get: function () { throw new Error('unexpected read'); } });
  logger.debug(poisoned);
  logger.logLazy('info', function () { messageCalls++; return 'not emitted'; }, function () {
    fieldCalls++;
    return [];
  });
  logger.logf('info', poisoned, poisoned, poisoned);
  assert.equal(clockCalls, 0);
  assert.equal(sinkCalls, 0);
  assert.equal(messageCalls, 0);
  assert.equal(fieldCalls, 0);
});

test('enabled path normalizes once and shares one record and text', function () {
  var clockCalls = 0;
  var messageCalls = 0;
  var fieldCalls = 0;
  var observed;
  var memory = core.createMemorySink(4);
  var custom = core.createCustomSink(function (record, text) {
    observed = { record: record, text: text };
  });
  var logger = core.createLogger({
    format: 'jsonl',
    clock: function () { clockCalls++; return 42; },
    sinks: [custom, memory]
  });
  logger.logLazy('info', function () { messageCalls++; return 'one'; }, function () {
    fieldCalls++;
    return [{ key: 'z', value: 2 }, { key: 'a', value: 'first' }];
  });
  var entry = memory.getEntries()[0];
  assert.equal(clockCalls, 1);
  assert.equal(messageCalls, 1);
  assert.equal(fieldCalls, 1);
  assert.strictEqual(entry.record, observed.record);
  assert.strictEqual(entry.text, observed.text);
  assert.deepEqual(entry.record.fields.map(function (field) { return field.key; }), ['a', 'z']);
});

test('JSONL escapes control characters and parses deterministically', function () {
  var memory = core.createMemorySink();
  var logger = core.createLogger({
    format: 'jsonl',
    clock: function () { return 1700000000000; },
    sinks: [memory]
  });
  logger.info('quote " slash \\ NUL \u0000 line\n', [
    { key: 'control', value: '\u0001\u2028' },
    { key: 'finite', value: 1.25 },
    { key: 'bad-number', value: Infinity }
  ]);
  var text = memory.getEntries()[0].text;
  var parsed = JSON.parse(text);
  assert.equal(parsed.message, 'quote " slash \\ NUL \u0000 line\n');
  assert.deepEqual(parsed.fields, { 'bad-number': null, control: '\u0001\u2028', finite: 1.25 });
  assert.equal(text.charAt(text.length - 1), '\n');
  assert.equal(JSON.stringify(parsed), JSON.stringify(JSON.parse(text)));
});

test('text rendering remains one physical line and quotes fields', function () {
  var received = '';
  var logger = core.createLogger({
    clock: function () { return 7; },
    sinks: [core.createTextSink(function (text) { received = text; })]
  });
  logger.warn('first\nsecond\u0000', [{ key: 'a b', value: 'x\ry' }]);
  assert.equal(received.split('\n').length, 2);
  assert.match(received, /first\\nsecond\\u0000/);
  assert.match(received, /"a b"="x\\ry"/);
});

test('format interpolation is lazy and capped', function () {
  var memory = core.createMemorySink();
  var logger = core.createLogger({ threshold: 'warn', clock: function () { return 1; }, sinks: [memory] });
  var argumentsRead = 0;
  var args = new Proxy(['ok'], {
    get: function (target, key) {
      if (key === 'length' || key === '0') { argumentsRead++; }
      return Reflect.get(target, key);
    }
  });
  logger.logf('info', '{}', args);
  assert.equal(argumentsRead, 0);
  logger.logf('warn', 'doc={} state={}', ['A', 2]);
  assert.equal(memory.getEntries()[0].record.message, 'doc=A state=2');
  assert.throws(function () { logger.logf('error', '{}', [{}]); }, /scalar primitives/);
});

test('sink failures are isolated and diagnostics stay bounded', function () {
  var delivered = 0;
  var logger = core.createLogger({
    sinks: [
      core.createCustomSink(function () { throw { get message() { throw new Error('must not inspect'); } }; }),
      core.createCustomSink(function () { delivered++; })
    ],
    clock: function () { return 1; }
  });
  logger.error('first');
  logger.error('second');
  assert.equal(delivered, 2);
  assert.deepEqual(logger.getLastSinkErrors(), [{ sinkIndex: 0, message: 'sink threw a non-string value' }]);
});

test('fanout and in-memory history are bounded', function () {
  assert.equal(core.maxFanout(), 16);
  var tooMany = [];
  var i = 0;
  for (i = 0; i < 17; i++) { tooMany[i] = core.createCustomSink(function () {}); }
  assert.throws(function () { core.createLogger({ sinks: tooMany }); }, /at most 16 sinks/);
  var memory = core.createMemorySink(2);
  var logger = core.createLogger({ sinks: [memory], clock: function () { return 0; } });
  logger.info('one');
  logger.info('two');
  logger.info('three');
  assert.deepEqual(memory.getEntries().map(function (entry) { return entry.record.message; }), ['two', 'three']);
  memory.clear();
  assert.equal(memory.getEntries().length, 0);
  assert.throws(function () { core.createMemorySink(4097); }, /capacity/);
});

test('append ports receive one complete text or JSONL line', function () {
  var calls = [];
  var io = { append: function (path, text) { calls[calls.length] = [path, text]; } };
  var textLogger = core.createLogger({ sinks: [core.createTextAppendSink(io, 'text.log')], clock: function () { return 3; } });
  textLogger.info('text');
  var jsonLogger = core.createLogger({
    format: 'jsonl',
    sinks: [core.createJsonlAppendSink(io, 'events.jsonl')],
    clock: function () { return 4; }
  });
  jsonLogger.info('event');
  assert.equal(calls.length, 2);
  assert.equal(calls[0][0], 'text.log');
  assert.match(calls[0][1], /INFO/);
  assert.equal(calls[1][0], 'events.jsonl');
  assert.equal(JSON.parse(calls[1][1]).message, 'event');
  assert.throws(function () {
    core.createLogger({ format: 'jsonl', sinks: [core.createTextAppendSink(io, 'bad.log')] });
  }, /format does not match/);
});

test('custom and ExtendScript console writers have no filesystem dependency', function () {
  var received = '';
  var sink = core.createExtendScriptConsoleSink(function (text) { received = text; });
  var logger = core.createLogger({ sinks: [sink], clock: function () { return 9; } });
  logger.info('console');
  assert.match(received, /console/);
  assert.equal(sink.format, 'text');
});

test('field keys are bounded, unique, NUL-free, and scalar-only', function () {
  var logger = core.createLogger({ sinks: [core.createMemorySink()], clock: function () { return 1; } });
  assert.throws(function () { logger.info('bad', [{ key: 'x\u0000y', value: 1 }]); }, /U\+0000/);
  assert.throws(function () { logger.info('bad', [{ key: 'x', value: 1 }, { key: 'x', value: 2 }]); }, /duplicate/);
  assert.throws(function () { logger.info('bad', [{ key: 'x', value: {} }]); }, /scalar primitives/);
  var excessive = [];
  var i = 0;
  for (i = 0; i < 17; i++) { excessive[i] = { key: 'k' + i, value: i }; }
  assert.throws(function () { logger.info('bad', excessive); }, /at most 16 entries/);
});

test('message and string field normalization respect their output caps', function () {
  var memory = core.createMemorySink(1);
  var logger = core.createLogger({ sinks: [memory], clock: function () { return 1; } });
  logger.info('m'.repeat(core.MAX_MESSAGE_LENGTH + 10), [
    { key: 'value', value: 'v'.repeat(core.MAX_FIELD_STRING_LENGTH + 10) }
  ]);
  var record = memory.getEntries()[0].record;
  assert.equal(record.message.length, core.MAX_MESSAGE_LENGTH);
  assert.equal(record.message.slice(-3), '...');
  assert.equal(record.fields[0].value.length, core.MAX_FIELD_STRING_LENGTH);
  assert.equal(record.fields[0].value.slice(-3), '...');
});

test('threshold setters and level checks are numeric and predictable', function () {
  var logger = core.createLogger({ sinks: [], threshold: 'warn' });
  assert.equal(logger.isEnabled('info'), false);
  assert.equal(logger.isEnabled('warn'), true);
  logger.setThreshold('off');
  assert.equal(logger.isEnabled('fatal'), false);
  assert.equal(logger.getThreshold(), 'off');
  assert.throws(function () { logger.log('unknown', 'bad'); }, /invalid log level/);
});

console.log('[eslog-test] ' + cases + ' case groups passed');
