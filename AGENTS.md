# Fin

Read `DESIGN.md` before changing the interface. Keep Warrants and CRP inside the same React application and shared navigation. Do not add a second HTML entry, an iframe wrapper, Geist or a decorative logo.

Preserve the existing Worker name, D1 data, CRP journal and provider budget. Browsing and tests must not invoke a paid model. Do not run `scripts/evaluate.mjs` or trigger the scheduled CRP handler as a smoke test.

For collected warrants, validate the underlying on the product page as well as the ISIN and contract fields. A source filter may be ignored by the website. Never invent prices, replace a failed observation's timestamp or label an observation time as an issuer quote time.

Keep `tests/fixtures/reference-snapshot.json` frozen. Daily market data belongs in `public/research/snapshot.json`; changing a price must not change expected reference-test results.

Use the checks in `package.json` and record UI evidence under `output/playwright/`. Keep the interface review in `docs/interface-review.md` current when a flow changes.
