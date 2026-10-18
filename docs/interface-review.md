# Interface review

## Scope and coverage

Reviewed the complete Today → Models → decision details → Backtest → Method flow, plus initial loading, unavailable data, an empty decision journal and offline recovery. React 19, TypeScript, CSS tokens, Geist Variable and Lucide icons. The project follows the supplied workspace AGENTS.md: sans-serif type, no green and concise factual copy. The user subsequently requested dark mode by default; this explicit request overrides the initial white-surface preference. No separate project design-system or contribution document exists.

Runtime evidence covers Chromium at 1440×900, 390×844, 375×667 and 320×568. At normal desktop and phone sizes the application fits one viewport. Short screens deliberately allow scrolling to keep controls accessible. Native iPhone installation and assistive-technology behavior are outside the verified boundary.

All six owning better-interface skills were loaded and used during implementation.

| Domain | Evidence inspected | Result |
| --- | --- | --- |
| Accessibility | `src/main.tsx`, native selects/dialog, named navigation, `src/style.css` focus rules; axe scans across 24 view/viewport combinations and three transient states; dialog Escape | Clear within inspected scope |
| Layout | Four views and three method sections at four sizes, overflow measurements in `scripts/check-ui.mjs`, mobile and desktop screenshots; loading/error/empty screenshots | Clear |
| Writing | Interface labels, recovery instructions, simulation and cost labels; README audit in `docs/copy-review.json` | Clear |
| Typography | Geist rendering, numeric columns, wrapping of model reasons, full decision access through dialog; mobile screenshots | Clear |
| Colors | Dark surfaces, violet selection and positive values, red losses, explicit signed numbers and text labels; axe contrast checks | Clear within automated and visual checks |
| UI polish | Shared spacing/borders, bottom navigation, control alignment, hover/focus states, reduced-motion CSS, loading and error states | Clear |

## Findings

No actionable interface findings remain in the inspected scope. During implementation, the mobile model-row height was reduced to avoid hidden overflow, model reasons gained an explicit full-text action, the decision timestamp and historical venue became explicit, and the first-install cache was corrected to include the built JavaScript and CSS.

## Verification

Passed:

- `CRP_URL=https://crp.keff.uk npm run test:ui`: 24 view/viewport combinations; no serious or critical axe findings, no horizontal overflow, no normal-size body overflow. Tested asset selection, model selection, replay selection and decision dialog dismissal. Evidence: `output/playwright/verification.json` and screenshots generated locally.
- `CRP_URL=https://crp.keff.uk node scripts/check-pwa.mjs`: Chromium reported no installability errors. Manifest uses standalone display and includes 192/512 icons. Offline reload displayed a recoverable error; Retry restored the current data after reconnection. Loading, error and empty states had no serious or critical axe findings. Evidence: `output/playwright/pwa.json` and screenshots.
- Root font resize to 200% at 640×600: no horizontal document overflow. This is a text/reflow check, not a claim of native browser zoom certification.
- `npm run check`, financial-engine tests and production build passed. GitHub Actions and Cloudflare Workers Builds also completed successfully during publication.

Not verified:

- VoiceOver, TalkBack, other screen readers, actual device home-screen installation, forced-colors rendering and native browser 200% zoom.
- A long-run profitability result. The UI displays a simulation and archived model observations; it does not establish a trading advantage.

## Verdict

Approve for the inspected domains and runtime boundary. No unreviewed domain; the device and assistive-technology checks listed above remain unverified.

## Dark default update

The user requested dark mode by default. Theme tokens, native control appearance, chart outlines, navigation, dialogs, PWA launch colors and the shell cache were updated together. All 24 view/viewport combinations passed contrast and overflow checks in Chromium, including the open decision dialog. A system set to light still rendered the dark interface. The direct `/#backtest` route loaded the benchmark and survived reload. No financial rules or recorded results changed.
