import { LogField, LogFormat, LogRecord, LogValue } from './types';

var ESCAPABLE = /["\\\x00-\x1f\u2028\u2029\ud800-\udfff]/g;
var HEX = '0123456789abcdef';

function hex4(code: number): string {
  var a = Math.floor(code / 4096);
  var rest = code - a * 4096;
  var b = Math.floor(rest / 256);
  rest = rest - b * 256;
  var c = Math.floor(rest / 16);
  var d = rest - c * 16;
  return HEX.charAt(a) + HEX.charAt(b) + HEX.charAt(c) + HEX.charAt(d);
}

function escapeUnit(unit: string): string {
  var code = unit.charCodeAt(0);
  if (code === 34) {
    return '\\"';
  }
  if (code === 92) {
    return '\\\\';
  }
  if (code === 8) {
    return '\\b';
  }
  if (code === 9) {
    return '\\t';
  }
  if (code === 10) {
    return '\\n';
  }
  if (code === 12) {
    return '\\f';
  }
  if (code === 13) {
    return '\\r';
  }
  return '\\u' + hex4(code);
}

export function quoteJsonString(value: string): string {
  var replacer: any = escapeUnit;
  return '"' + value.replace(ESCAPABLE, replacer) + '"';
}

export function renderJsonValue(value: LogValue): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string') {
    return quoteJsonString(value);
  }
  if (typeof value === 'boolean') {
    if (value) {
      return 'true';
    }
    return 'false';
  }
  if (value === 0) {
    return '0';
  }
  return String(value);
}

function renderFields(fields: LogRecord['fields']): string {
  var output = '{';
  var i = 0;
  for (i = 0; i < fields.length; i++) {
    if (i > 0) {
      output = output + ',';
    }
    var field: LogField = fields[i];
    output = output + quoteJsonString(field.key) + ':' + renderJsonValue(field.value);
  }
  return output + '}';
}

export function renderRecord(record: LogRecord, format: LogFormat): string {
  if (format === 'jsonl') {
    return '{"timestamp":' + String(record.timestamp) +
      ',"level":' + quoteJsonString(record.level) +
      ',"message":' + quoteJsonString(record.message) +
      ',"fields":' + renderFields(record.fields) + '}' + '\n';
  }
  var output = String(record.timestamp) + ' ' + record.level.toUpperCase() + ' ' + quoteJsonString(record.message);
  var i = 0;
  for (i = 0; i < record.fields.length; i++) {
    var field: LogField = record.fields[i];
    output = output + ' ' + quoteJsonString(field.key) + '=' + renderJsonValue(field.value);
  }
  return output + '\n';
}
