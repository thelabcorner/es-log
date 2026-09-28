import { MAX_SINKS } from './normalize';
import {
  AppendSinkIO, LogFormat, LogRecord, LogSink, MemoryEntry, MemorySink,
  TextWriter, LogWriter
} from './types';

var DEFAULT_MEMORY_CAPACITY = 256;
var MAX_MEMORY_CAPACITY = 4096;

export function createCustomSink(writer: LogWriter): LogSink {
  if (typeof writer !== 'function') {
    throw new Error('ESLOG: custom sink writer must be a function');
  }
  return {
    write: function (record: LogRecord, text: string): void {
      writer(record, text);
    }
  };
}

function createTextWriterSink(writer: TextWriter, format: LogFormat): LogSink {
  if (typeof writer !== 'function') {
    throw new Error('ESLOG: text sink writer must be a function');
  }
  return {
    format: format,
    write: function (_record: LogRecord, text: string): void {
      writer(text);
    }
  };
}

export function createTextSink(writer: TextWriter): LogSink {
  return createTextWriterSink(writer, 'text');
}

export function createJsonlSink(writer: TextWriter): LogSink {
  return createTextWriterSink(writer, 'jsonl');
}

function writeToExtendScriptConsole(text: string): void {
  if (typeof $ === 'undefined' || !$ || typeof $.writeln !== 'function') {
    throw new Error('ESLOG: ExtendScript $.writeln is unavailable');
  }
  $.writeln(text);
}

export function createExtendScriptConsoleSink(writer?: TextWriter): LogSink {
  var output = writer || writeToExtendScriptConsole;
  return createTextWriterSink(output, 'text');
}

function appendToPort(io: AppendSinkIO, path: string, text: string): void {
  io.append(path, text);
}

function createAppendSinkForFormat(io: AppendSinkIO, path: string, format?: LogFormat): LogSink {
  if (io === null || io === undefined || typeof io.append !== 'function') {
    throw new Error('ESLOG: append I/O port must provide append(path, text)');
  }
  if (typeof path !== 'string' || path.length === 0) {
    throw new Error('ESLOG: append sink path must be a non-empty string');
  }
  var sink: LogSink = {
    write: function (_record: LogRecord, text: string): void {
      appendToPort(io, path, text);
    }
  };
  if (format !== undefined) {
    sink = {
      format: format,
      write: function (_record: LogRecord, text: string): void {
        appendToPort(io, path, text);
      }
    };
  }
  return sink;
}

export function createAppendSink(io: AppendSinkIO, path: string): LogSink {
  return createAppendSinkForFormat(io, path);
}

export function createTextAppendSink(io: AppendSinkIO, path: string): LogSink {
  return createAppendSinkForFormat(io, path, 'text');
}

export function createJsonlAppendSink(io: AppendSinkIO, path: string): LogSink {
  return createAppendSinkForFormat(io, path, 'jsonl');
}

export function createMemorySink(capacity?: number): MemorySink {
  var limit = capacity;
  if (limit === undefined) {
    limit = DEFAULT_MEMORY_CAPACITY;
  }
  if (typeof limit !== 'number' || Math.floor(limit) !== limit || limit < 1 || limit > MAX_MEMORY_CAPACITY) {
    throw new Error('ESLOG: memory capacity must be an integer from 1 to ' + MAX_MEMORY_CAPACITY);
  }
  var slots: MemoryEntry[] = [];
  var count = 0;
  var next = 0;
  var memory: MemorySink = {
    write: function (record: LogRecord, text: string): void {
      var entry: MemoryEntry = { record: record, text: text };
      if (count < limit!) {
        slots[count] = entry;
        count++;
      } else {
        slots[next] = entry;
        next++;
        if (next >= limit!) {
          next = 0;
        }
      }
    },
    getEntries: function (): MemoryEntry[] {
      var result: MemoryEntry[] = [];
      var i = 0;
      for (i = 0; i < count; i++) {
        var slot = next + i;
        if (slot >= count && count === limit) {
          slot = slot - limit;
        }
        result[i] = slots[slot];
      }
      return result;
    },
    clear: function (): void {
      slots.length = 0;
      count = 0;
      next = 0;
    }
  };
  return memory;
}

export function maxFanout(): number {
  return MAX_SINKS;
}
