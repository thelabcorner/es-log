import {
  createAppendSink, createCustomSink, createExtendScriptConsoleSink,
  createJsonlAppendSink, createJsonlSink, createLogger, createMemorySink,
  createTextAppendSink, createTextSink, maxFanout
} from './index';

var eslogGlobal: any = $.global;
eslogGlobal['ESLOG'] = {
  createLogger: createLogger,
  createAppendSink: createAppendSink,
  createTextAppendSink: createTextAppendSink,
  createJsonlAppendSink: createJsonlAppendSink,
  createCustomSink: createCustomSink,
  createTextSink: createTextSink,
  createJsonlSink: createJsonlSink,
  createMemorySink: createMemorySink,
  createExtendScriptConsoleSink: createExtendScriptConsoleSink,
  maxFanout: maxFanout
};
