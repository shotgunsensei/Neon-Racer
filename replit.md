# Neon Racer

## Overview

Neon Racer is a retro synthwave-themed browser racing game built by Shotgun Ninjas Productions. Players navigate a neon-lit grid, dodging corruption blocks (obstacles) and collecting power-ups (shield, weapon) while the game progressively speeds up. Scores are saved to a persistent leaderboard. The app is a full-stack TypeScript project with a React frontend and an Express backend, sharing types and schema definitions through a common `shared/` directory.

Two main pages exist:
- **Home (`/`)** – Landing page with game intro, controls guide, and live leaderboard
- **Play (`/play`)** – The actual game, rendered via HTML5 Canvas

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture

- **Framework**: React 18 with TypeScript, bootstrapped via Vite
- **Routing**: `wouter` (lightweight client-side router) with two routes: `/` and `/play`
- **State & Data Fetching**: TanStack Query (React Query v5) for server state; local React state for game HUD
- **UI Components**: shadcn/ui component library built on Radix UI primitives, styled with Tailwind CSS
- **Styling**: Tailwind CSS with a custom neon/synthwave design system using CSS variables. Fonts: Orbitron (display) and Rajdhani (body), loaded from Google Fonts
- **Game Engine**: Pure HTML5 Canvas rendering loop in `GameEngine.ts` / `GameCanvas.tsx`. Uses `requestAnimationFrame` with delta-time normalization for 60fps target
- **Perspective and flight**: `RacerVisuals.ts` projects the track, obstacles, pickups, shots and particles into a shared 2.5D view. A/D and the arrow keys are always available together during gameplay, including when mode or HUD buttons have focus; editable text fields retain normal typing. The shaded ship banks during lateral movement; double-tap Left/A or Right/D (or the same touch arrow) within about 280 ms for a barrel roll with a 300 ms lateral speed burst. The burst starts at 2.4x normal strafe speed and eases back to normal, continues after releasing the arrow, and can be braked by countersteering or holding both directions. Rolls take about 630 ms with a 1.2-second start-to-start cooldown, grant no immunity or score, and preserve ground collision rules. Reduced-motion preferences hide the spin and limit banking while retaining the same speed burst. Swept lateral collision checks prevent fast movement from skipping obstacles and pickups. Losing focus pauses the run and clears steering. No new dependencies or environment variables are required. Run `npm run test:game` for projection and maneuver regressions.
- **Celebrations**: `canvas-confetti` fires when a high score is submitted

#### Gameplay visibility

The raised, fixed camera uses one planar perspective transform for track lines and entities. Fixed blocks follow straight lane paths; the entry shows 60% of the track width, with 1:1 alignment at the ship's center. Negative spawn coordinates project continuously onto the approach instead of bunching at the horizon. Collision bounds, obstacle speeds, steering and barrel-roll timing remain in their original simulation space.

Blocks have shaded caps, side faces and bright ground contact edges. Mint chevrons show sweeper direction; a faint cyan ribbon marks the ship's current collision-width path. Track shoulders and moving rail lights add depth and speed cues outside the playable lanes. Impacts light the border without shaking the camera, and compact Storm/Surge notices leave the middle of the track clear. The mobile score/level row leaves more of the entrance visible, and gameplay no longer has a dark scanline overlay. Reduced motion suppresses impact flashes and extra boost streak length, in addition to suppressing barrel-roll spin. No additional dependencies, services or environment variables are needed. Validate with `npm run test:game`, `npm run check`, and `npm run build`, then play Arcade, Racer and Chaos at desktop and phone sizes.

**Key frontend components:**
- `GameCanvas.tsx` – Canvas rendering, input handling, game loop, HUD overlay
- `GameEngine.ts` – Pure game state logic (entity types, collision detection, spawn/particle systems)
- `GameOverModal.tsx` – Score submission form shown after game ends
- `Leaderboard.tsx` – Fetches and displays top 10 scores
- `AnimatedBackground.tsx` – Full-screen Canvas-based animated background with 5 layers: deep space gradient with drifting starfield, synthwave perspective grid, data corruption blocks (glitch-flicker), glow-pulsing logo, and periodic scanline sweep

### Backend Architecture

- **Framework**: Express.js (Node.js) running as a single HTTP server
- **Entry point**: `server/index.ts` creates the Express app, registers API routes, and either serves Vite dev middleware (development) or static files (production)
- **Routes**: Defined in `server/routes.ts`, using route paths/schemas from `shared/routes.ts`
  - `GET /api/scores` – Returns top 10 high scores ordered by score descending
  - `POST /api/scores` – Validates and saves a new high score; seeds 3 default scores if DB is empty
- **Storage layer**: `server/storage.ts` defines an `IStorage` interface and `DatabaseStorage` class using Drizzle ORM, making it easy to swap storage backends if needed
- **Build**: esbuild bundles the server to `dist/index.cjs`; Vite builds the client to `dist/public`

### Data Storage

- **Database**: PostgreSQL via the `DATABASE_URL` environment variable (required)
- **ORM**: Drizzle ORM with `drizzle-orm/node-postgres` and a `pg` Pool
- **Schema** (`shared/schema.ts`):
  - `high_scores` table: `id` (serial PK), `player_name` (text), `score` (integer), `level` (integer), `created_at` (timestamp, default now)
- **Validation**: `drizzle-zod` generates Zod schemas from the Drizzle table definition; these schemas are reused on both client and server for request/response validation
- **Migrations**: Drizzle Kit manages migrations, output to `./migrations/`

### Shared Layer (`shared/`)

The `shared/` directory is a key architectural decision that eliminates API contract drift:
- `schema.ts` – Single source of truth for DB schema and TypeScript types
- `routes.ts` – Typed API route definitions (method, path, Zod input/output schemas) consumed by both the Express server and React hooks, ensuring the client and server always agree on request/response shapes

### Authentication

No authentication is implemented. The leaderboard is public; anyone can submit a score.

### Path Aliases

| Alias | Resolves To |
|---|---|
| `@/*` | `client/src/*` |
| `@shared/*` | `shared/*` |
| `@assets/*` | `attached_assets/*` |

## External Dependencies

| Dependency | Purpose |
|---|---|
| PostgreSQL | Persistent storage for high scores (via `DATABASE_URL` env var) |
| Google Fonts | Orbitron and Rajdhani typefaces loaded at runtime |
| `canvas-confetti` | Confetti celebration animation on high score submission |
| Radix UI (multiple packages) | Accessible headless UI primitives backing shadcn/ui components |
| TanStack React Query v5 | Server state management and API caching |
| Drizzle ORM + drizzle-zod | Database access and schema-derived validation |
| Zod | Runtime validation on both client and server |
| Vite + `@vitejs/plugin-react` | Frontend dev server and bundler |
| `@replit/vite-plugin-runtime-error-modal` | Replit-specific dev overlay for runtime errors |
| `@replit/vite-plugin-cartographer` | Replit-specific dev tooling (dev only) |
| `wouter` | Lightweight React router |
| `lucide-react` | Icon set used throughout the UI |
| `date-fns` | Date utilities (available, not heavily used currently) |
| `connect-pg-simple` | Available for PostgreSQL session store if sessions are added later |
