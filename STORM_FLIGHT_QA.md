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
notices clear. New scenery is original procedural drawing; no new assets, runtime
dependencies, environment variables, database schema or lockfile changes.

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

`npm audit --omit=dev --json` reports 20 advisories in the unchanged dependency
tree: 1 critical, 15 high, 3 moderate and 1 low. The critical package is
`proxy-addr` (GHSA-jqcg-44mw-7w3h); other direct flagged packages include
`drizzle-orm`, `postcss`, `tailwindcss` and `ws`. These are untriaged package
advisories, not verified exploitable paths in this app. Resolve or explicitly
review them before a clean security/release verdict. This gameplay slice performs
no broad dependency update.

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
