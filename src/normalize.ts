import { LogField, LogFields, LogMessage, LogPrimitive, LogValue } from './types';

export var MAX_SINKS = 16;
export var MAX_FIELDS = 16;
export var MAX_FIELD_KEY_LENGTH = 64;
export var MAX_FIELD_STRING_LENGTH = 256;
export var MAX_MESSAGE_LENGTH = 8192;
export var MAX_FORMAT_ARGUMENTS = 16;

export function isFiniteNumber(value: number): boolean {
  if (typeof value !== 'number') {
    return false;
  }
  if (value !== value) {
    return false;
  }
  if (value - value !== 0) {
    return false;
  }
  return true;
}

export function truncateString(value: string, limit: number): string {
  if (value.length <= limit) {
    return value;
  }
  if (limit <= 3) {
    return value.substring(0, limit);
  }
  var end = limit - 3;
  if (end > 0) {
    var last = value.charCodeAt(end - 1);
    if (last >= 55296 && last <= 56319) {
      end--;
    }
  }
  return value.substring(0, end) + '...';
}

export function normalizeMessage(value: LogMessage): string {
  if (typeof value === 'string') {
    return truncateString(value, MAX_MESSAGE_LENGTH);
  }
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return truncateString(String(value), MAX_MESSAGE_LENGTH);
  }
  throw new Error('ESLOG: message must be a string, number, boolean, or null');
}

function normalizeFieldValue(value: LogValue): LogValue {
  if (value === null || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return truncateString(value, MAX_FIELD_STRING_LENGTH);
  }
  if (typeof value === 'number') {
    if (!isFiniteNumber(value)) {
      return null;
    }
    if (value === 0) {
      return 0;
    }
    return value;
  }
  throw new Error('ESLOG: field values must be JSON scalar primitives');
}

function normalizeFieldKey(key: string): string {
  if (typeof key !== 'string') {
    throw new Error('ESLOG: field keys must be strings');
  }
  if (key.length === 0 || key.length > MAX_FIELD_KEY_LENGTH) {
    throw new Error('ESLOG: field keys must contain 1 to ' + MAX_FIELD_KEY_LENGTH + ' code units');
  }
  var i = 0;
  for (i = 0; i < key.length; i++) {
    if (key.charCodeAt(i) === 0) {
      throw new Error('ESLOG: field keys must not contain U+0000');
    }
  }
  return key;
}

export function resolveFields(input: LogFields | (() => LogFields) | undefined): LogFields | undefined {
  if (typeof input === 'function') {
    return input();
  }
  return input;
}

export function normalizeFields(input: LogFields | undefined): LogField[] {
  var output: LogField[] = [];
  if (input === undefined || input === null) {
    return output;
  }
  var count = input.length;
  if (typeof count !== 'number' || count < 0 || count > MAX_FIELDS || Math.floor(count) !== count) {
    throw new Error('ESLOG: fields must be a plain array with at most ' + MAX_FIELDS + ' entries');
  }
  var i = 0;
  for (i = 0; i < count; i++) {
    var source = input[i];
    if (source === null || source === undefined || typeof source !== 'object') {
      throw new Error('ESLOG: each field must be a caller-owned { key, value } record');
    }
    var key = normalizeFieldKey(source.key);
    var value = normalizeFieldValue(source.value);
    var normalized: LogField = { key: key, value: value };
    var insertion = output.length;
    while (insertion > 0) {
      var previous = output[insertion - 1];
      if (previous.key === key) {
        throw new Error('ESLOG: duplicate field key: ' + key);
      }
      if (previous.key < key) {
        break;
      }
      output[insertion] = previous;
      insertion--;
    }
    output[insertion] = normalized;
  }
  return output;
}

function primitiveText(value: LogPrimitive): string {
  if (value === null) {
    return 'null';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  throw new Error('ESLOG: format arguments must be scalar primitives');
}

export function formatMessage(template: string, args: Array<LogPrimitive>): string {
  if (typeof template !== 'string') {
    throw new Error('ESLOG: format template must be a string');
  }
  if (args === undefined || args === null) {
    args = [];
  }
  var count = args.length;
  if (typeof count !== 'number' || count < 0 || count > MAX_FORMAT_ARGUMENTS || Math.floor(count) !== count) {
    throw new Error('ESLOG: format arguments must be a plain array with at most ' + MAX_FORMAT_ARGUMENTS + ' entries');
  }
  var output = '';
  var cursor = 0;
  var i = 0;
  for (i = 0; i < count; i++) {
    var marker = template.indexOf('{}', cursor);
    if (marker < 0) {
      break;
    }
    var head = template.substring(cursor, marker);
    var remaining = MAX_MESSAGE_LENGTH - output.length;
    if (remaining > 0) {
      output = output + truncateString(head, remaining);
    }
    if (output.length >= MAX_MESSAGE_LENGTH) {
      return truncateString(output, MAX_MESSAGE_LENGTH);
    }
    var part = primitiveText(args[i]);
    remaining = MAX_MESSAGE_LENGTH - output.length;
    if (remaining > 0) {
      output = output + truncateString(part, remaining);
    }
    if (output.length >= MAX_MESSAGE_LENGTH) {
      return truncateString(output, MAX_MESSAGE_LENGTH);
    }
    cursor = marker + 2;
  }
  var tail = template.substring(cursor);
  var tailRoom = MAX_MESSAGE_LENGTH - output.length;
  if (tailRoom > 0) {
    output = output + truncateString(tail, tailRoom);
  }
  return truncateString(output, MAX_MESSAGE_LENGTH);
}
