export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';
export type LogThreshold = LogLevel | 'off';
export type LogFormat = 'text' | 'jsonl';
export type LogValue = string | number | boolean | null;
export type LogPrimitive = string | number | boolean | null;
export type LogMessage = LogPrimitive;

export interface LogField {
  readonly key: string;
  readonly value: LogValue;
}

export type LogFields = Array<LogField>;
export type LogFieldsSupplier = () => LogFields;
export type LogFieldsInput = LogFields | LogFieldsSupplier;

export interface LogRecord {
  readonly timestamp: number;
  readonly level: LogLevel;
  readonly message: string;
  readonly fields: LogFields;
}

export interface LogSink {
  readonly format?: LogFormat;
  write(record: LogRecord, text: string): void;
}

export interface LoggerOptions {
  readonly sinks: Array<LogSink>;
  readonly threshold?: LogThreshold;
  readonly format?: LogFormat;
  readonly clock?: () => number;
}

export interface AppendSinkIO {
  append(path: string, text: string): void;
}

export interface MemoryEntry {
  readonly record: LogRecord;
  readonly text: string;
}

export interface MemorySink extends LogSink {
  getEntries(): MemoryEntry[];
  clear(): void;
}

export interface SinkFailure {
  readonly sinkIndex: number;
  readonly message: string;
}

export type LogWriter = (record: LogRecord, text: string) => void;
export type TextWriter = (text: string) => void;
