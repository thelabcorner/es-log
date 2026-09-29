# ESLOG v0.2.0 — 2026-09-29

**SemVer: minor** — ESLOG's public logging API remains source-compatible, while the shipped production distribution gains the canonical ESPACK 0.5 manifest-v2 composition contract.

## Changed

- Added a stable ESPACK library identity for ESLOG and a generated v2 manifest with explicit SemVer requirements, activation contract, exact UTF-8 byte lengths, and SHA-256 provenance.
- `ESLOG.accel.jsx` / `ESLOG.accel.min.jsx` now resolve the complete dependency-first chain:
  `esb64@1.3.0 -> eson@1.3.0 -> eslog@0.2.0`.
- The composed artifact evaluates through one persistent `$.global.ESPAK` loader/control plane instead of sibling preloads or ad-hoc concatenation.
- ESON's optional native capability remains part of the transitive composed distribution. ESPACK owns any loaded ExternalObject; ESON receives it as borrowed state and ESLOG adds no native ownership of its own.
- The standalone `ESLOG.jsx` / `vendor-eslog.js` contract remains explicit: callers that choose those artifacts must provide ESON first. The single-file composed distribution does not require a manual preload.
- Standalone ESON compatibility is pinned to `^1.3.0`.

## Verification

- `npm run release:gate`: exit 0 on the final v0.2.0 release candidate.
- Unit suite: **14 case groups passed**.
- Seeded JSONL fuzzing: **20,000** records parsed successfully by Node `JSON.parse`.
- ESTC static/live parse: all five shipped ExtendScript surfaces pass on Adobe Illustrator 30.6.0 / ExtendScript 4.5.6 through COMTool V2.
- Standalone live verification: **11/11 checks passed**, including the real ExtendScript environment where global `JSON` may be absent and ESON must leave that state unpatched.
- Root-only composition proof: **PASS**; evaluating only `ESLOG.accel.jsx` activates `ESB64 -> ESON -> ESLOG` transitively with no manual sibling preload.
- Final composed sizes: `ESLOG.accel.jsx` **274,222 B**; `ESLOG.accel.min.jsx` **238,376 B**.

## Release assets

- `ESLOG.jsx`
- `vendor-eslog.js`
- `ESLOG.facade.jsx`
- `ESLOG.manifest.json`
- `ESLOG.accel.jsx`
- `ESLOG.accel.min.jsx`
- `eslog-core.esm.mjs`
