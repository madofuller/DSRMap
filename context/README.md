# Context Pack

Working notes to keep the DSAR webform simulator maintainable.

- **Entry points**: `index.html` renders the UI, `simulator.js` handles parsing, state, Excel export, and workflow logic, and `onetrust-webform-parser-agnostic.js` provides lower-level parsing helpers for OneTrust JSON.
- **Supporting scripts**: CLI helpers live in `scripts/node/` (e.g., `example-usage.js`, `extract-hashes.js`, `hash-decryptor*.js`); Python utilities live in `scripts/python/`.
- **Assets**: the logo is now mirrored under `assets/` to match the HTML reference; original files remain in place.
- **Deployment**: Vite is configured for local dev/build; see below for commands.

## Local development

```bash
npm install
npm run dev   # starts Vite at http://localhost:4173
```

Use `npm run build` to produce a static bundle in `dist/` and `npm run preview` to serve that output locally.

## Next steps (ideas)

- Extract `simulator.js` into smaller modules (parsing, rendering, exports).
- Add automated tests for parser correctness against sample webforms.
- Replace inline styles with a dedicated stylesheet for easier theming.

