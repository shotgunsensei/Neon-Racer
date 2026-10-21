# Lunch Break review — October 21, 2026

The existing Calm control reduces visual motion but does not cap high-density rendering. The new optional Eco / Performance mode caps the canvas density at one instead of two while retaining the same logical playfield, hitboxes, handling and timing. It is a display preference held outside simulation state and outside the game-initialization effect's dependencies, so changing it must preserve the current run and repair routine. The preference is stored locally; blocked storage leaves the session usable. Default rendering is unchanged.

Local validation: 39 gameplay/rendering tests, TypeScript and the production client/server build passed after the change. The four style tests passed on the unchanged styles. API/HMR checks encountered local socket-permission failures and are not successful API acceptance. No database/schema/migration, score API, deployment config or credentials were changed.

At density two, the option permits up to 75% fewer backing pixels; this is a pixel-budget calculation, not a measured FPS increase. Live browser acceptance must check both cameras, narrow layouts, switching during a run/repair, retained score, reload persistence and blocked storage before publication. Physical phone/controller and hardware FPS remain unverified by this pass.

The game is an arcade flight/obstacle run with Arcade, Racer and Chaos modes. Its projected obstacles, cockpit radar and collision model already have regression coverage. Do not present it as a realistic vehicle simulator or claim new maps were added.
