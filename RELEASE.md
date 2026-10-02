# Release checks and leaderboard submissions

Run `npm ci`, then `npm run release:check` before releasing. The release command
runs the existing game regressions, deterministic API tests, TypeScript checks,
and the client/server production build. GitHub Actions runs the same command on
pull requests and pushes to `main` with Node 22. API tests bind disposable loopback
ports, use mocked storage and a fake clock, and need no database or credentials.

## Submission contract

`POST /api/scores` remains anonymous. Names are trimmed, then must contain 1–15
UTF-16 code units (the same length model as the browser input's `maxLength={15}`).
Empty/whitespace names and overlong trimmed names return `400`; names are never
silently truncated. Unicode and punctuation remain allowed.

Scores must be integer numbers from 0 through 2,147,483,647; levels must be integer
numbers from 1 through 2,147,483,647. `GameEngine.ts` initializes score 0/level 1,
and `GameCanvas.tsx` submits `Math.floor(state.score)` and increments levels during
play without a gameplay ceiling. The upper bounds come from the existing
[PostgreSQL integer columns](https://www.postgresql.org/docs/16/datatype-numeric.html),
not an inferred maximum run length. Invalid submissions never reach storage.
Extra fields are discarded by the existing schema. The request body is limited to
1 KiB (`413` when exceeded); malformed JSON returns `400`.

## Abuse limits and retry

Each server process permits at most 10 POST attempts per network peer and 100
total POST attempts in a fixed 60-second window starting with its first attempt.
Invalid and malformed attempts count. Rejections have status `429`, a
`Retry-After` header in whole seconds rounded up, `Cache-Control: no-store`, and a
JSON body `{ message, retryAfter }`. The score form displays the retry message;
retry manually after that interval. Rejections do not reach storage. Reading the
leaderboard and playing the game remain available.

The global admission limit bounds the in-memory peer map to 100 entries per
window; expired windows clear it on the next POST. No timers, credentials,
additional dependencies, database changes or paid services are needed.

## Deployment limitations

The limiter uses the actual socket peer and ignores client-supplied forwarding
headers. Behind a reverse proxy, players using the same proxy address share the
10-attempt quota. NAT users likewise share a quota. Replit's configured autoscale
deployment topology has **not** been verified; do not describe this as a per-player
or deployment-wide quota. Counters reset when a process restarts and are separate
across replicas. Fixed window boundaries allow bursts, and this is a small
submission-abuse guard rather than network DDoS protection.

Do not enable blanket `trust proxy` or trust arbitrary `X-Forwarded-For` values to
increase throughput. A future per-client implementation must first verify the
host's exact proxy chain, header rewriting and direct-access rules, then use a
bounded shared store if deployment-wide limits are needed. See
[Express's proxy guidance](https://expressjs.com/en/guide/behind-proxies/).

Scores and levels still come from the browser. Validation and throttling do not
prove that a submitted score was earned and are not anti-cheat measures. Existing
leaderboard rows are unchanged; this release does not sanitize historical data.

## Publication and recovery

After CI passes for the exact PR head and merged `main`, sync the Replit project
to that verified main commit, build, and publish. Verify the home/play pages and
leaderboard read without submitting live test scores. Publishing from the open
Chrome tab requires the supported Computer Use runtime; if unavailable, leave
publication pending and hand off the verified commit and checks.

No migration is required. Revert this commit and redeploy the previous build to
roll back; the database schema and anonymous-play contract remain compatible.
