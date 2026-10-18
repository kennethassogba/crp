# Interface review

## Scope and coverage

Reviewed Today, Models, decision details, Backtest and all Method sections after the hierarchy revision requested on 18 October 2026. Includes loading, unavailable data, an empty journal, mixed decision statuses and offline recovery. React 19, TypeScript, CSS tokens, Geist Variable and Lucide icons. The workspace AGENTS.md and the explicit dark-mode brief govern the design. No separate project design-system document exists.

All six owning better-interface skills were loaded. The earlier review missed the active chart tooltip; its blanket color verdict did not cover that state. The current checks explicitly open and measure the tooltip.

| Domain | Evidence | Result |
| --- | --- | --- |
| Accessibility | Named model buttons and navigation, native dialog/Escape, keyboard and touch chart inspection, axe scans in `scripts/check-ui.mjs` and `scripts/check-pwa.mjs` | Clear in the tested browser scope |
| Layout | Today decisions precede market context; five rows remain visible together. Overflow checks at 1440×900, 390×844, 375×667, 320×568 and 768×800; actual desktop/mobile screenshots | Clear; short screens can scroll |
| Writing | Purpose statement, action labels, explicit simulated positions, recovery text; new copy passed the local Avoid AI Writing detector with no findings | Clear; recorded model reasoning preserved |
| Typography | Geist, tabular numbers, full reasons in dialog, long position plan at 375px | Clear in inspected states |
| Color | Explicit tooltip foreground/background; measured active contrast >=4.5:1 at all five sizes; failed decisions and delayed data have text labels | Clear within automated and visual checks |
| UI polish | Flat model list, consistent separators, paired asset quotes, focus/hover states, reduced motion and refreshed social preview | Clear |

## Resolved findings

| Severity | Location | Before | After |
| --- | --- | --- | --- |
| HIGH | `src/style.css:402`, `src/main.tsx:1169` | Active chart tooltip inherited light text on white | Explicit dark surface and light text; active contrast assertion, pointer, touch and keyboard checks |
| MEDIUM | `src/main.tsx:363`, `src/style.css:1485` | A selector hid four of the five daily model decisions | All five decisions appear in one list; each opens its own reasoning and plan |
| MEDIUM | `src/main.tsx:309`, `src/main.tsx:415` | First visit emphasized prices without explaining the app | Short purpose statement and model decisions first; market context follows |
| MEDIUM | `src/main.tsx:516`, `src/main.tsx:1010` | Shared provider budget dominated public comparison | Removed budget feature and cost column; request diagnostics are collapsed in details. Server accounting unchanged |

## Verification

- TypeScript, 18 financial/data/budget tests and production build passed.
- `npm run test:ui`: 30 view/viewport combinations, no serious or critical axe findings, no horizontal overflow, no body/main overflow at normal phone and desktop sizes.
- Tested all five daily rows, model detail dismissal, historical replay, direct Backtest reload, asset selection, keyboard chart navigation, active tooltip contrast and 200% root-font reflow.
- Browser-only fixtures exercise cash, BTC 2×, ETH 1×, provider failure and excluded late response. Verified copied position levels, long-plan dialog contrast, touch selection and chart-period change. Fixtures never write records or invoke a provider.
- `scripts/check-pwa.mjs` verifies standalone installability, offline Retry and loading/error/empty states against the published build. Native iPhone installation, VoiceOver, TalkBack and native browser zoom remain outside the verified scope.
- Updated `public/social-card.png` from the app using actual recorded production decisions, without generating new model outputs.

## Verdict

Approve within the inspected Chromium/browser boundary. Device installation and assistive-technology checks listed above remain unverified. This review concerns presentation and access to recorded data, not strategy profitability.
