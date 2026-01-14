# Architecture notes

## High-level flow

- `index.html` loads a simple layout, the header logo, and wires up the main script `simulator.js`.
- `simulator.js` handles file uploads, parses the OneTrust DSAR webform JSON, renders fields, tracks selections, evaluates workflow/visibility rules, and exports results to Excel via SheetJS.
- `onetrust-webform-parser-agnostic.js` is a standalone parser that finds fields, workflows, translations, UI fields, and metadata by shape instead of fixed paths; the UI logic builds on these helpers.
- `state_hash_mapping.csv` plus hash lookup helpers inside `simulator.js` map hashed country/state values back to readable forms.

## Key responsibilities in `simulator.js`

- State: keeps `webformData`, `translations`, `allFields`, `workflowRules`, `currentSelections`, `visibleFields`, and hash lookups in module scope.
- Hash helpers: `buildCountryHashLookup`, `buildStateHashLookup`, `loadStateHashMappingsFromCSV`.
- UI rendering: builds dynamic form controls, manages visibility based on rule evaluation, and tracks form actions and triggered workflows.
- Exporting: `exportToExcel` uses SheetJS to generate multi-sheet reports; `generateSmartCoverageDiagram` and `showAnalysisReport` surface coverage views.
- Utilities: detection helpers (`isLikelyCountryField`, `isLikelyUSStatesField`, `getWorldCountriesOptions`, `getUSStatesOptions`) and crypto helpers (`sha512`).

## Supporting CLI tools

- `example-usage.js`: demonstrates how to call the parser from Node; now expects a JSON path CLI argument.
- `extract-hashes.js`: pulls potential hash values from a provided webform JSON.
- `hash-decryptor*.js`: experiments for decoding hashed values when supplied with lookup data.

## Build/dev

- Vite powers local dev/build; root config lives in `vite.config.js`.
- Static assets live alongside the HTML; the logo is duplicated under `assets/` for the header reference.
- No transpilation pipeline is required; the app relies on plain JS plus SheetJS from CDN.

