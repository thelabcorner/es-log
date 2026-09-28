import { formatMessage, isFiniteNumber, MAX_SINKS, normalizeFields, normalizeMessage, resolveFields } from './normalize';
import { renderRecord } from './serialize';
import {
  LogFieldsInput, LogFormat, LogLevel, LogMessage, LogPrimitive, LogRecord,
  LogSink, LoggerOptions, LogThreshold, SinkFailure
} from './types';

var TRACE = 0;
var DEBUG = 1;
var INFO = 2;
var WARN = 3;
var ERROR = 4;
var FATAL = 5;
var OFF = 6;

export interface Logger {
  trace(message: LogMessage, fields?: LogFieldsInput): void;
  debug(message: LogMessage, fields?: LogFieldsInput): void;
  info(message: LogMessage, fields?: LogFieldsInput): void;
  warn(message: LogMessage, fields?: LogFieldsInput): void;
  error(message: LogMessage, fields?: LogFieldsInput): void;
  fatal(message: LogMessage, fields?: LogFieldsInput): void;
  log(level: LogLevel, message: LogMessage, fields?: LogFieldsInput): void;
  logf(level: LogLevel, template: string, args: Array<LogPrimitive>, fields?: LogFieldsInput): void;
  logLazy(level: LogLevel, messageFactory: () => LogMessage, fields?: LogFieldsInput): void;
  isEnabled(level: LogLevel): boolean;
  setThreshold(level: LogThreshold): void;
  getThreshold(): LogThreshold;
  getSinkCount(): number;
  getLastSinkErrors(): SinkFailure[];
}

function defaultClock(): number {
  return new Date().getTime();
}

function thresholdValue(level: LogThreshold): number {
  switch (level) {
    case 'trace': return TRACE;
    case 'debug': return DEBUG;
    case 'info': return INFO;
    case 'warn': return WARN;
    case 'error': return ERROR;
    case 'fatal': return FATAL;
    case 'off': return OFF;
    default: throw new Error('ESLOG: invalid log threshold');
  }
}

function levelValue(level: LogLevel): number {
  switch (level) {
    case 'trace': return TRACE;
    case 'debug': return DEBUG;
    case 'info': return INFO;
    case 'warn': return WARN;
    case 'error': return ERROR;
    case 'fatal': return FATAL;
    default: throw new Error('ESLOG: invalid log level');
  }
}

function errorMessage(error: unknown): string {
  if (typeof error === 'string') {
    if (error.length > 256) {
      return error.substring(0, 256);
    }
    return error;
  }
  if (error === null) {
    return 'sink threw null';
  }
  return 'sink threw a non-string value';
}

export function createLogger(options: LoggerOptions): Logger {
  if (options === null || options === undefined) {
    throw new Error('ESLOG: logger options are required');
  }
  if (options.sinks === undefined || options.sinks === null) {
    throw new Error('ESLOG: provide a caller-owned sink array');
  }
  var sinkCount = options.sinks.length;
  if (typeof sinkCount !== 'number' || sinkCount < 0 || sinkCount > MAX_SINKS || Math.floor(sinkCount) !== sinkCount) {
    throw new Error('ESLOG: a logger may have at most ' + MAX_SINKS + ' sinks');
  }
  var outputFormat: LogFormat = 'text';
  if (options.format !== undefined) {
    outputFormat = options.format;
  }
  if (outputFormat !== 'text' && outputFormat !== 'jsonl') {
    throw new Error('ESLOG: format must be "text" or "jsonl"');
  }
  var minimumName: LogThreshold = 'trace';
  if (options.threshold !== undefined) {
    minimumName = options.threshold;
  }
  var minimumLevel = thresholdValue(minimumName);
  var clock = options.clock || defaultClock;
  if (typeof clock !== 'function') {
    throw new Error('ESLOG: clock must be a function');
  }
  var sinks: LogSink[] = [];
  var lastErrors: SinkFailure[] = [];
  var i = 0;
  for (i = 0; i < sinkCount; i++) {
    var sink = options.sinks[i];
    if (sink === null || sink === undefined || typeof sink.write !== 'function') {
      throw new Error('ESLOG: each sink must provide write(record, text)');
    }
    if (sink.format !== undefined && sink.format !== outputFormat) {
      throw new Error('ESLOG: sink format does not match logger format');
    }
    sinks[i] = sink;
  }

  function writeEnabled(level: LogLevel, message: LogMessage, fields?: LogFieldsInput): void {
    var timestamp = clock();
    if (!isFiniteNumber(timestamp)) {
      throw new Error('ESLOG: clock must return a finite number of epoch milliseconds');
    }
    var normalizedMessage = normalizeMessage(message);
    var resolved = resolveFields(fields);
    var normalizedFields = normalizeFields(resolved);
    var record: LogRecord = {
      timestamp: timestamp,
      level: level,
      message: normalizedMessage,
      fields: normalizedFields
    };
    var text = renderRecord(record, outputFormat);
    lastErrors = [];
    var sinkIndex = 0;
    for (sinkIndex = 0; sinkIndex < sinks.length; sinkIndex++) {
      var target = sinks[sinkIndex];
      try {
        target.write(record, text);
      } catch (error) {
        lastErrors[lastErrors.length] = {
          sinkIndex: sinkIndex,
          message: errorMessage(error)
        };
      }
    }
  }

  var logger: Logger = {
    trace: function (message: LogMessage, fields?: LogFieldsInput): void {
      if (TRACE < minimumLevel) { return; }
      writeEnabled('trace', message, fields);
    },
    debug: function (message: LogMessage, fields?: LogFieldsInput): void {
      if (DEBUG < minimumLevel) { return; }
      writeEnabled('debug', message, fields);
    },
    info: function (message: LogMessage, fields?: LogFieldsInput): void {
      if (INFO < minimumLevel) { return; }
      writeEnabled('info', message, fields);
    },
    warn: function (message: LogMessage, fields?: LogFieldsInput): void {
      if (WARN < minimumLevel) { return; }
      writeEnabled('warn', message, fields);
    },
    error: function (message: LogMessage, fields?: LogFieldsInput): void {
      if (ERROR < minimumLevel) { return; }
      writeEnabled('error', message, fields);
    },
    fatal: function (message: LogMessage, fields?: LogFieldsInput): void {
      if (FATAL < minimumLevel) { return; }
      writeEnabled('fatal', message, fields);
    },
    log: function (level: LogLevel, message: LogMessage, fields?: LogFieldsInput): void {
      var numeric = levelValue(level);
      if (numeric < minimumLevel) { return; }
      writeEnabled(level, message, fields);
    },
    logf: function (level: LogLevel, template: string, args: Array<LogPrimitive>, fields?: LogFieldsInput): void {
      var numeric = levelValue(level);
      if (numeric < minimumLevel) { return; }
      var message = formatMessage(template, args);
      writeEnabled(level, message, fields);
    },
    logLazy: function (level: LogLevel, messageFactory: () => LogMessage, fields?: LogFieldsInput): void {
      var numeric = levelValue(level);
      if (numeric < minimumLevel) { return; }
      if (typeof messageFactory !== 'function') {
        throw new Error('ESLOG: lazy message must be a function');
      }
      var message = messageFactory();
      writeEnabled(level, message, fields);
    },
    isEnabled: function (level: LogLevel): boolean {
      return levelValue(level) >= minimumLevel;
    },
    setThreshold: function (level: LogThreshold): void {
      minimumLevel = thresholdValue(level);
      minimumName = level;
    },
    getThreshold: function (): LogThreshold {
      return minimumName;
    },
    getSinkCount: function (): number {
      return sinks.length;
    },
    getLastSinkErrors: function (): SinkFailure[] {
      var result: SinkFailure[] = [];
      var errorIndex = 0;
      for (errorIndex = 0; errorIndex < lastErrors.length; errorIndex++) {
        var failure = lastErrors[errorIndex];
        result[errorIndex] = { sinkIndex: failure.sinkIndex, message: failure.message };
      }
      return result;
    }
  };
  return logger;
}
