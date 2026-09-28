<div align="center">

# ESLOG: Bounded structured logging with text and JSONL sinks for Adobe ExtendScript (ES3)

## ExtendScript Structured Logging = E.S.LOG

### `trace` through `fatal`, lazy formatting, and text/JSONL sinks for Illustrator, InDesign, Photoshop, and other ExtendScript hosts

[![JSONL: Node parser](https://img.shields.io/badge/JSONL-20k%20generated%20records-purple)](#validation)
[![Unit cases](https://img.shields.io/badge/tests-12%20case%20groups-success)](#validation)
[![Engine parity](https://img.shields.io/badge/engine%20parity-live%209%2F9-green)](#validation)
[![Adobe: Creative Suite](https://img.shields.io/badge/Adobe%20-Creative%20Suite-red?logo=adobe&logoColor=white)](https://extendscript.docsforadobe.dev/)
[![Engine](https://img.shields.io/badge/ExtendScript-ES3-green)](#compatibility)
[![Size](https://img.shields.io/badge/runtime-12.7%20KiB-orange)](#installation)
[![License: GPL-3.0-or-later](https://img.shields.io/badge/license-GPL%203.0--or--later-blue)](https://www.gnu.org/licenses/gpl-3.0.html)

</div>

---

## Part Of The Same Toolkit

> Production-grade infrastructure for Adobe ExtendScript.

<table>
<tr>
<td width="50%" valign="top">

### Runtime Primitives

**[ESON](https://github.com/thelabcorner/eson)**  
Strict RFC 8259 JSON for ExtendScript.

**[ESB64](https://github.com/thelabcorner/es-b64)**  
Base64 and UTF-8 utilities.

**[ESARR](https://github.com/thelabcorner/es-arr)**  
ES5+ Array compatibility methods.

**[ESSTR](https://github.com/thelabcorner/es-str)**  
String whitespace and trim methods.

**[ESCHARS](https://github.com/thelabcorner/es-chars)**  
Native bulk byte operations.

**[ESHTTP](https://github.com/thelabcorner/es-http)**  
HTTP transport for ExtendScript automation.

**[ESTIMER](https://github.com/thelabcorner/es-timer)**  
Microsecond timing for ExtendScript automation.

**[ESRAND](https://github.com/thelabcorner/es-rand)**  
Deterministic random streams and sampling for ExtendScript.

**[ESUUID](https://github.com/thelabcorner/es-uuid)**  
RFC 9562 UUID generation, parsing, and conversion for ExtendScript.

**[ESENV](https://github.com/thelabcorner/es-env)**  
Environment and capability detection for ExtendScript.

**[ESPATH](https://github.com/thelabcorner/es-path)**  
Deterministic Windows/POSIX path and RFC 8089 file-URI transformations.

**[ESFS](https://github.com/thelabcorner/es-fs)**  
Synchronous ExtendScript File/Folder I/O with explicit text, BINARY, and replacement semantics.

**[ESHASH](https://github.com/thelabcorner/es-hash)**  
CRC-32/ISO-HDLC and SHA-256 for byte strings and UTF-8 text.

**[ESLOG](https://github.com/thelabcorner/es-log)**  
Structured logging with bounded text and JSONL sinks.

</td>
<td width="50%" valign="top">

### Build & Integration Tools

**[ESPACK](https://github.com/thelabcorner/espack)**  
Self-extracting ExternalObject bundles.

**[ESMIN](https://github.com/thelabcorner/es-min)**  
Minification for shipped JSX bundles.

**[ESABI](https://github.com/thelabcorner/esabi)**  
Modern ExternalObject ABI declarations for native integrations.

**[VectorIPC](https://github.com/thelabcorner/vector-ipc)**  
Bounded local IPC for scripting hosts and native plug-ins.

**[ESTC](https://github.com/thelabcorner/estc)**  
TypeScript-to-ExtendScript build, compatibility, and live-parse tooling.

**[ESDB](https://github.com/thelabcorner/esdb)**  
Native state and durable storage for Adobe tooling.

**[COMTool](https://github.com/thelabcorner/COMTool)**  
Guarded COM, ExtendScript, plug-in, and debugger automation for Adobe desktop apps.

**ESsemble** <sub>coming soon</sub>  
Typed framework, resolver, and composition layer for the ExtendScript toolkit.

**ESOBF** <sub>coming soon</sub>  
Obfuscation for hardened JSX distribution.

</td>
</tr>
</table>

Also from the same team: **[ArcFit.dev](https://arcfit.dev)**, deterministic arc warp for Illustrator.

---

## Table of Contents

- [Why ESLOG?](#why-eslog)
- [Features](#features)
- [Which build should I use?](#which-build-should-i-use)
- [Installation](#installation)
- [Quick Start](#quick-start)
- [API](#api)
- [Validation](#validation)
- [Performance](#performance)
- [Security Model](#security-model)
- [Compatibility](#compatibility)
- [Engine quirks that shaped the design](#engine-quirks-that-shaped-the-design)
- [Development](#development)
- [Repository layout](#repository-layout)
- [Credits](#credits)
- [License](#license)

---

## Why ESLOG?

ExtendScript has no portable logging facade or consistently available JSON implementation. A logger that formats a message, reads a clock, normalizes fields, or visits a sink before deciding whether the level is enabled wastes work on filtered calls and can trigger caller code unnecessarily.

ESLOG checks the numeric threshold at the start of each level method. A disabled call returns before reading the clock, invoking a lazy message or field supplier, formatting arguments, normalizing fields, rendering text, or contacting a sink. An enabled call produces one normalized record and one rendered string, then gives those same references to each configured sink.

---

## Features

- Six severity methods: `trace`, `debug`, `info`, `warn`, `error`, and `fatal`; `off` is an available threshold.
- `logf(level, template, args)` substitutes `{}` placeholders only after the threshold passes; `logLazy(level, factory, fields?)` defers message construction and field acquisition.
- Text and JSONL rendering escape control characters, sort fields by key, and use one rendering for the entire fanout.
- Sink fanout is capped at 16 sinks per logger. Sink exceptions are isolated; the last event's failure summaries contain at most 16 bounded entries.
- `createMemorySink(capacity)` retains at most 4,096 record/text pairs; the default capacity is 256.
- Message text is capped at 8,192 code units, string field values at 256, field keys at 64, and fields at 16 per record. Oversize message/value strings are truncated with `...`; invalid/duplicate/NUL-bearing field keys throw.
- Field values are scalar JSON values only. Non-finite field numbers normalize to `null`; negative zero renders as `0`.
- `AppendSinkIO.append(path, text)` is the small caller-supplied append port. ESLOG contains no filesystem package adapter or ESFS runtime dependency.
- The core uses no native code, persistent prototype patches, ES* runtime imports, message memoization, or unbounded property keys.

---

## Which build should I use?

| | **Standalone JSX** | **Vendor JavaScript** |
|---|---|---|
| File | `dist/ESLOG.jsx` | `dist/vendor-eslog.js` |
| Size | 13,009 bytes | 13,009 bytes |
| API | Installs `$.global.ESLOG` | Installs `$.global.ESLOG` |
| Installs `ESLOG` | Yes | Yes |
| Best for | Running or including from an Illustrator script | `$.evalFile` or inclusion in an existing ExtendScript engine |

**Rule of thumb:** both artifacts use the same facade; choose the filename that fits the host loader.

---

## Installation

Build from this repository with Node.js 20 or newer:

```bash
npm ci
npm run build
```

The two ExtendScript artifacts are emitted under `dist/`. The Node ESM build is `dist/eslog-core.esm.mjs`. The ExtendScript entry installs `ESLOG` on `$.global`; the TypeScript/Node core exports `createLogger` and sink factories as modules.

---

## Quick Start

```jsx
var memory = ESLOG.createMemorySink(128);
var logger = ESLOG.createLogger({
  threshold: 'info',
  format: 'jsonl',
  sinks: [memory]
});

logger.debug('filtered before clock or formatting');
logger.logf('info', 'saved {} items', [12], [{ key: 'count', value: 12 }]);

var entries = memory.getEntries();
$.writeln(entries[0].text);
```

An append integration supplies only `append(path, text)` and chooses either `createTextAppendSink` with the default `text` format or `createJsonlAppendSink` with `format: 'jsonl'`. The port is synchronous; it does not buffer or reopen files on ESLOG's behalf.

---

## API

### Logger

- `createLogger({ sinks, threshold?, format?, clock? })` creates a closure-backed logger. `sinks` is a caller-owned plain array copied once at construction. `clock` defaults to `new Date().getTime()` and is called only for accepted events.
- `trace`, `debug`, `info`, `warn`, `error`, `fatal` each accept a scalar message and optional `LogField[]` or field supplier.
- `log(level, message, fields?)` is the dynamic-level equivalent. Valid levels are `trace`, `debug`, `info`, `warn`, `error`, and `fatal`.
- `logf(level, template, args, fields?)` replaces each `{}` in order using scalar arguments. At most 16 format arguments are accepted; extra arguments after the last placeholder are unused.
- `logLazy(level, messageFactory, fields?)` invokes the message factory only after the level check. `fields` can also be a zero-argument supplier.
- `isEnabled(level)`, `setThreshold(level)`, and `getThreshold()` expose threshold control. `off` disables every severity.
- `getSinkCount()` returns the configured sink count. `getLastSinkErrors()` returns a copy of the bounded failure summaries from the most recent accepted event.

### Sinks

- `createCustomSink((record, text) => ...)` receives one normalized record and the exact rendered string shared by the other sinks. Sink implementations should treat both as read-only.
- `createTextSink(writeText)` and `createJsonlSink(writeText)` wrap caller-owned writer callbacks and declare their expected logger format.
- `createExtendScriptConsoleSink(writeText?)` writes text through the supplied callback or `$.writeln`.
- `createMemorySink(capacity?)` stores bounded `{ record, text }` pairs and exposes `getEntries()` and `clear()`.
- `createAppendSink(io, path)` accepts either format. `createTextAppendSink(io, path)` and `createJsonlAppendSink(io, path)` enforce their named format. `io` must implement `append(path, text)`.
- `maxFanout()` returns 16.

`LogField` is `{ key: string, value: string | number | boolean | null }`. Pass caller-owned plain arrays and field records; host collections, arbitrary objects, accessors, cycles, and nested containers are not reflected or serialized.

---

## Validation

| Check | Command | Result |
|---|---|---|
| TypeScript typecheck | `npm run typecheck` | pass |
| ESTC build | `npm run build` | `ESLOG.jsx` and `vendor-eslog.js`, 13,009 bytes each; no compatibility warnings |
| Behavioral tests | `npm test` | 12 case groups pass |
| Seeded JSONL fuzz | `npm run fuzz` | 20,000 generated records parsed by Node `JSON.parse`; seed `0x5e10` |
| Static ES3 artifact checks | `npm run estc:static` | both artifacts pass Acorn ES3 checks |
| Live compile-only parse | `npm run estc:live-parse` | both artifacts pass in Illustrator 30.6.0 / ExtendScript 4.5.6 via COMTool Node SDK |
| Live behavior | `npm run live-verify` | 9/9 checks pass in Illustrator 30.6.0 / ExtendScript 4.5.6 via COMTool V2 |

The JSONL oracle is Node's `JSON.parse`; the live lane separately checks the actual ExtendScript behavior and never treats Node compatibility as host evidence.

---

## Performance

### Node reference lane

Measured on Node v22.23.2 using `process.hrtime.bigint()`, 3 warmups and 9 samples. The builder rows compare string `+=` with indexed array writes followed by `join`; the `repeats` column shows builds per sample. These Node measurements are not used to select ExtendScript behavior.

| Output chars | Piece chars | Repeats | String accumulation (µs/batch) | Array + join (µs/batch) | Array/string |
|---:|---:|---:|---:|---:|---:|
| 256 | 1 | 1 | 12.10 | 11.30 | 0.93× |
| 256 | 16 | 1 | 0.50 | 0.90 | 1.80× |
| 1,024 | 1 | 1 | 28.10 | 38.30 | 1.36× |
| 1,024 | 16 | 1 | 1.20 | 3.70 | 3.08× |
| 4,096 | 1 | 1 | 24.20 | 35.70 | 1.48× |
| 4,096 | 16 | 1 | 2.20 | 5.30 | 2.41× |
| 16,384 | 1 | 1 | 263.40 | 375.80 | 1.43× |
| 16,384 | 16 | 1 | 18.60 | 34.00 | 1.83× |

Node results varied with piece shape: the 256-code-unit/1-code-unit lane measured array + join at 0.93× the string time, while the other rows ranged from 1.36× to 3.08×. These Node timings are reference evidence only and do not select ExtendScript behavior.

### ExtendScript engine lane

Measured live on Adobe Illustrator 30.6.0 / ExtendScript 4.5.6 via COMTool V2. The benchmark primes `$.hiresTimer` before each sample, runs 2 warmups and 9 measured samples, and times only in-engine work; COM transport is outside the timed region. Piece sizes are 1 and 16 code units, with total generated characters matched by the repeat count.

| Output chars | Piece chars | Repeats | String accumulation (median µs) | Array + join (median µs) | Array/string |
|---:|---:|---:|---:|---:|---:|
| 256 | 1 | 16 | 648 | 2,036 | 3.14× |
| 256 | 16 | 16 | 88 | 143 | 1.63× |
| 1,024 | 1 | 4 | 760 | 3,748 | 4.93× |
| 1,024 | 16 | 4 | 54 | 117 | 2.17× |
| 4,096 | 1 | 1 | 879 | 15,660 | 17.82× |
| 4,096 | 16 | 1 | 59 | 131 | 2.22× |

The logger-specific engine lane measured `info()` with a direct no-op sink at 30,772 µs per 2,000 accepted calls, and threshold-filtered `info()` at 1,342 µs per 2,000 calls. These are host/version-specific medians, not cross-host promises. The synchronous append port is not buffered by ESLOG, so no sink batching policy is inferred from the string/array microbenchmark.

---

## Security Model

The core formats scalar values and invokes only sinks explicitly supplied by the caller. It does not evaluate source, reflect over host objects, patch shared globals or prototypes, access the filesystem, load native code, or make network requests. Append behavior is entirely caller-owned through the small `append(path, text)` port. Sink exceptions are caught per sink so later sinks still receive the record; field validation errors and message/clock failures remain visible to the caller.

---

## Compatibility

| Target | Status |
|---|---|
| Adobe Illustrator 30.6.0 / ExtendScript 4.5.6 | live parse and 9/9 behavior checks pass |
| ExtendScript ES3 grammar | both emitted artifacts pass ESTC static checks |
| Adobe InDesign, Photoshop, Bridge, and other ExtendScript hosts | intended ES3-compatible source; live behavior not yet measured on these hosts |
| Node.js 20+ | ESM development and test lane; `npm run benchmark` is Node-only |

---

## Engine quirks that shaped the design

### Inherited ES3 engine evidence

These are inherited workspace observations, not new ESLOG measurements. The cited live figures apply to Illustrator 30.6.0 / ExtendScript 4.5.6 unless stated otherwise.

- **ESARR — indexed arrays and writes.** ESARR's Illustrator benchmark measured a full 8k indexed-read pass at 47.4 ms and a full write pass at 50.6 ms: the writes were not superlinear in that fixture, while variable-index reads can become the scaling floor. ESLOG keeps its logger-owned fanout small and bounded rather than building an unbounded per-record sink array. Evidence: [ESARR benchmark-rounds-1](https://github.com/thelabcorner/es-arr/blob/main/docs/benchmark-rounds-1.md) and [ESARR README](https://github.com/thelabcorner/es-arr/blob/main/README.md).
- **ESB64 — many array writes are expensive.** ESB64 measured roughly 15–25 µs per array write in its codec fixture; its original 47k-write path took 1.7 s for 20 KB. This supports measuring output construction in the real engine; it is not a universal claim that every `+=` pattern wins. Evidence: [ESB64 Performance](https://github.com/thelabcorner/es-b64/blob/main/README.md#performance).
- **ESON — no dependable global JSON and shape-sensitive strings.** ESON records that the conservative engine profile has no usable `JSON` global. ESON's 43 KB stringify measurement was 13.7 ms, while separate ESON workload notes found repeated concatenation effectively quadratic; the later performance catalog records that concat behavior depends on chunk shape and that there is no universal `+=` or array rule. ESLOG therefore owns a bounded scalar JSONL serializer and measures the exact buffer alternatives. Evidence: [ESON measured operations](https://github.com/thelabcorner/eson/blob/main/README.md#eson-vs-json2-the-operators-both-implement) and the workspace [ExtendScript performance reference](https://github.com/thelabcorner/illustrator_scripts/blob/main/agent-skills/extendscript-es3-engine-quirks/references/performance.md#9-string-concatenation-is-shape-sensitive).
- **ESSTR — NUL-safe scanning.** ESSTR measured `charAt()` returning `""` at U+0000 while `charCodeAt()` reads code unit 0 correctly. ESLOG escapes control code units and rejects NUL in field keys; it does not memoize message bodies or use those strings as property keys. Evidence: [ESSTR engine quirks](https://github.com/thelabcorner/es-str/blob/main/README.md#engine-quirks-that-shaped-the-design).
- **ESCHARS — very large per-unit transforms can wedge.** ESCHARS reproduced a `charCodeAt` + `push`/`join`/`fromCharCode` transform hanging at 128K units while 64K completed. ESLOG caps each message, value, and field count and has no ESCHARS/ESABI/native runtime dependency. Evidence: [ESCHARS engine quirks](https://github.com/thelabcorner/es-chars/blob/main/README.md#engine-quirks-that-shaped-the-design).
- **ESTIMER — `$.hiresTimer` is a delta source.** ESTIMER's live probe and the current performance reference show that each read consumes the preceding interval; the first read is not a zero baseline, nested reads interfere, and zero deltas can be valid. ESLOG timestamps use `Date().getTime()` only after a level passes; the engine benchmark separately primes `$.hiresTimer` per sample. Evidence: [ESTIMER research probes](https://github.com/thelabcorner/es-timer/blob/main/docs/research-probes.md), [measured facts](https://github.com/thelabcorner/es-timer/blob/main/MEASURED-FACTS.md), and the workspace [timer authority reference](https://github.com/thelabcorner/illustrator_scripts/blob/main/agent-skills/extendscript-es3-engine-quirks/references/performance.md#2-timer-authority).

### ESLOG-new measurements

The Node matrix above is only a Node reference. The ESLOG-specific Illustrator table was collected by `npm run benchmark:engine` on Illustrator 30.6.0 / ExtendScript 4.5.6; it measured equal output lengths and found string accumulation 1.63×–17.82× faster than the tested array-write-plus-join lane. ESLOG uses bounded semantic string pieces for one record, then calls each append sink once with the complete rendered record. The benchmark does not include disk latency and does not select a file flush policy.

---

## Development

```bash
npm ci
npm run typecheck
npm run build
npm test
npm run fuzz
npm run benchmark
npm run benchmark:engine
npm run estc:static
npm run estc:live-parse
npm run live-verify
npm run verify
```

`npm run benchmark` uses Node timing and is not ExtendScript evidence. The engine benchmark and live verifier use an already-running Illustrator through COMTool V2 and do not launch Illustrator. If COMTool or Illustrator is unavailable, the live harness reports `PENDING` and exits with status 2.

---

## Repository layout

```text
eslog/
  src/          ES3-compatible logger, scalar normalization, renderers, and sink ports
  tests/        Node behavior/fuzz/benchmark harnesses and COMTool V2 live probes
  dist/         generated ESTC artifacts and Node ESM bundle (ignored)
  eslog-build.mjs
  extendscript.estc.config.mjs
  package.json
```

---

## Credits

- **[docsforadobe](https://github.com/docsforadobe)** and the ExtendScript community for host/runtime documentation and measured engine behavior.
- **ECMA International** for the ECMAScript 3 grammar baseline used by ESTC.
- **[ESTC](https://github.com/thelabcorner/estc)** for the shared TypeScript-to-ExtendScript build, static compatibility gate, and live parse path.
- **ESARR, ESB64, ESON, ESSTR, ESCHARS, and ESTIMER** for the separately cited inherited engine evidence in this README.

---

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).

---

<p align="center"><small>ESLOG: one bounded record, one rendering, and an explicit sink boundary.</small></p>
