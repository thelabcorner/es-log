import { LogField, LogFormat, LogRecord, LogValue } from './types';

declare var ESON: { stringify(value: any): string | undefined };

function stringifyJson(value: any): string {
  if (typeof ESON === 'undefined' || ESON === null || typeof ESON.stringify !== 'function') {
    throw new Error('ESLOG: ESON.stringify must be loaded before JSON/JSONL serialization');
  }
  var result = ESON.stringify(value);
  if (typeof result !== 'string') {
    throw new Error('ESLOG: ESON.stringify did not return a JSON string');
  }
  return result;
}

export function quoteJsonString(value: string): string {
  return stringifyJson(value);
}

export function renderJsonValue(value: LogValue): string {
  return stringifyJson(value);
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
