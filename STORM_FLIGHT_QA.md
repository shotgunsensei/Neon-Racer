# Storm Flight release slice

Implementation verified locally; deployment unverified. GitHub push and draft PR
creation are pending the parent task's October 14 credential-security hold.
No authenticated GitHub write, merge, Replit publish, migration, credential change,
paid CI run or new service was performed by this task.

## Source and scope

The active project is `C:\Dev\Neon-Racer-New`, repository
`shotgunsensei/Neon-Racer`. Its clean `main` checkout and freshly fetched
`origin/main` were both `6172854f51384f8681b83620c8bcda7c9462f37f` before work.
Work is isolated on `codex/neon-racer-storm-drive`. No tracked repository
`AGENTS.md`, `.agents/` or `.codex/` instructions were present. Relevant local
game-development skills and Codex memory summaries were inspected. The existing
custom Canvas2D engine and 2.5D planar projection were retained.

This slice adds a short, integrated steering acceleration response with immediate
release/countersteer braking, a procedural city horizon, quiet wet-road highlights,
hazard reflections, bounded peripheral speed/rain cues and closing-traffic notices.
The road projection and swept collision tests remain intact. Closing notices show
current overlap and approach distance, not a predicted safe lane for sweepers.
They do not confer immunity or change score, spawns, progression or repair rules.

The FX / Calm control preserves the run, reduces visual motion and also suppresses
HUD/result/repair transitions and confetti. System reduced motion is honored and
shown as an active Calm preference. The phone toolbar uses two rows to keep storm
notices clear. New scenery is original procedural drawing. The gameplay commit
adds no assets, dependencies, environment variables or database schema changes.
The separate dependency follow-up below refreshes compatible locked versions.

## Checks and gameplay evidence

Local environment: Windows, Node 24.16.0, locked dependencies from `npm ci`.
The existing CI targets Node 22; Replit declares Node 20. Exact-head CI and the
hosted runtime therefore remain separate gates.

- `npm run release:check`: 36 game tests, 29 API tests, TypeScript and production
  client/server build passed. After the final toolbar adjustment, TypeScript and
  the production build passed again. API tests required loopback access outside
  sandbox isolation; they use mocked storage, not the production database.
- `git diff --check` and `node --check` on the browser scripts passed. No lint
  command or lint configuration is supplied by this repository.
- Seven new deterministic regressions cover refresh-rate-independent steering,
  immediate braking, Calm/roll parity, alert boundaries/slowdown, render resolution,
  bounded peripheral weather and renderer non-mutation. Existing regressions cover
  straight lane projection, swept collisions, repair deadlines and score recovery.
- Isolated Playwright gameplay exercised A/D and arrow steering, double-tap rolls,
  firing, opposing-input braking, pause/resume, camera and effects changes, wrong
  repair commands, game over, restart, all three successful repair sequences and
  re-entry immunity. Pixel readback checked visible ship movement. All 16 assertions
  passed with zero runtime page errors. The readback instrumentation caused the
  expected Canvas2D `willReadFrequently` performance hint; it is not used in game code.
- A 390x844 touch context at DPR 2 exercised Racer and Chaos, touch steering/fire,
  cockpit/chase switching, system reduced motion and mode reset. No horizontal
  overflow or runtime page errors. This is browser emulation, not a physical phone.
- Screenshots and JSON/log receipts are retained locally under `output/playwright/`.
  No leaderboard submissions or live customer writes were made.

## Frame pacing

Sequential six-second actual Arcade runs in isolated Chromium, 1280x900 viewport,
DPR 1, identical seeded RNG, first two intervals excluded. Main was served from
an untouched Git archive of `6172854` at port 5188; the slice used port 5187.
Both samples advanced score (2,698 and 2,695 respectively) without entering repair.

| Metric | Main | Storm Flight |
| --- | ---: | ---: |
| Measured frames | 272 | 274 |
| Median frame interval | 21.6 ms | 21.5 ms |
| p95 frame interval | 22.4 ms | 22.2 ms |
| Intervals above 33.4 ms | 3 | 3 |
| Chase backing canvas | 800x1000 | 496x621 |
| Backing pixels | 800,000 | 308,016 |

The display rectangle was 894x621 in both cases. Letterboxing-aware rendering
removes 61.5% of backing pixels while these short samples show comparable pacing.
The tiny interval difference is not evidence of a meaningful FPS gain. This
headless Windows session does not establish 60 FPS, physical-device performance,
long-session stability or production-host performance.

## Remaining release gates

Security is not clean: the compatible dependency follow-up leaves 8 affected
packages in the production audit and 9 in the full audit, plus a development HMR
receiver risk identified in source. Their disposition is documented below.

Before the credential hold, the main GitHub release workflow was observed passing
at `6172854` (run 37046058480), with no open PRs, no GitHub deployment records and
no branch protection. The listed Replit project was inaccessible through the web
reader, so its deployed revision/playability was not verified. Shared-browser and
publishing coordination was requested from the CallCommandAI owner; only an
independent Playwright browser was used here. No OperatorOS files were changed.

After the parent clears the credential hold, push this branch and open the
prepared PR in draft mode. Verify exact-head CI, security disposition, actual
Replit source/build identity, runtime toolchain compatibility and post-publish
gameplay before merging/publishing. No migrations are needed. Roll back by
reverting this slice and redeploying the previous verified build.

## Compatible dependency follow-up

The original production audit contained 20 affected package nodes, including
transitive effects; this is not a count of distinct advisory identifiers. Static
triage was completed before changes, with a fresh read-only investigator. A fresh
read-only reviewer then checked the candidate dependency changes and regression
tests. No security policy file was found. These conclusions apply to this source
and local build; the deployed configuration remains unverified.

Only compatible version ranges were refreshed. The direct minimums are now
`ws ^8.21.0`, `postcss ^8.5.23` and `vite ^7.3.7`. The existing override was retained;
no new override, advisory suppression, forced major upgrade or weakened check was
added. Additional compatible Babel, Browserslist and Rollup updates remove full
audit findings outside the original production list.

In the table, **not actionable** means the required attacker-controlled input or
sink was not found in the current application's production path; it does not
declare the underlying package safe. **Needs review** is a source-backed path
whose external deployment exposure has not been verified. The sole review queue
item is rank 1, development HMR. Patch status is separate from these verdicts.

| Original package (severity) | Source boundary and triage verdict | Candidate status |
| --- | --- | --- |
| proxy-addr (critical) | Not actionable, high confidence: Express trust proxy remains false; the score limiter uses the socket address. No short mapped IPv6 trust subnet is configured. | Patched 2.0.8. |
| body-parser (low) | Not actionable, high confidence: both parsers use a valid constant 1 KiB limit. The advisory requires an invalid limit configuration. | Patched 2.3.0. |
| qs (moderate) | Not actionable, high confidence: simple query parsing and flat, size-limited URL-encoded bodies; no hostile object stringify roundtrip. | Patched 6.16.0. |
| path-to-regexp (high) | Not actionable, high confidence: fixed API routes and a single SPA wildcard; no dangerous optional-group or multi-wildcard pattern registration. Request paths cannot register patterns. | Patched 8.4.2. |
| ws (high) | Needs review, high confidence: no production WS endpoint found, but development HMR uses Vite's separately vendored receiver on the main HTTP server. | Standalone patched 8.22.0; Vite's ws 8.18.3 remains affected. |
| drizzle-orm (high) | Not actionable, high confidence: schema, table and ordering identifiers are static; submitted score fields are parameterized values. No untrusted identifier or alias builder was found. | Remains 0.39.3. |
| lodash (high) | Not actionable, medium confidence: Recharts transitively imports Lodash; current game routes do not mount the chart component, and no attacker-controlled template/unset/omit sink was found. | Patched 4.18.1. |
| nanoid (high) | Not actionable, high confidence: development cache-busting uses the default fixed-size generator, not an attacker-controlled size/alphabet. No production caller found. | Patched 3.3.20. |
| postcss (high) | Not actionable, high confidence: repository CSS and configuration are build inputs; no request-facing CSS compiler or source-map ingestion service. | Patched 8.5.30. |
| source-map-js (high) | Not actionable, high confidence: build source maps come from the repository/toolchain, not public score input. | Patched 1.2.2. |
| yaml (moderate) | Not actionable, medium confidence: configuration tooling only; no request-driven YAML parsing found. | Patched 2.9.1. |
| minimatch (high) | Not actionable, high confidence: content/config glob patterns are repository-controlled, not score fields. | Patched 9.0.9. |
| brace-expansion (high) | Not actionable, high confidence: build glob patterns are repository-controlled. | Patched 2.1.7. |
| picomatch (high) | Not actionable, high confidence: build/watch glob patterns are repository-controlled. | Patched 2.3.2. |
| braces (high) | Not actionable, high confidence: inherited build/watch pattern parser; no public pattern input found. | Remains 3.0.3; audit lists no patched version. |
| chokidar (high) | Not actionable, high confidence: file watching inherits Braces risk with repository-controlled patterns. | Remains affected through Braces. |
| fast-glob (high) | Not actionable, high confidence: Tailwind content scanning inherits Micromatch/Braces risk; no public scanning service. | Remains affected transitively. |
| micromatch (high) | Not actionable, high confidence: repository build patterns inherit Braces risk. | Remains affected transitively. |
| postcss-selector-parser (moderate) | Not actionable, high confidence: selectors are repository CSS, not public input. | Compatible 6.1.4 retains an advisory fixed in 7.1.6. |
| tailwindcss (high) | Not actionable, high confidence: inherits build scanner risk; npm's production classification comes through the tailwindcss-animate peer, not an HTTP compiler route. | Remains 3.4.17; migrating the CSS pipeline is outside this compatible slice. |

Key controls are in `server/index.ts`, `server/routes.ts:34`,
`server/score-submission-limit.ts:35`, `shared/schema.ts:5`,
`server/storage.ts:12`, `server/vite.ts:12`, `tailwind.config.ts` and
`postcss.config.js`. Maintainer guidance supports the
[proxy-addr configuration precondition](https://github.com/advisories/GHSA-jqcg-44mw-7w3h),
[Drizzle identifier precondition](https://github.com/advisories/GHSA-gpj5-g38j-94v9),
[unpatched Braces status](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm) and
[WebSocket wrapper-count vulnerability](https://github.com/advisories/GHSA-96hv-2xvq-fx4p).

Vite 7.3.7 still embeds ws 8.18.3 in `dist/node/chunks/config.js`, which appends
fragment and buffered-chunk wrappers without the patched count limits. The app
attaches `/vite-hmr` to the main server, and Vite accepts upgrades without an
Origin header. An untrusted peer reaching this development server can reach the
affected receiver. The normal production branch excludes Vite. Standalone ws
tests do not cover this vendored copy. Drizzle Kit also contains ws 8.18.2, with
no identified application runtime caller. No exhaustion PoC was run. Development
server reachability must be reviewed before a release; the compatible update
does not resolve this source-backed issue.

The remaining production audit nodes are Braces, Chokidar, Drizzle ORM,
Fast-glob, Micromatch, PostCSS Nested, PostCSS Selector Parser and Tailwind CSS:
6 high, 2 moderate, 0 critical. The full audit adds @tailwindcss/typography:
6 high, 3 moderate, 0 critical. Thirteen of the original twenty package nodes are
removed; PostCSS Nested inherits the surviving selector risk. Both audit commands
exit nonzero because findings remain. Drizzle 0.45.2, Selector Parser 7.1.6 and a
Tailwind 4 migration require compatibility work beyond the existing version
ranges and were not silently introduced.

After a clean `npm ci --ignore-scripts --no-fund`, `npm run release:check` passed
36 game tests, **35 API tests**, TypeScript and both production builds. Six new
regressions check malformed proxy subnet rejection with valid subnet controls,
hostile QS constructor roundtrips with Unicode fields, invalid parser limits with
the actual 1 KiB configuration, fixed API/SPA routing, standalone WS fragment and
chunk limits with ordinary messages, and bound SQL values with static identifiers.
The bounded proxy and QS reproductions fail under the original versions and pass
under the candidate. Tests use mocked database storage; no live data was touched.

The rebuilt client retains the gameplay commit's file hashes and sizes:
`index-BzTasy0U.css` 84.35 kB and `index-DrUYc605.js` 469.68 kB (145.55 kB gzip).
The gameplay and frame-pacing receipts above apply to those identical client
bytes; they were not rerun or represented as a new performance sample. The
dependency reviewer found no confirmed behavior regression. Managed Codex
Security artifact-save tools were unavailable; this versioned release QA record
does not claim to be a saved scan artifact or a clean security verdict.

## Repeat local gameplay checks

Start the client preview at port 5187 with
`node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 5187 --strictPort`.
Use an independent browser session:

```text
npx --yes --package=@playwright/cli@0.1.22 playwright-cli -s=neon-racer-qa open http://127.0.0.1:5187/play?mode=arcade
npx --yes --package=@playwright/cli@0.1.22 playwright-cli -s=neon-racer-qa run-code --filename=script/playtest.js
npx --yes --package=@playwright/cli@0.1.22 playwright-cli -s=neon-racer-qa eval "() => window.neonQaResults" --raw
npx --yes --package=@playwright/cli@0.1.22 playwright-cli -s=neon-racer-qa run-code --filename=script/playtest-mobile.js
```

Create `output/playwright/` before running screenshot checks. The scripts are
Playwright CLI snippets, not part of `test:game`. `playtest-performance.js` also
requires an untouched main archive served at port 5188. Run its two samples
sequentially without concurrent builds or readback probes. Desktop screenshot
checks used a 1280x900 browser viewport.
